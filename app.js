// app.js
// Mescid Namaz Vakitleri + Cemaat (İkame) Saatleri
// Uses Supabase schema: prayer_hub (tables: masjids, overrides)
// Prayer times provider: AlAdhan (timings)
// TR/EN support via #i18nDict in index.html

(() => {
  "use strict";

  // ---------- Constants ----------
  const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  const PRAYER_LABELS = {
    fajr: { tr: "Fajr", en: "Fajr" },
    dhuhr: { tr: "Dhuhr", en: "Dhuhr" },
    asr: { tr: "Asr", en: "Asr" },
    maghrib: { tr: "Maghrib", en: "Maghrib" },
    isha: { tr: "Isha", en: "Isha" },
  };

  // AlAdhan method mapping is provider-defined; we store methodId in DB.
  const DEFAULT_METHOD = {
    provider: "aladhan",
    methodId: 2,
    school: "standard", // "hanafi" or "standard"
    highLatRule: "angleBased", // angleBased|midnight|oneSeventh (we map)
    tune: {}, // optional
  };

  const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
  const COUNTDOWN_TICK_MS = 1000;

  // ---------- DOM ----------
  const el = {
    root: document.documentElement,

    // header
    masjidName: $("#masjidName"),
    masjidCity: $("#masjidCity"),
    todayDate: $("#todayDate"),

    langToggleBtn: $("#langToggleBtn"),
    copyLinkBtn: $("#copyLinkBtn"),
    copyLinkBtn2: $("#copyLinkBtn2"),
    shareLinkInput: $("#shareLinkInput"),

    // slug gate
    slugGate: $("#slugGate"),
    slugInput: $("#slugInput"),
    openSlugBtn: $("#openSlugBtn"),

    // status/notice
    notice: $("#notice"),
    noticeText: $("#noticeText"),
    noticeClose: $("#noticeClose"),

    // next card
    tzBadge: $("#tzBadge"),
    nextPrayerLabel: $("#nextPrayerLabel"),
    nextPrayerTime: $("#nextPrayerTime"),
    nextTypePill: $("#nextTypePill"),
    nextMeta: $("#nextMeta"),
    countdown: $("#countdown"),
    refreshBtn: $("#refreshBtn"),
    useLocationBtn: $("#useLocationBtn"),
    locationStatus: $("#locationStatus"),
    providerStatus: $("#providerStatus"),
    iqamaSetSelect: $("#iqamaSetSelect"),
    dataFreshnessBadge: $("#dataFreshnessBadge"),

    // manual location
    manualLocationDetails: $("#manualLocationDetails"),
    manualLocationInput: $("#manualLocationInput"),
    manualLocationBtn: $("#manualLocationBtn"),

    // details
    methodBadge: $("#methodBadge"),
    calcProvider: $("#calcProvider"),
    calcMethodId: $("#calcMethodId"),
    calcSchool: $("#calcSchool"),
    calcHighLat: $("#calcHighLat"),
    calcTune: $("#calcTune"),
  };

  const i18n = loadI18n();

  // ---------- State ----------
  const state = {
    lang: detectInitialLang(),
    supabase: null,

    slug: null,
    setId: null, // optional URL param set=main

    masjid: null,
    iqamaSet: null, // active set object
    iqamaSets: [],

    // location and timings
    coords: null, // { lat, lon }
    locationLabel: null,
    manualLocation: null, // string

    // prayer times (base from API + computed with safety + iqama)
    computed: null,

    // countdown timer
    countdownTimer: null,
    refreshTimer: null,

    lastFetchInfo: {
      source: null, // "live" | "cache"
      at: null,
    },
  };

  // ---------- Init ----------
  boot().catch((err) => {
    console.error(err);
    showNotice(err?.message || "Unexpected error", "error");
  });

  async function boot() {
    // Wire UI
    wireLanguage();
    wireShare();
    wireSlugGate();
    wireRefresh();
    wireManualLocation();
    wireNotice();

    applyLanguage(state.lang);

    // Parse URL params
    const params = new URLSearchParams(location.search);
    state.slug = (params.get("m") || "").trim() || null;
    state.setId = (params.get("set") || "").trim() || null;

    setTodayDate();

    if (!state.slug) {
      // show slug gate and stop
      el.slugGate.hidden = false;
      setShareLink("");
      showNotice(t("slugHelp"), "info");
      return;
    }

    // Setup Supabase
    state.supabase = createSupabaseClient();

    // Load masjid profile
    await loadMasjid(state.slug);

    // Pre-fill share link
    setShareLink(makeShareLink(state.slug, state.setId));

    // Attempt location
    await resolveLocation();

    // Fetch timings & render
    await refreshAll({ preferCache: true });

    // Start countdown ticking
    startCountdownLoop();
  }

  // ---------- Supabase ----------
  function createSupabaseClient() {
    const url = window.__SUPABASE_URL || "";
    const key = window.__SUPABASE_ANON_KEY || "";
    if (!url || !key) {
      showNotice(
        "Supabase config missing. Fill __SUPABASE_URL and __SUPABASE_ANON_KEY in index.html.",
        "error"
      );
      // Still return a client object if possible; but will fail on queries.
    }

    // Supabase JS is loaded via CDN: window.supabase
    if (!window.supabase?.createClient) {
      throw new Error("Supabase JS client not found. Check the CDN script tag.");
    }
    return window.supabase.createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  async function loadMasjid(slug) {
    showNotice(t("loadingMasjid") || "Loading masjid profile…", "info");

    // IMPORTANT: use schema "prayer_hub"
    const { data, error } = await state.supabase
      .schema("prayer_hub")
      .from("masjids")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) {
      throw new Error(`Supabase: cannot load masjid (${slug}). ${error.message}`);
    }
    if (!data) {
      throw new Error(`Masjid not found for slug: ${slug}`);
    }

    state.masjid = normalizeMasjid(data);
    renderMasjidHeader();
    renderMethodDetails();
    loadIqamaSets();
    pickInitialIqamaSet();
    renderIqamaSelect();

    // Load today's overrides (optional)
    // We apply overrides later in refreshAll to use correct day.
    clearNotice();
  }

  function normalizeMasjid(row) {
    // row.name and row.city are JSONB (tr/en)
    const name = safeJson(row.name);
    const city = row.city ? safeJson(row.city) : null;

    return {
      id: row.id,
      slug: row.slug,
      name,
      city,
      timezone: row.timezone || "America/Los_Angeles",
      calc_method: mergeCalcMethod(row.calc_method),
      safety_offsets: clampSafetyOffsets(safeJson(row.safety_offsets)),
      iqama_sets: Array.isArray(row.iqama_sets) ? row.iqama_sets : safeJson(row.iqama_sets, []),
      meta: safeJson(row.meta, {}),
      is_public: !!row.is_public,
    };
  }

  function mergeCalcMethod(calc_method) {
    const obj = safeJson(calc_method, {});
    return {
      provider: obj.provider || DEFAULT_METHOD.provider,
      methodId: numOr(obj.methodId, DEFAULT_METHOD.methodId),
      school: obj.school || DEFAULT_METHOD.school,
      highLatRule: obj.highLatRule || DEFAULT_METHOD.highLatRule,
      tune: safeJson(obj.tune, {}),
    };
  }

  function clampSafetyOffsets(o) {
    const out = {};
    for (const p of PRAYERS) {
      const v = numOr(o?.[p], 0);
      out[p] = Math.max(0, Math.floor(v));
    }
    return out;
  }

  // ---------- Overrides (optional) ----------
  async function loadOverridesForDay(isoDate) {
    // isoDate = YYYY-MM-DD
    // We load both kinds and return a merged object
    if (!state.supabase || !state.masjid?.id) return [];

    const { data, error } = await state.supabase
      .schema("prayer_hub")
      .from("overrides")
      .select("kind,payload")
      .eq("masjid_id", state.masjid.id)
      .eq("day", isoDate);

    if (error) {
      // Non-fatal; just show notice and continue
      console.warn("Overrides fetch failed:", error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  }

  function applyOverridesToConfig(baseMasjid, overrides) {
    // baseMasjid is state.masjid
    // overrides: array of {kind, payload}
    // - kind=adhan: may include safety_offsets or tune
    // - kind=iqama: may include setId + fixedTimes (per prayer)
    const masjid = structuredClone(baseMasjid);

    for (const ov of overrides) {
      const payload = safeJson(ov.payload, {});
      if (ov.kind === "adhan") {
        if (payload.safety_offsets) {
          masjid.safety_offsets = clampSafetyOffsets({
            ...masjid.safety_offsets,
            ...safeJson(payload.safety_offsets, {}),
          });
        }
        if (payload.tune) {
          masjid.calc_method.tune = {
            ...safeJson(masjid.calc_method.tune, {}),
            ...safeJson(payload.tune, {}),
          };
        }
      }
      // iqama overrides are applied later at calculation-time (need selected set)
    }

    return masjid;
  }

  function applyIqamaOverrideForSet(iqamaSet, overrides) {
    // Find matching iqama override: payload { setId, fixedTimes }
    const set = structuredClone(iqamaSet);
    for (const ov of overrides) {
      if (ov.kind !== "iqama") continue;
      const payload = safeJson(ov.payload, {});
      const setId = (payload.setId || "").trim();
      if (setId && setId !== set.id) continue;

      const fixedTimes = payload.fixedTimes ? safeJson(payload.fixedTimes, {}) : null;
      if (fixedTimes) {
        set.fixedTimes = {
          ...(set.fixedTimes ? safeJson(set.fixedTimes, {}) : {}),
          ...fixedTimes,
        };
      }
    }
    return set;
  }

  // ---------- Location ----------
  async function resolveLocation() {
    el.locationStatus.textContent = t("locResolving") || "Resolving location…";

    // Prefer geolocation first
    const ok = await tryGeolocation();
    if (ok) return;

    // If geolocation fails, open manual location details
    el.manualLocationDetails.open = true;
    el.locationStatus.textContent = t("locManual") || "Location blocked — enter city/address.";
  }

  async function tryGeolocation() {
    if (!navigator.geolocation) {
      showNotice(t("geoUnsupported") || "Geolocation is not supported in this browser.", "error");
      return false;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          state.coords = { lat, lon };
          state.locationLabel = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
          el.locationStatus.textContent = state.locationLabel;
          resolve(true);
        },
        (err) => {
          console.warn("Geolocation error:", err?.message);
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  async function resolveManualLocation(text) {
    // Use OpenStreetMap Nominatim to convert city/address -> lat/lon
    // (No key required; keep usage respectful)
    const q = (text || "").trim();
    if (!q) throw new Error(t("enterCity") || "Please enter a city/address.");

    el.locationStatus.textContent = t("locSearching") || "Searching…";

    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(q);

    const res = await fetch(url, {
      headers: {
        // helpful UA; some environments ignore it
        "Accept": "application/json",
      },
    });

    if (!res.ok) throw new Error(`Geocoding failed (${res.status}).`);
    const arr = await res.json();
    if (!Array.isArray(arr) || !arr[0]) throw new Error(t("locNotFound") || "Location not found.");

    const lat = parseFloat(arr[0].lat);
    const lon = parseFloat(arr[0].lon);
    if (!isFinite(lat) || !isFinite(lon)) throw new Error(t("locNotFound") || "Location not found.");

    state.coords = { lat, lon };
    state.locationLabel = arr[0].display_name || q;
    el.locationStatus.textContent = state.locationLabel;
  }

  // ---------- Prayer Times Fetch ----------
  async function refreshAll({ preferCache }) {
    if (!state.masjid) return;

    const tz = state.masjid.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    el.tzBadge.textContent = `TZ: ${tz}`;

    const todayISO = isoDateInTZ(new Date(), tz);

    // Cache key is tied to slug + date + coords or manual location
    const cacheKey = makeCacheKey({
      slug: state.masjid.slug,
      date: todayISO,
      tz,
      coords: state.coords,
      manual: state.manualLocation,
      setId: state.iqamaSet?.id || "main",
      lang: state.lang,
    });

    // Try cache first
    if (preferCache) {
      const cached = readCache(cacheKey);
      if (cached) {
        state.computed = cached.computed;
        state.lastFetchInfo = { source: "cache", at: new Date(cached.savedAt) };
        renderAll();
        showFreshnessBadge();
      }
    }

    // Need location before live fetch
    if (!state.coords) {
      showNotice(t("needLocation") || "Please allow location or enter a city/address.", "info");
      return;
    }

    // Load overrides for today (optional)
    let overrides = [];
    try {
      overrides = await loadOverridesForDay(todayISO);
    } catch {
      overrides = [];
    }

    // Apply overrides to config (adhan-level)
    const masjidForToday = applyOverridesToConfig(state.masjid, overrides);
    const iqamaSetForToday = applyIqamaOverrideForSet(state.iqamaSet, overrides);

    // Fetch from AlAdhan
    const live = await fetchTimingsAlAdhan({
      date: new Date(),
      tz: masjidForToday.timezone,
      coords: state.coords,
      method: masjidForToday.calc_method,
    });

    const computed = computeSchedule({
      tz: masjidForToday.timezone,
      baseTimings: live.timings,
      safetyOffsets: masjidForToday.safety_offsets,
      iqamaSet: iqamaSetForToday,
    });

    state.computed = computed;
    state.lastFetchInfo = { source: "live", at: new Date() };

    // Cache it
    writeCache(cacheKey, { computed });

    renderAll();
    showFreshnessBadge();

    clearNotice();
  }

  async function fetchTimingsAlAdhan({ date, tz, coords, method }) {
    // Use AlAdhan timings endpoint.
    // We use timestamp to avoid month/year confusion and pass latitude/longitude.
    // AlAdhan supports: method=<id>, school=0/1, latitudeAdjustmentMethod=1/2/3.
    const ts = Math.floor(date.getTime() / 1000);

    const school = (method.school || "standard").toLowerCase() === "hanafi" ? 1 : 0;
    const latAdj = mapHighLatRule(method.highLatRule);
    const tune = safeJson(method.tune, {});

    // AlAdhan "tune" parameter is comma-separated adjustments per prayer in minutes:
    // "0,0,0,0,0,0,0,0,0" for (Imsak,Fajr,Sunrise,Dhuhr,Asr,Sunset,Maghrib,Isha,Midnight)
    // We keep it simple: if user provides aladhan_tune string in tune, use it;
    // otherwise build from per-prayer keys if present.
    const tuneParam = buildAlAdhanTune(tune);

    const url = new URL(`https://api.aladhan.com/v1/timings/${ts}`);
    url.searchParams.set("latitude", String(coords.lat));
    url.searchParams.set("longitude", String(coords.lon));
    url.searchParams.set("method", String(numOr(method.methodId, 2)));
    url.searchParams.set("school", String(school));
    url.searchParams.set("latitudeAdjustmentMethod", String(latAdj));
    // Request 24h
    url.searchParams.set("timezonestring", tz);
    if (tuneParam) url.searchParams.set("tune", tuneParam);

    el.providerStatus.textContent = `AlAdhan • method ${numOr(method.methodId, 2)}`;

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Prayer API failed (${res.status}).`);
    }
    const json = await res.json();
    const timings = json?.data?.timings;
    if (!timings) throw new Error("Prayer API returned invalid response.");

    // Normalize to our 5 prayers only: HH:MM
    return {
      timings: {
        fajr: normalizeHHMM(timings.Fajr),
        dhuhr: normalizeHHMM(timings.Dhuhr),
        asr: normalizeHHMM(timings.Asr),
        maghrib: normalizeHHMM(timings.Maghrib),
        isha: normalizeHHMM(timings.Isha),
      },
    };
  }

  function mapHighLatRule(rule) {
    // AlAdhan latitudeAdjustmentMethod:
    // 1 = Middle of the Night
    // 2 = One Seventh
    // 3 = Angle Based
    const r = (rule || "angleBased").toLowerCase();
    if (r === "midnight") return 1;
    if (r === "oneseventh" || r === "one_seventh" || r === "one-seventh") return 2;
    return 3; // angleBased default
  }

  function buildAlAdhanTune(tune) {
    // If tune contains a raw aladhan string, allow it:
    if (typeof tune?.aladhan_tune === "string" && tune.aladhan_tune.trim()) {
      return tune.aladhan_tune.trim();
    }
    // Otherwise build from known keys (fajr/dhuhr/asr/maghrib/isha).
    // Map to (Imsak,Fajr,Sunrise,Dhuhr,Asr,Sunset,Maghrib,Isha,Midnight)
    const F = numOr(tune.fajr, 0);
    const D = numOr(tune.dhuhr, 0);
    const A = numOr(tune.asr, 0);
    const M = numOr(tune.maghrib, 0);
    const I = numOr(tune.isha, 0);

    // If all zeros, skip param entirely
    const any = [F, D, A, M, I].some((x) => x !== 0);
    if (!any) return "";

    return [
      0, // Imsak
      Math.floor(F),
      0, // Sunrise
      Math.floor(D),
      Math.floor(A),
      0, // Sunset
      Math.floor(M),
      Math.floor(I),
      0, // Midnight
    ].join(",");
  }

  // ---------- Computation ----------
  function computeSchedule({ tz, baseTimings, safetyOffsets, iqamaSet }) {
    // baseTimings: {fajr:"HH:MM", ...}
    // safetyOffsets: minutes positive
    // iqamaSet: {id,label,offsets,fixedTimes}
    const now = new Date();
    const todayISO = isoDateInTZ(now, tz);

    const baseDates = {};
    for (const p of PRAYERS) {
      baseDates[p] = dateFromHHMMInTZ(todayISO, baseTimings[p], tz);
    }

    // Apply safety
    const adhanSafe = {};
    for (const p of PRAYERS) {
      const min = Math.max(0, numOr(safetyOffsets?.[p], 0));
      adhanSafe[p] = addMinutes(baseDates[p], min);
    }

    // Compute iqama
    const iqama = {};
    const offsets = safeJson(iqamaSet?.offsets, {});
    const fixedTimes = iqamaSet?.fixedTimes ? safeJson(iqamaSet.fixedTimes, {}) : null;

    for (const p of PRAYERS) {
      let iq = null;

      // fixedTime priority
      const ft = fixedTimes?.[p];
      if (typeof ft === "string" && ft.trim()) {
        iq = dateFromHHMMInTZ(todayISO, ft.trim(), tz);
      } else {
        const off = Math.max(0, numOr(offsets?.[p], 0));
        iq = addMinutes(adhanSafe[p], off);
      }

      // clamp: iqama cannot be before adhanSafe
      if (iq.getTime() < adhanSafe[p].getTime()) iq = new Date(adhanSafe[p].getTime());

      iqama[p] = iq;
    }

    // Determine "next event" (we choose next ADHAN_SAFE by default, and show iqama too)
    // But UI wants table status per prayer and a single next card.
    const timeline = [];
    for (const p of PRAYERS) {
      timeline.push({ kind: "adhan", prayer: p, at: adhanSafe[p] });
      timeline.push({ kind: "iqama", prayer: p, at: iqama[p] });
    }
    timeline.sort((a, b) => a.at - b.at);

    // If past Isha events, next is tomorrow's Fajr adhan/iqama; we need tomorrow fetch to be perfect,
    // but for MVP, we approximate tomorrow fajr based on today + 1 day using same HH:MM (can be off).
    // Better: fetch tomorrow in next iteration. For now, we'll compute tomorrow placeholders.
    const next = findNextEvent(timeline, now, tz, baseTimings, safetyOffsets, iqamaSet, todayISO);

    return {
      tz,
      todayISO,
      baseTimings,
      safetyOffsets,
      iqamaSet: {
        id: iqamaSet?.id || "main",
        label: safeJson(iqamaSet?.label, {}),
        offsets: safeJson(iqamaSet?.offsets, {}),
        fixedTimes: fixedTimes,
      },
      times: {
        base: baseDates,
        adhanSafe,
        iqama,
      },
      next,
    };
  }

  function findNextEvent(timeline, now, tz, baseTimings, safetyOffsets, iqamaSet, todayISO) {
    const future = timeline.find((e) => e.at.getTime() > now.getTime());
    if (future) return future;

    // Past all events today -> compute tomorrow fajr adhan/iqama approximately
    const tomorrowISO = isoDateInTZ(addDays(now, 1), tz);
    const fajrBase = dateFromHHMMInTZ(tomorrowISO, baseTimings.fajr, tz);
    const fajrAdhan = addMinutes(fajrBase, Math.max(0, numOr(safetyOffsets?.fajr, 0)));

    const fixedTimes = iqamaSet?.fixedTimes ? safeJson(iqamaSet.fixedTimes, {}) : null;
    let fajrIqama;
    if (fixedTimes?.fajr) {
      fajrIqama = dateFromHHMMInTZ(tomorrowISO, fixedTimes.fajr, tz);
    } else {
      const off = Math.max(0, numOr(iqamaSet?.offsets?.fajr, 0));
      fajrIqama = addMinutes(fajrAdhan, off);
    }
    if (fajrIqama.getTime() < fajrAdhan.getTime()) fajrIqama = new Date(fajrAdhan.getTime());

    // Choose next event as fajr adhan (and show meta)
    return { kind: "adhan", prayer: "fajr", at: fajrAdhan, _tomorrow: true, _tomorrowIqama: fajrIqama };
  }

  // ---------- Rendering ----------
  function renderAll() {
    renderMasjidHeader();
    renderIqamaSelect();
    renderTable();
    renderNextCard();
    renderMethodDetails();
    renderSafetyDetails();
  }

  function renderMasjidHeader() {
    if (!state.masjid) return;
    const name = pickLang(state.masjid.name, state.lang) || t("masjid") || "Masjid";
    const city = state.masjid.city ? pickLang(state.masjid.city, state.lang) : null;

    el.masjidName.textContent = name;
    el.masjidCity.textContent = city || "—";
  }

  function renderMethodDetails() {
    if (!state.masjid) return;
    const m = state.masjid.calc_method || DEFAULT_METHOD;

    el.methodBadge.textContent = `Method: ${numOr(m.methodId, 2)}`;
    el.calcProvider.textContent = m.provider || "aladhan";
    el.calcMethodId.textContent = String(numOr(m.methodId, 2));
    el.calcSchool.textContent = (m.school || "standard").toLowerCase();
    el.calcHighLat.textContent = (m.highLatRule || "angleBased").toLowerCase();

    const tuneObj = safeJson(m.tune, {});
    const tuneStr = Object.keys(tuneObj).length ? JSON.stringify(tuneObj) : "—";
    el.calcTune.textContent = tuneStr;
  }

  function renderSafetyDetails() {
    if (!state.masjid) return;
    for (const p of PRAYERS) {
      const node = document.querySelector(`[data-safety="${p}"]`);
      if (node) node.textContent = `${Math.max(0, numOr(state.masjid.safety_offsets?.[p], 0))} min`;
    }
  }

  function loadIqamaSets() {
    state.iqamaSets = [];
    const sets = state.masjid?.iqama_sets || [];
    for (const raw of sets) {
      const obj = safeJson(raw, {});
      const id = (obj.id || "").trim();
      if (!id) continue;
      state.iqamaSets.push({
        id,
        label: safeJson(obj.label, {}),
        offsets: safeJson(obj.offsets, {}),
        fixedTimes: obj.fixedTimes ? safeJson(obj.fixedTimes, {}) : null,
      });
    }
    if (!state.iqamaSets.length) {
      // fallback
      state.iqamaSets = [
        {
          id: "main",
          label: { tr: "Ana Cemaat", en: "Main Congregation" },
          offsets: { fajr: 20, dhuhr: 10, asr: 10, maghrib: 5, isha: 15 },
          fixedTimes: null,
        },
      ];
    }
  }

  function pickInitialIqamaSet() {
    const byId = state.setId
      ? state.iqamaSets.find((s) => s.id === state.setId)
      : null;
    state.iqamaSet = byId || state.iqamaSets[0];
  }

  function renderIqamaSelect() {
    if (!el.iqamaSetSelect) return;
    const sel = el.iqamaSetSelect;
    sel.innerHTML = "";

    for (const s of state.iqamaSets) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = pickLang(s.label, state.lang) || s.id;
      if (state.iqamaSet?.id === s.id) opt.selected = true;
      sel.appendChild(opt);
    }

    sel.onchange = () => {
      const id = sel.value;
      const chosen = state.iqamaSets.find((x) => x.id === id);
      if (!chosen) return;
      state.iqamaSet = chosen;

      // Update URL param set
      const url = new URL(location.href);
      url.searchParams.set("m", state.slug);
      url.searchParams.set("set", chosen.id);
      history.replaceState({}, "", url.toString());
      setShareLink(url.toString());

      // Refresh computations
      refreshAll({ preferCache: true }).catch((e) => showNotice(e.message, "error"));
    };
  }

  function renderTable() {
    const c = state.computed;
    if (!c) return;

    const now = new Date();
    const rows = document.querySelectorAll("#timesTable tbody tr[data-prayer]");
    rows.forEach((tr) => tr.classList.remove("is-active"));

    for (const p of PRAYERS) {
      const tr = document.querySelector(`#timesTable tbody tr[data-prayer="${p}"]`);
      if (!tr) continue;

      const ad = c.times.adhanSafe[p];
      const iq = c.times.iqama[p];

      const tds = tr.querySelectorAll("td");
      // Order: Adhan, Iqama, Status
      if (tds[0]) tds[0].textContent = fmtTime(ad, c.tz);
      if (tds[1]) tds[1].textContent = fmtTime(iq, c.tz);

      const statusTd = tds[2];
      if (statusTd) {
        const status = computeRowStatus(now, ad, iq);
        statusTd.textContent = status.text;
        statusTd.className = status.className;
      }

      // Highlight current/next prayer row (based on next adhan)
      const next = c.next;
      if (next?.prayer === p) tr.classList.add("is-active");
    }
  }

  function computeRowStatus(now, adhan, iqama) {
    const n = now.getTime();
    const a = adhan.getTime();
    const i = iqama.getTime();

    if (n < a) return { text: `${t("startsIn")}: ${fmtDelta(a - n)}`, className: "muted" };
    if (n >= a && n < i) return { text: `${t("adhanPassed")}`, className: "" };
    return { text: `${t("passed")}`, className: "muted" };
  }

  function renderNextCard() {
    const c = state.computed;
    if (!c?.next) return;

    const next = c.next;
    const prayerLabel = pickLang(PRAYER_LABELS[next.prayer], state.lang) || next.prayer;

    el.nextPrayerLabel.textContent = prayerLabel;
    el.nextPrayerTime.textContent = fmtTime(next.at, c.tz);

    const typeText =
      next.kind === "adhan"
        ? t("adhan") || "Adhan"
        : t("iqama") || "Iqama";
    el.nextTypePill.textContent = typeText;

    const metaParts = [];
    if (next._tomorrow) metaParts.push(t("tomorrow") || "Tomorrow");
    if (state.locationLabel) metaParts.push(state.locationLabel);
    el.nextMeta.textContent = metaParts.join(" • ") || "—";

    // Countdown will be updated by loop
    updateCountdown();
  }

  function showFreshnessBadge() {
    const info = state.lastFetchInfo;
    if (!info?.at) return;
    const ago = Date.now() - info.at.getTime();
    const min = Math.max(0, Math.floor(ago / 60000));
    el.dataFreshnessBadge.textContent =
      info.source === "cache"
        ? `${t("cached") || "Cached"} • ${min}m`
        : `${t("live") || "Live"} • ${min}m`;
  }

  // ---------- Countdown ----------
  function startCountdownLoop() {
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(() => {
      updateCountdown();
      showFreshnessBadge();
    }, COUNTDOWN_TICK_MS);
  }

  function updateCountdown() {
    const c = state.computed;
    if (!c?.next) return;

    const now = new Date();
    const diff = c.next.at.getTime() - now.getTime();
    if (diff <= 0) {
      el.countdown.textContent = "00:00:00";
      // Debounced refresh soon after passing
      scheduleSoftRefresh();
      return;
    }
    el.countdown.textContent = fmtHMS(diff);
  }

  function scheduleSoftRefresh() {
    if (state.refreshTimer) return;
    state.refreshTimer = setTimeout(() => {
      state.refreshTimer = null;
      refreshAll({ preferCache: false }).catch((e) => showNotice(e.message, "error"));
    }, 2500);
  }

  // ---------- UI wiring ----------
  function wireLanguage() {
    if (el.langToggleBtn) {
      el.langToggleBtn.addEventListener("click", () => {
        state.lang = state.lang === "tr" ? "en" : "tr";
        localStorage.setItem("prayerhub_lang", state.lang);
        applyLanguage(state.lang);
        renderAll();
      });
    }
  }

  function wireShare() {
    const handler = async () => {
      const link = el.shareLinkInput?.value || location.href;
      try {
        await navigator.clipboard.writeText(link);
        showNotice(t("copied") || "Copied!", "info");
      } catch {
        // fallback
        if (el.shareLinkInput) {
          el.shareLinkInput.focus();
          el.shareLinkInput.select();
          document.execCommand("copy");
          showNotice(t("copied") || "Copied!", "info");
        }
      }
    };

    el.copyLinkBtn?.addEventListener("click", handler);
    el.copyLinkBtn2?.addEventListener("click", handler);
  }

  function wireSlugGate() {
    el.openSlugBtn?.addEventListener("click", () => {
      const slug = (el.slugInput?.value || "").trim();
      if (!slug) return showNotice(t("enterSlug") || "Please enter a slug.", "info");
      const url = new URL(location.href);
      url.searchParams.set("m", slug);
      location.href = url.toString();
    });

    // Enter key support
    el.slugInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") el.openSlugBtn?.click();
    });
  }

  function wireRefresh() {
    el.refreshBtn?.addEventListener("click", () => {
      refreshAll({ preferCache: false }).catch((e) => showNotice(e.message, "error"));
    });

    el.useLocationBtn?.addEventListener("click", async () => {
      const ok = await tryGeolocation();
      if (!ok) {
        el.manualLocationDetails.open = true;
        showNotice(t("locManual") || "Location blocked — enter city/address.", "info");
        return;
      }
      refreshAll({ preferCache: false }).catch((e) => showNotice(e.message, "error"));
    });

    el.iqamaSetSelect?.addEventListener("change", () => {
      // handled in renderIqamaSelect
    });
  }

  function wireManualLocation() {
    el.manualLocationBtn?.addEventListener("click", async () => {
      const q = (el.manualLocationInput?.value || "").trim();
      try {
        state.manualLocation = q;
        await resolveManualLocation(q);
        await refreshAll({ preferCache: false });
      } catch (e) {
        showNotice(e.message || "Manual location failed.", "error");
      }
    });

    el.manualLocationInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") el.manualLocationBtn?.click();
    });
  }

  function wireNotice() {
    el.noticeClose?.addEventListener("click", clearNotice);
  }

  // ---------- Language (TR/EN) ----------
  function loadI18n() {
    const dictEl = document.getElementById("i18nDict");
    if (!dictEl) return { tr: {}, en: {} };
    try {
      return JSON.parse(dictEl.textContent || "{}");
    } catch {
      return { tr: {}, en: {} };
    }
  }

  function detectInitialLang() {
    const saved = localStorage.getItem("prayerhub_lang");
    if (saved === "tr" || saved === "en") return saved;
    const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.startsWith("en")) return "en";
    return "tr";
  }

  function applyLanguage(lang) {
    el.root.setAttribute("lang", lang);
    el.root.setAttribute("data-lang", lang);

    // Replace elements with data-i18n
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      const val = i18n?.[lang]?.[key];
      if (typeof val === "string") node.textContent = val;
    });

    // Update placeholders that are language-sensitive (optional)
    if (el.slugInput) {
      el.slugInput.placeholder = lang === "en" ? "e.g. sanjose-umut-mescid" : "ör: sanjose-umut-mescid";
    }
    if (el.manualLocationInput) {
      el.manualLocationInput.placeholder = lang === "en" ? "e.g. San Jose, CA" : "ör: San Jose, CA";
    }
  }

  function t(key) {
    return i18n?.[state.lang]?.[key] || i18n?.tr?.[key] || "";
  }

  // Add a few runtime-only translations (keys not in HTML dict)
  // (keeps HTML minimal; still TR/EN ready)
  i18n.tr = Object.assign(
    {
      loadingMasjid: "Mescid profili yükleniyor…",
      locResolving: "Konum alınıyor…",
      locManual: "Konum kapalı — şehir/adres gir.",
      locSearching: "Konum aranıyor…",
      locNotFound: "Konum bulunamadı.",
      geoUnsupported: "Tarayıcı konum özelliğini desteklemiyor.",
      enterCity: "Şehir/adres gir.",
      enterSlug: "Slug gir.",
      needLocation: "Konum izni ver veya şehir/adres gir.",
      startsIn: "Başlar",
      adhanPassed: "Adhan geçti",
      passed: "Geçti",
      adhan: "Adhan",
      iqama: "İkame",
      tomorrow: "Yarın",
      copied: "Kopyalandı!",
      cached: "Önbellek",
      live: "Canlı",
    },
    i18n.tr || {}
  );

  i18n.en = Object.assign(
    {
      loadingMasjid: "Loading masjid profile…",
      locResolving: "Getting location…",
      locManual: "Location blocked — enter city/address.",
      locSearching: "Searching location…",
      locNotFound: "Location not found.",
      geoUnsupported: "Geolocation is not supported in this browser.",
      enterCity: "Enter a city/address.",
      enterSlug: "Enter a slug.",
      needLocation: "Allow location or enter a city/address.",
      startsIn: "Starts",
      adhanPassed: "Adhan passed",
      passed: "Passed",
      adhan: "Adhan",
      iqama: "Iqama",
      tomorrow: "Tomorrow",
      copied: "Copied!",
      cached: "Cached",
      live: "Live",
    },
    i18n.en || {}
  );

  // ---------- Helpers ----------
  function $(sel) {
    return document.querySelector(sel);
  }

  function showNotice(text, type = "info") {
    if (!el.notice || !el.noticeText) return;
    el.notice.hidden = false;
    el.noticeText.textContent = text;

    // tint via background only (CSS already uses danger color);
    // we keep it simple: add data-type for future styling
    el.notice.dataset.type = type;
  }

  function clearNotice() {
    if (!el.notice) return;
    el.notice.hidden = true;
    el.noticeText.textContent = "";
    delete el.notice.dataset.type;
  }

  function setTodayDate() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const d = new Date();
    el.todayDate.textContent = d.toLocaleDateString(state.lang === "en" ? "en-US" : "tr-TR", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
      timeZone: tz,
    });
  }

  function setShareLink(link) {
    if (el.shareLinkInput) el.shareLinkInput.value = link || "";
  }

  function makeShareLink(slug, setId) {
    const url = new URL(location.href);
    url.searchParams.set("m", slug);
    if (setId) url.searchParams.set("set", setId);
    else url.searchParams.delete("set");
    return url.toString();
  }

  function pickLang(obj, lang) {
    const o = safeJson(obj, {});
    return o?.[lang] || o?.tr || o?.en || "";
  }

  function safeJson(v, fallback = {}) {
    if (v == null) return fallback;
    if (typeof v === "object") return v;
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  }

  function numOr(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeHHMM(s) {
    if (!s) return "00:00";
    // AlAdhan sometimes returns "05:12 (PDT)" -> strip
    const m = String(s).match(/(\d{1,2}):(\d{2})/);
    if (!m) return "00:00";
    const hh = String(m[1]).padStart(2, "0");
    const mm = String(m[2]).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function isoDateInTZ(date, tz) {
    // YYYY-MM-DD in a specific timezone using Intl parts
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    return `${y}-${m}-${d}`;
  }

  function dateFromHHMMInTZ(isoDate, hhmm, tz) {
    // Create a Date representing isoDate + hh:mm in tz.
    // We build a "wall clock" date then convert by comparing formatted parts.
    // This is a common workaround without moment/luxon.
    const [H, M] = (hhmm || "00:00").split(":").map((x) => parseInt(x, 10));
    const [y, mo, d] = isoDate.split("-").map((x) => parseInt(x, 10));

    // Start with UTC date at same components, then shift to match tz wall clock.
    const approx = new Date(Date.UTC(y, mo - 1, d, H || 0, M || 0, 0));

    // Compute the timezone offset at that wall-clock moment by formatting
    // and comparing back to intended components.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(approx);

    const yy = parseInt(parts.find((p) => p.type === "year")?.value || "0", 10);
    const mm = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10);
    const dd = parseInt(parts.find((p) => p.type === "day")?.value || "1", 10);
    const hh = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const mi = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

    // difference in minutes between intended and formatted (in tz)
    const intendedUTC = Date.UTC(y, mo - 1, d, H || 0, M || 0, 0);
    const gotUTC = Date.UTC(yy, mm - 1, dd, hh, mi, 0);

    const deltaMin = Math.round((intendedUTC - gotUTC) / 60000);
    return new Date(approx.getTime() + deltaMin * 60000);
  }

  function fmtTime(date, tz) {
    return new Intl.DateTimeFormat(state.lang === "en" ? "en-US" : "tr-TR", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  function addDays(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60000);
  }

  function fmtHMS(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function fmtDelta(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }

  function makeCacheKey({ slug, date, tz, coords, manual, setId, lang }) {
    const loc = coords ? `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}` : `manual:${manual || ""}`;
    return `prayerhub:v1:${slug}:${date}:${tz}:${setId}:${lang}:${loc}`;
  }

  function readCache(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj?.savedAt) return null;
      const age = Date.now() - new Date(obj.savedAt).getTime();
      if (age > CACHE_TTL_MS) return null;
      return obj;
    } catch {
      return null;
    }
  }

  function writeCache(key, payload) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          ...payload,
        })
      );
    } catch {
      // ignore storage quota issues
    }
  }
})();
