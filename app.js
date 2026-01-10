// app.js
// Masjid Prayer Times + Iqama
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

  const METHOD_OPTIONS = [
    { id: 1, label: { tr: "Karachi (1)", en: "Karachi (1)" } },
    { id: 2, label: { tr: "ISNA (2)", en: "ISNA (2)" } },
    { id: 3, label: { tr: "MWL (3)", en: "MWL (3)" } },
    { id: 4, label: { tr: "Umm Al-Qura (4)", en: "Umm Al-Qura (4)" } },
    { id: 5, label: { tr: "Egypt (5)", en: "Egypt (5)" } },
    { id: 7, label: { tr: "Tehran (7)", en: "Tehran (7)" } },
    { id: 8, label: { tr: "Gulf (8)", en: "Gulf (8)" } },
    { id: 9, label: { tr: "Kuwait (9)", en: "Kuwait (9)" } },
    { id: 10, label: { tr: "Qatar (10)", en: "Qatar (10)" } },
    { id: 11, label: { tr: "Singapore (11)", en: "Singapore (11)" } },
    { id: 12, label: { tr: "UOIF (12)", en: "UOIF (12)" } },
    { id: 13, label: { tr: "Diyanet (13)", en: "Diyanet (13)" } },
    { id: 14, label: { tr: "Moonsighting (14)", en: "Moonsighting (14)" } },
  ];

  const DEFAULT_METHOD = {
    provider: "aladhan",
    methodId: 2,
    school: "standard", // "hanafi" or "standard"
    highLatRule: "angleBased", // angleBased|midnight|oneSeventh
    tune: {},
  };

  const STORAGE_KEYS = {
    lang: "prayerhub_lang",
    methodGlobal: "prayerhub:method:global",
    methodSlug: (slug) => `prayerhub:method:${slug}`,
    savedLocations: "prayerhub:saved_locations",
    masjidCache: (slug) => `prayerhub:masjid:${slug}`,
    timingsCache: (key) => `prayerhub:timings:${key}`,
  };

  const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
  const MASJID_CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes
  const TIMINGS_CACHE_TTL_MS = 1000 * 60 * 60; // 60 minutes
  const COUNTDOWN_TICK_MS = 1000;
  const RETRY_LIMIT = 2;

  // ---------- DOM ----------
  const el = {
    root: document.documentElement,

    // header
    masjidName: $("#masjidName"),
    masjidCity: $("#masjidCity"),
    todayDate: $("#todayDate"),

    langToggleBtn: $("#langToggleBtn"),
    langToggleBtn2: $("#langToggleBtn2"),
    copyLinkBtn: $("#copyLinkBtn"),
    copyLinkBtn2: $("#copyLinkBtn2"),
    shareLinkInput: $("#shareLinkInput"),
    settingsBtn: $("#settingsBtn"),

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
    nextIqamaLine: $("#nextIqamaLine"),
    countdown: $("#countdown"),
    refreshBtn: $("#refreshBtn"),
    useLocationBtn: $("#useLocationBtn"),
    locationStatus: $("#locationStatus"),
    providerStatus: $("#providerStatus"),
    iqamaSetSelect: $("#iqamaSetSelect"),
    iqamaSetWrap: $("#iqamaSetWrap"),
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
    safetyNote: $("#safetyNote"),

    // settings modal
    settingsModal: $("#settingsModal"),
    settingsCloseBtn: $("#settingsCloseBtn"),
    methodSelect: $("#methodSelect"),
    schoolSelect: $("#schoolSelect"),
    highLatSelect: $("#highLatSelect"),
    resetMethodBtn: $("#resetMethodBtn"),
    methodScopeNote: $("#methodScopeNote"),

    savedLocationsSelect: $("#savedLocationsSelect"),
    useSavedLocationBtn: $("#useSavedLocationBtn"),
    removeSavedLocationBtn: $("#removeSavedLocationBtn"),
    saveLocationLabelInput: $("#saveLocationLabelInput"),
    saveLocationBtn: $("#saveLocationBtn"),

    // action bar
    actionRefreshBtn: $("#actionRefreshBtn"),
    actionLocationBtn: $("#actionLocationBtn"),
    actionSettingsBtn: $("#actionSettingsBtn"),
  };

  const i18n = loadI18n();

  // ---------- State ----------
  const state = {
    lang: detectInitialLang(),
    supabase: null,

    slug: null,
    setId: null,

    masjid: null,
    iqamaSet: null,
    iqamaSets: [],

    methodOverride: null,

    coords: null,
    locationLabel: null,
    locationSource: null,
    manualLocation: null,

    savedLocations: [],

    computed: null,

    countdownTimer: null,
    refreshTimer: null,

    lastFetchInfo: {
      source: null,
      at: null,
    },

    timingsCacheKey: null,
  };

  // ---------- Init ----------
  boot().catch((err) => {
    console.error(err);
    showNotice(err?.message || "Unexpected error", "error");
  });

  async function boot() {
    wireLanguage();
    wireShare();
    wireSlugGate();
    wireRefresh();
    wireManualLocation();
    wireNotice();
    wireSettings();
    wireSavedLocations();

    applyLanguage(state.lang);

    const params = new URLSearchParams(location.search);
    state.slug = (params.get("m") || "").trim() || null;
    state.setId = (params.get("set") || "").trim() || null;

    if (!state.slug) {
      el.slugGate.hidden = false;
    }

    if (state.slug) {
      state.supabase = createSupabaseClient();
      if (state.supabase) {
        await loadMasjid(state.slug);
      }
    }

    if (!state.masjid) {
      state.masjid = buildDefaultMasjid();
    }

    loadSavedLocations();
    hydrateMethodOverride();
    renderMethodOptions();
    renderMethodControls();

    setTodayDate(state.masjid.timezone);
    renderMasjidHeader();
    loadIqamaSets();
    pickInitialIqamaSet();
    renderIqamaSelect();
    setShareLink(makeShareLink(state.slug, state.iqamaSet?.id));

    await resolveLocation();

    await refreshAll({ preferCache: true });

    startCountdownLoop();
  }

  // ---------- Supabase ----------
  function createSupabaseClient() {
    const url = window.__SUPABASE_URL || "";
    const key = window.__SUPABASE_ANON_KEY || "";
    if (!url || !key) {
      showNotice(
        t("supabaseMissing") ||
          "Supabase config missing. Fill __SUPABASE_URL and __SUPABASE_ANON_KEY in index.html.",
        "error"
      );
      return null;
    }

    if (!window.supabase?.createClient) {
      showNotice(t("supabaseMissingScript") || "Supabase JS client not found.", "error");
      return null;
    }
    return window.supabase.createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  async function loadMasjid(slug) {
    showNotice(t("loadingMasjid") || "Loading masjid profile…", "info");

    const cached = readMasjidCache(slug);
    if (cached) {
      state.masjid = cached;
      renderMasjidHeader();
    }

    try {
      const { data, error } = await state.supabase
        .schema("prayer_hub")
        .from("masjids")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) {
        throw new Error(error.message);
      }
      if (!data) {
        throw new Error(t("masjidNotFound") || `Masjid not found for slug: ${slug}`);
      }

      state.masjid = normalizeMasjid(data);
      writeMasjidCache(slug, state.masjid);
      renderMasjidHeader();
      renderMethodDetails();
      loadIqamaSets();
      pickInitialIqamaSet();
      renderIqamaSelect();
      clearNotice();
    } catch (err) {
      console.warn("Masjid load failed:", err?.message);
      showNotice(t("masjidNotFound") || "Masjid not found. Check the link or slug.", "error");
      state.slug = null;
      state.setId = null;
      el.slugGate.hidden = false;
      state.masjid = null;
    }
  }

  function buildDefaultMasjid() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      id: null,
      slug: null,
      name: { tr: "Namaz Vakitleri", en: "Prayer Times" },
      city: null,
      timezone: tz,
      calc_method: { ...DEFAULT_METHOD },
      safety_offsets: clampSafetyOffsets({}),
      iqama_sets: [],
      meta: {},
      is_public: true,
    };
  }

  function normalizeMasjid(row) {
    const name = safeJson(row.name);
    const city = row.city ? safeJson(row.city) : null;

    return {
      id: row.id,
      slug: row.slug,
      name,
      city,
      timezone: row.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
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

  // ---------- Overrides ----------
  async function loadOverridesForDay(isoDate) {
    if (!state.supabase || !state.masjid?.id) return [];

    const { data, error } = await state.supabase
      .schema("prayer_hub")
      .from("overrides")
      .select("kind,payload")
      .eq("masjid_id", state.masjid.id)
      .eq("day", isoDate);

    if (error) {
      console.warn("Overrides fetch failed:", error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  }

  function applyOverridesToConfig(baseMasjid, overrides) {
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
    }

    return masjid;
  }

  function applyIqamaOverrideForSet(iqamaSet, overrides) {
    const set = structuredClone(iqamaSet || {});
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
    updateLocationStatus("resolving");

    const ok = await tryGeolocation();
    if (ok) return;

    el.manualLocationDetails.open = true;
    updateLocationStatus("blocked");
  }

  async function tryGeolocation() {
    if (!navigator.geolocation) {
      showNotice(t("geoUnsupported") || "Geolocation is not supported in this browser.", "error");
      updateLocationStatus("blocked");
      return false;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          state.coords = { lat, lon };
          state.locationLabel = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
          state.locationSource = "gps";
          updateLocationStatus("gps");
          resolve(true);
        },
        (err) => {
          console.warn("Geolocation error:", err?.message);
          updateLocationStatus("blocked");
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  async function resolveManualLocation(text) {
    const q = (text || "").trim();
    if (!q) throw new Error(t("enterCity") || "Please enter a city/address.");

    updateLocationStatus("searching");

    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(q);

    const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Geocoding failed (${res.status}).`);
    const arr = await res.json();
    if (!Array.isArray(arr) || !arr[0]) throw new Error(t("locNotFound") || "Location not found.");

    const lat = parseFloat(arr[0].lat);
    const lon = parseFloat(arr[0].lon);
    if (!isFinite(lat) || !isFinite(lon)) throw new Error(t("locNotFound") || "Location not found.");

    state.coords = { lat, lon };
    state.locationLabel = arr[0].display_name || q;
    state.locationSource = "manual";
    state.manualLocation = q;
    updateLocationStatus("manual");
  }

  function updateLocationStatus(mode) {
    const map = {
      resolving: t("locResolving") || "Resolving location…",
      gps: t("locUsingGps") || "Using GPS",
      manual: t("locUsingManual") || "Using manual city",
      saved: t("locUsingSaved") || "Using saved location",
      blocked: t("locBlocked") || "Location not allowed",
      searching: t("locSearching") || "Searching…",
    };
    el.locationStatus.textContent = map[mode] || "—";
  }

  // ---------- Prayer Times Fetch ----------
  async function refreshAll({ preferCache }) {
    if (!state.masjid) return;

    const tz = state.masjid.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    el.tzBadge.textContent = `TZ: ${tz}`;

    const todayISO = isoDateInTZ(new Date(), tz);
    const tomorrowISO = isoDateInTZ(addDays(new Date(), 1), tz);

    const cachedMethod = getActiveMethod();
    state.timingsCacheKey = makeTimingsCacheKey({
      date: todayISO,
      tz,
      coords: state.coords,
      method: cachedMethod,
    });

    const cachedTimings = preferCache ? readTimingsCache(state.timingsCacheKey) : null;

    if (cachedTimings) {
      state.computed = computeSchedule({
        tz,
        baseTimings: cachedTimings.today,
        tomorrowTimings: cachedTimings.tomorrow,
        safetyOffsets: state.masjid.safety_offsets,
        iqamaSet: state.iqamaSet,
      });
      state.lastFetchInfo = { source: "cache", at: new Date(cachedTimings.savedAt) };
      renderAll();
      showFreshnessBadge();
    }

    if (!state.coords) {
      showNotice(t("needLocation") || "Please allow location or enter a city/address.", "info");
      return;
    }

    let overridesToday = [];
    let overridesTomorrow = [];
    try {
      overridesToday = await loadOverridesForDay(todayISO);
      overridesTomorrow = await loadOverridesForDay(tomorrowISO);
    } catch {
      overridesToday = [];
      overridesTomorrow = [];
    }

    const masjidForToday = applyOverridesToConfig(state.masjid, overridesToday);
    const masjidForTomorrow = applyOverridesToConfig(state.masjid, overridesTomorrow);
    const iqamaSetForToday = applyIqamaOverrideForSet(state.iqamaSet, overridesToday);
    const iqamaSetForTomorrow = applyIqamaOverrideForSet(state.iqamaSet, overridesTomorrow);

    try {
      const methodForFetch = getActiveMethod(masjidForToday.calc_method);
      state.timingsCacheKey = makeTimingsCacheKey({
        date: todayISO,
        tz,
        coords: state.coords,
        method: methodForFetch,
      });

      const live = await fetchTimingsRange({
        tz,
        coords: state.coords,
        method: methodForFetch,
      });

      const computed = computeSchedule({
        tz,
        baseTimings: live.today,
        tomorrowTimings: live.tomorrow,
        safetyOffsets: masjidForToday.safety_offsets,
        iqamaSet: iqamaSetForToday,
        tomorrowSafetyOffsets: masjidForTomorrow.safety_offsets,
        tomorrowIqamaSet: iqamaSetForTomorrow,
      });

      state.computed = computed;
      state.lastFetchInfo = { source: "live", at: new Date() };

      writeTimingsCache(state.timingsCacheKey, live);
      renderAll();
      showFreshnessBadge();
      clearNotice();
    } catch (err) {
      console.error(err);
      if (!cachedTimings) {
        showNotice(err?.message || "Prayer API failed.", "error");
      } else {
        showNotice(t("usingCache") || "Using cached data (live fetch failed).", "info");
      }
    }
  }

  async function fetchTimingsRange({ tz, coords, method }) {
    const today = await fetchTimingsAlAdhan({
      date: new Date(),
      tz,
      coords,
      method,
    });
    const tomorrow = await fetchTimingsAlAdhan({
      date: addDays(new Date(), 1),
      tz,
      coords,
      method,
    });
    return { today: today.timings, tomorrow: tomorrow.timings };
  }

  async function fetchTimingsAlAdhan({ date, tz, coords, method }) {
    const ts = Math.floor(date.getTime() / 1000);

    const school = (method.school || "standard").toLowerCase() === "hanafi" ? 1 : 0;
    const latAdj = mapHighLatRule(method.highLatRule);
    const tune = safeJson(method.tune, {});
    const tuneParam = buildAlAdhanTune(tune);

    const url = new URL(`https://api.aladhan.com/v1/timings/${ts}`);
    url.searchParams.set("latitude", String(coords.lat));
    url.searchParams.set("longitude", String(coords.lon));
    url.searchParams.set("method", String(numOr(method.methodId, 2)));
    url.searchParams.set("school", String(school));
    url.searchParams.set("latitudeAdjustmentMethod", String(latAdj));
    url.searchParams.set("timezonestring", tz);
    if (tuneParam) url.searchParams.set("tune", tuneParam);

    el.providerStatus.textContent = `AlAdhan • method ${numOr(method.methodId, 2)}`;

    const res = await fetchWithRetry(url.toString());
    if (!res.ok) {
      throw new Error(`Prayer API failed (${res.status}).`);
    }
    const json = await res.json();
    const timings = json?.data?.timings;
    if (!timings) throw new Error("Prayer API returned invalid response.");

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
    const r = (rule || "angleBased").toLowerCase();
    if (r === "midnight") return 1;
    if (r === "oneseventh" || r === "one_seventh" || r === "one-seventh") return 2;
    return 3;
  }

  function buildAlAdhanTune(tune) {
    if (typeof tune?.aladhan_tune === "string" && tune.aladhan_tune.trim()) {
      return tune.aladhan_tune.trim();
    }
    const F = numOr(tune.fajr, 0);
    const D = numOr(tune.dhuhr, 0);
    const A = numOr(tune.asr, 0);
    const M = numOr(tune.maghrib, 0);
    const I = numOr(tune.isha, 0);

    const any = [F, D, A, M, I].some((x) => x !== 0);
    if (!any) return "";

    return [0, Math.floor(F), 0, Math.floor(D), Math.floor(A), 0, Math.floor(M), Math.floor(I), 0].join(",");
  }

  // ---------- Computation ----------
  function computeSchedule({
    tz,
    baseTimings,
    tomorrowTimings,
    safetyOffsets,
    iqamaSet,
    tomorrowSafetyOffsets,
    tomorrowIqamaSet,
  }) {
    const now = new Date();
    const todayISO = isoDateInTZ(now, tz);

    const baseDates = {};
    for (const p of PRAYERS) {
      baseDates[p] = dateFromHHMMInTZ(todayISO, baseTimings[p], tz);
    }

    const adhanSafe = {};
    for (const p of PRAYERS) {
      const min = Math.max(0, numOr(safetyOffsets?.[p], 0));
      adhanSafe[p] = addMinutes(baseDates[p], min);
    }

    const iqama = {};
    const hasIqama = Boolean(iqamaSet);
    const offsets = safeJson(iqamaSet?.offsets, {});
    const fixedTimes = iqamaSet?.fixedTimes ? safeJson(iqamaSet.fixedTimes, {}) : null;

    for (const p of PRAYERS) {
      if (!hasIqama) {
        iqama[p] = null;
        continue;
      }
      let iq = null;
      const ft = fixedTimes?.[p];
      if (typeof ft === "string" && ft.trim()) {
        iq = dateFromHHMMInTZ(todayISO, ft.trim(), tz);
      } else {
        const off = Math.max(0, numOr(offsets?.[p], 0));
        iq = addMinutes(adhanSafe[p], off);
      }
      if (iq.getTime() < adhanSafe[p].getTime()) iq = new Date(adhanSafe[p].getTime());
      iqama[p] = iq;
    }

    const timeline = [];
    for (const p of PRAYERS) {
      timeline.push({ kind: "adhan", prayer: p, at: adhanSafe[p] });
      if (hasIqama && iqama[p]) timeline.push({ kind: "iqama", prayer: p, at: iqama[p] });
    }
    timeline.sort((a, b) => a.at - b.at);

    const next = findNextEvent({
      timeline,
      now,
      tz,
      baseTimings,
      safetyOffsets,
      iqamaSet,
      tomorrowTimings,
      tomorrowSafetyOffsets,
      tomorrowIqamaSet,
    });

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

  function findNextEvent({
    timeline,
    now,
    tz,
    baseTimings,
    safetyOffsets,
    iqamaSet,
    tomorrowTimings,
    tomorrowSafetyOffsets,
    tomorrowIqamaSet,
  }) {
    const future = timeline.find((e) => e.at.getTime() > now.getTime());
    if (future) {
      return {
        ...future,
        adhanAt: timeline.find((t) => t.prayer === future.prayer && t.kind === "adhan")?.at,
        iqamaAt: timeline.find((t) => t.prayer === future.prayer && t.kind === "iqama")?.at,
      };
    }

    const tomorrowISO = isoDateInTZ(addDays(now, 1), tz);
    const useTimings = tomorrowTimings || baseTimings;
    const fajrBase = dateFromHHMMInTZ(tomorrowISO, useTimings.fajr, tz);
    const fajrAdhan = addMinutes(
      fajrBase,
      Math.max(0, numOr((tomorrowSafetyOffsets || safetyOffsets)?.fajr, 0))
    );

    const hasIqama = Boolean(tomorrowIqamaSet || iqamaSet);
    const fixedTimes = tomorrowIqamaSet?.fixedTimes
      ? safeJson(tomorrowIqamaSet.fixedTimes, {})
      : iqamaSet?.fixedTimes
      ? safeJson(iqamaSet.fixedTimes, {})
      : null;
    let fajrIqama = null;
    if (hasIqama) {
      if (fixedTimes?.fajr) {
        fajrIqama = dateFromHHMMInTZ(tomorrowISO, fixedTimes.fajr, tz);
      } else {
        const off = Math.max(0, numOr((tomorrowIqamaSet || iqamaSet)?.offsets?.fajr, 0));
        fajrIqama = addMinutes(fajrAdhan, off);
      }
      if (fajrIqama.getTime() < fajrAdhan.getTime()) fajrIqama = new Date(fajrAdhan.getTime());
    }

    return {
      kind: "adhan",
      prayer: "fajr",
      at: fajrAdhan,
      adhanAt: fajrAdhan,
      iqamaAt: fajrIqama,
      _tomorrow: true,
    };
  }

  // ---------- Rendering ----------
  function renderAll() {
    setTodayDate(state.masjid?.timezone);
    renderMasjidHeader();
    renderIqamaSelect();
    renderTable();
    renderNextCard();
    renderMethodDetails();
    renderSafetyDetails();
    renderSafetyNote();
    renderMethodControls();
    renderSavedLocations();
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
    const m = getActiveMethod();

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

  function renderSafetyNote() {
    if (!state.masjid) return;
    const offsets = state.masjid.safety_offsets || {};
    const hasSafety = PRAYERS.some((p) => numOr(offsets[p], 0) > 0);
    if (el.safetyNote) {
      el.safetyNote.textContent = hasSafety
        ? t("safetyNote") || "Displayed adhan times include safety offsets."
        : t("safetyNoteNone") || "Displayed adhan times have no safety offset.";
    }
  }

  function loadIqamaSets() {
    state.iqamaSets = [];
    if (!state.masjid?.iqama_sets?.length) {
      state.iqamaSets = [];
      return;
    }

    const sets = state.masjid.iqama_sets || [];
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
  }

  function pickInitialIqamaSet() {
    if (!state.iqamaSets.length) {
      state.iqamaSet = null;
      return;
    }
    const byId = state.setId ? state.iqamaSets.find((s) => s.id === state.setId) : null;
    state.iqamaSet = byId || state.iqamaSets[0];
  }

  function renderIqamaSelect() {
    if (!el.iqamaSetSelect) return;
    const sel = el.iqamaSetSelect;
    sel.innerHTML = "";

    if (!state.iqamaSets.length) {
      sel.disabled = true;
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "—";
      sel.appendChild(opt);
      if (el.iqamaSetWrap) el.iqamaSetWrap.classList.add("is-disabled");
      return;
    }

    sel.disabled = false;
    if (el.iqamaSetWrap) el.iqamaSetWrap.classList.remove("is-disabled");

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

      const url = new URL(location.href);
      if (state.slug) {
        url.searchParams.set("m", state.slug);
        url.searchParams.set("set", chosen.id);
        history.replaceState({}, "", url.toString());
      }
      setShareLink(makeShareLink(state.slug, chosen.id));

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
      if (tds[0]) tds[0].textContent = fmtTime(ad, c.tz);
      if (tds[1]) tds[1].textContent = iq ? fmtTime(iq, c.tz) : "—";

      const statusTd = tds[2];
      if (statusTd) {
        const status = computeRowStatus(now, ad, iq);
        statusTd.textContent = status.text;
        statusTd.className = status.className;
      }

      const next = c.next;
      if (next?.prayer === p) tr.classList.add("is-active");
    }
  }

  function computeRowStatus(now, adhan, iqama) {
    const n = now.getTime();
    const a = adhan.getTime();
    const i = iqama?.getTime?.() || a;

    if (n < a) return { text: `${t("startsIn")}: ${fmtDelta(a - n)}`, className: "status--upcoming" };
    if (n >= a && n < i) return { text: `${t("adhanPassed")}`, className: "status--current" };
    return { text: `${t("passed")}`, className: "status--passed" };
  }

  function renderNextCard() {
    const c = state.computed;
    if (!c?.next) return;

    const next = c.next;
    const prayerLabel = pickLang(PRAYER_LABELS[next.prayer], state.lang) || next.prayer;

    el.nextPrayerLabel.textContent = prayerLabel;
    el.nextPrayerTime.textContent = fmtTime(next.at, c.tz);

    const typeText = next.kind === "adhan" ? t("adhan") || "Adhan" : t("iqama") || "Iqama";
    el.nextTypePill.textContent = typeText;

    const metaParts = [];
    if (next._tomorrow) metaParts.push(t("tomorrow") || "Tomorrow");
    if (state.locationLabel) metaParts.push(state.locationLabel);
    el.nextMeta.textContent = metaParts.join(" • ") || "—";

    if (next.adhanAt) {
      const adhanText = fmtTime(next.adhanAt, c.tz);
      if (next.iqamaAt) {
        const iqamaText = fmtTime(next.iqamaAt, c.tz);
        el.nextIqamaLine.textContent = `${t("nextAdhan") || "Adhan"}: ${adhanText} • ${t("nextIqama") || "Iqama"}: ${iqamaText}`;
      } else {
        el.nextIqamaLine.textContent = `${t("nextAdhan") || "Adhan"}: ${adhanText}`;
      }
    } else {
      el.nextIqamaLine.textContent = "—";
    }

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
    const toggle = () => {
      state.lang = state.lang === "tr" ? "en" : "tr";
      localStorage.setItem(STORAGE_KEYS.lang, state.lang);
      applyLanguage(state.lang);
      renderAll();
      renderMethodOptions();
      renderMethodControls();
      renderSavedLocations();
    };

    el.langToggleBtn?.addEventListener("click", toggle);
    el.langToggleBtn2?.addEventListener("click", toggle);
  }

  function wireShare() {
    const handler = async () => {
      const link = el.shareLinkInput?.value || location.href;
      try {
        await navigator.clipboard.writeText(link);
        showNotice(t("copied") || "Copied!", "info");
      } catch {
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

    el.slugInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") el.openSlugBtn?.click();
    });
  }

  function wireRefresh() {
    const refresh = () => {
      refreshAll({ preferCache: false }).catch((e) => showNotice(e.message, "error"));
    };
    el.refreshBtn?.addEventListener("click", refresh);
    el.actionRefreshBtn?.addEventListener("click", refresh);

    const useLocation = async () => {
      const ok = await tryGeolocation();
      if (!ok) {
        el.manualLocationDetails.open = true;
        showNotice(t("locManual") || "Location blocked — enter city/address.", "info");
        return;
      }
      refreshAll({ preferCache: false }).catch((e) => showNotice(e.message, "error"));
    };
    el.useLocationBtn?.addEventListener("click", useLocation);
    el.actionLocationBtn?.addEventListener("click", useLocation);
  }

  function wireManualLocation() {
    const debouncedSearch = debounceAsync(async (q) => {
      state.manualLocation = q;
      await resolveManualLocation(q);
      await refreshAll({ preferCache: false });
    }, 500);

    el.manualLocationBtn?.addEventListener("click", async () => {
      const q = (el.manualLocationInput?.value || "").trim();
      try {
        await debouncedSearch(q);
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

  function wireSettings() {
    const open = () => {
      if (!el.settingsModal) return;
      el.settingsModal.hidden = false;
    };
    const close = () => {
      if (!el.settingsModal) return;
      el.settingsModal.hidden = true;
    };

    el.settingsBtn?.addEventListener("click", open);
    el.actionSettingsBtn?.addEventListener("click", open);
    el.settingsCloseBtn?.addEventListener("click", close);
    el.settingsModal?.querySelector("[data-close='settings']")?.addEventListener("click", close);

    el.methodSelect?.addEventListener("change", onMethodChange);
    el.schoolSelect?.addEventListener("change", onMethodChange);
    el.highLatSelect?.addEventListener("change", onMethodChange);

    el.resetMethodBtn?.addEventListener("click", () => {
      clearMethodOverride();
      renderMethodControls();
      refreshAll({ preferCache: false }).catch((e) => showNotice(e.message, "error"));
    });
  }

  function wireSavedLocations() {
    el.saveLocationBtn?.addEventListener("click", () => {
      saveCurrentLocation();
    });

    el.useSavedLocationBtn?.addEventListener("click", () => {
      const id = el.savedLocationsSelect?.value || "";
      if (!id) return;
      const selected = state.savedLocations.find((loc) => loc.id === id);
      if (!selected) return;
      applySavedLocation(selected);
    });

    el.removeSavedLocationBtn?.addEventListener("click", () => {
      const id = el.savedLocationsSelect?.value || "";
      if (!id) return;
      state.savedLocations = state.savedLocations.filter((loc) => loc.id !== id);
      writeSavedLocations();
      renderSavedLocations();
    });
  }

  // ---------- Method Switching ----------
  function hydrateMethodOverride() {
    const key = state.slug ? STORAGE_KEYS.methodSlug(state.slug) : STORAGE_KEYS.methodGlobal;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        state.methodOverride = {
          methodId: numOr(obj.methodId, DEFAULT_METHOD.methodId),
          school: obj.school || DEFAULT_METHOD.school,
          highLatRule: obj.highLatRule || DEFAULT_METHOD.highLatRule,
        };
      }
    } catch {
      state.methodOverride = null;
    }
  }

  function getActiveMethod(baseMethod = state.masjid?.calc_method || DEFAULT_METHOD) {
    if (state.methodOverride) {
      return {
        ...baseMethod,
        ...state.methodOverride,
      };
    }
    return baseMethod;
  }

  function onMethodChange() {
    if (!el.methodSelect || !el.schoolSelect || !el.highLatSelect) return;
    const next = {
      methodId: numOr(el.methodSelect.value, DEFAULT_METHOD.methodId),
      school: el.schoolSelect.value,
      highLatRule: el.highLatSelect.value,
    };
    state.methodOverride = next;

    const key = state.slug ? STORAGE_KEYS.methodSlug(state.slug) : STORAGE_KEYS.methodGlobal;
    localStorage.setItem(key, JSON.stringify(next));

    renderMethodControls();
    refreshAll({ preferCache: false }).catch((e) => showNotice(e.message, "error"));
  }

  function clearMethodOverride() {
    const key = state.slug ? STORAGE_KEYS.methodSlug(state.slug) : STORAGE_KEYS.methodGlobal;
    localStorage.removeItem(key);
    state.methodOverride = null;
  }

  function renderMethodOptions() {
    if (!el.methodSelect) return;
    el.methodSelect.innerHTML = "";
    for (const option of METHOD_OPTIONS) {
      const opt = document.createElement("option");
      opt.value = String(option.id);
      opt.textContent = pickLang(option.label, state.lang) || `Method ${option.id}`;
      el.methodSelect.appendChild(opt);
    }
  }

  function renderMethodControls() {
    const method = getActiveMethod();
    if (el.methodSelect) el.methodSelect.value = String(numOr(method.methodId, DEFAULT_METHOD.methodId));
    if (el.schoolSelect) el.schoolSelect.value = method.school || "standard";
    if (el.highLatSelect) el.highLatSelect.value = method.highLatRule || "angleBased";

    if (el.resetMethodBtn) el.resetMethodBtn.disabled = !state.slug;
    if (el.methodScopeNote) {
      el.methodScopeNote.textContent = state.slug
        ? state.methodOverride
          ? t("methodScopeMasjidOverride") || "Overriding masjid defaults (local only)."
          : t("methodScopeMasjid") || "Using masjid defaults."
        : t("methodScopeGlobal") || "Using global defaults."
    }
  }

  // ---------- Saved Locations ----------
  function loadSavedLocations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.savedLocations);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) state.savedLocations = arr;
    } catch {
      state.savedLocations = [];
    }
  }

  function writeSavedLocations() {
    try {
      localStorage.setItem(STORAGE_KEYS.savedLocations, JSON.stringify(state.savedLocations));
    } catch {
      // ignore
    }
  }

  function renderSavedLocations() {
    if (!el.savedLocationsSelect) return;
    el.savedLocationsSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = state.savedLocations.length ? t("selectSaved") || "Select" : t("noSaved") || "No saved locations";
    el.savedLocationsSelect.appendChild(placeholder);

    for (const loc of state.savedLocations) {
      const opt = document.createElement("option");
      opt.value = loc.id;
      opt.textContent = loc.label;
      el.savedLocationsSelect.appendChild(opt);
    }
  }

  function saveCurrentLocation() {
    if (!state.coords) {
      showNotice(t("needLocation") || "Please allow location or enter a city/address.", "info");
      return;
    }
    const label = (el.saveLocationLabelInput?.value || "").trim() || state.locationLabel || t("savedLocation") || "Saved";
    const entry = {
      id: `loc_${Date.now()}`,
      label,
      coords: state.coords,
      manualQuery: state.manualLocation || null,
    };
    state.savedLocations.push(entry);
    writeSavedLocations();
    renderSavedLocations();
    if (el.saveLocationLabelInput) el.saveLocationLabelInput.value = "";
    showNotice(t("saved") || "Saved.", "info");
  }

  function applySavedLocation(loc) {
    if (!loc?.coords) return;
    state.coords = loc.coords;
    state.manualLocation = loc.manualQuery || null;
    state.locationLabel = loc.label;
    state.locationSource = "saved";
    updateLocationStatus("saved");
    refreshAll({ preferCache: true }).catch((e) => showNotice(e.message, "error"));
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
    const saved = localStorage.getItem(STORAGE_KEYS.lang);
    if (saved === "tr" || saved === "en") return saved;
    const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.startsWith("en")) return "en";
    return "tr";
  }

  function applyLanguage(lang) {
    el.root.setAttribute("lang", lang);
    el.root.setAttribute("data-lang", lang);

    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      const val = i18n?.[lang]?.[key];
      if (typeof val === "string") node.textContent = val;
    });

    if (el.slugInput) {
      el.slugInput.placeholder = lang === "en" ? "e.g. sanjose-umut-mescid" : "ör: sanjose-umut-mescid";
    }
    if (el.manualLocationInput) {
      el.manualLocationInput.placeholder = lang === "en" ? "e.g. San Jose, CA" : "ör: San Jose, CA";
    }
    if (el.saveLocationLabelInput) {
      el.saveLocationLabelInput.placeholder = lang === "en" ? "e.g. Home" : "ör: Ev";
    }
  }

  function t(key) {
    return i18n?.[state.lang]?.[key] || i18n?.tr?.[key] || "";
  }

  i18n.tr = Object.assign(
    {
      loadingMasjid: "Mescid profili yükleniyor…",
      locResolving: "Konum alınıyor…",
      locManual: "Konum kapalı — şehir/adres gir.",
      locSearching: "Konum aranıyor…",
      locNotFound: "Konum bulunamadı.",
      locUsingGps: "GPS kullanılıyor",
      locUsingManual: "Manuel şehir kullanılıyor",
      locUsingSaved: "Kayıtlı konum kullanılıyor",
      locBlocked: "Konum izni yok",
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
      nextAdhan: "Adhan",
      nextIqama: "İkame",
      masjidNotFound: "Mescid bulunamadı. Linki veya slug'ı kontrol edin.",
      supabaseMissing: "Supabase ayarları eksik. index.html dosyasında __SUPABASE_URL ve __SUPABASE_ANON_KEY doldurun.",
      supabaseMissingScript: "Supabase JS bulunamadı.",
      methodScopeMasjidOverride: "Mescid varsayılanı üzerine yazılıyor (yalnızca cihazınızda).",
      methodScopeMasjid: "Mescid varsayılanı kullanılıyor.",
      methodScopeGlobal: "Genel varsayılanlar kullanılıyor.",
      saved: "Kaydedildi.",
      usingCache: "Önbellek verisi kullanılıyor (canlı istek başarısız).",
      selectSaved: "Seç",
      noSaved: "Kayıtlı konum yok",
      safetyNoteNone: "Görüntülenen adhan vakitlerinde ihtiyat payı yok.",
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
      locUsingGps: "Using GPS",
      locUsingManual: "Using manual city",
      locUsingSaved: "Using saved location",
      locBlocked: "Location not allowed",
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
      nextAdhan: "Adhan",
      nextIqama: "Iqama",
      masjidNotFound: "Masjid not found. Check the link or slug.",
      supabaseMissing: "Supabase config missing. Fill __SUPABASE_URL and __SUPABASE_ANON_KEY in index.html.",
      supabaseMissingScript: "Supabase JS client not found.",
      methodScopeMasjidOverride: "Overriding masjid defaults (local only).",
      methodScopeMasjid: "Using masjid defaults.",
      methodScopeGlobal: "Using global defaults.",
      saved: "Saved.",
      usingCache: "Using cached data (live fetch failed).",
      selectSaved: "Select",
      noSaved: "No saved locations",
      safetyNoteNone: "Displayed adhan times have no safety offset.",
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
    el.notice.dataset.type = type;
  }

  function clearNotice() {
    if (!el.notice) return;
    el.notice.hidden = true;
    el.noticeText.textContent = "";
    delete el.notice.dataset.type;
  }

  function setTodayDate(tz) {
    const d = new Date();
    el.todayDate.textContent = d.toLocaleDateString(state.lang === "en" ? "en-US" : "tr-TR", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
      timeZone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  function setShareLink(link) {
    if (el.shareLinkInput) el.shareLinkInput.value = link || "";
  }

  function makeShareLink(slug, setId) {
    const url = new URL(location.href);
    if (slug) {
      url.searchParams.set("m", slug);
      if (setId) url.searchParams.set("set", setId);
      else url.searchParams.delete("set");
    } else {
      url.searchParams.delete("m");
      url.searchParams.delete("set");
    }
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
    const m = String(s).match(/(\d{1,2}):(\d{2})/);
    if (!m) return "00:00";
    const hh = String(m[1]).padStart(2, "0");
    const mm = String(m[2]).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function isoDateInTZ(date, tz) {
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
    const [H, M] = (hhmm || "00:00").split(":").map((x) => parseInt(x, 10));
    const [y, mo, d] = isoDate.split("-").map((x) => parseInt(x, 10));

    const approx = new Date(Date.UTC(y, mo - 1, d, H || 0, M || 0, 0));

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

  function makeTimingsCacheKey({ date, tz, coords, method }) {
    const loc = coords ? `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}` : "unknown";
    const tuneKey = encodeURIComponent(JSON.stringify(method.tune || {}));
    return `${date}:${tz}:${loc}:${method.methodId}:${method.school}:${method.highLatRule}:${tuneKey}`;
  }

  function readTimingsCache(key) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.timingsCache(key));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj?.savedAt) return null;
      const age = Date.now() - new Date(obj.savedAt).getTime();
      if (age > TIMINGS_CACHE_TTL_MS) return null;
      return obj;
    } catch {
      return null;
    }
  }

  function writeTimingsCache(key, payload) {
    try {
      localStorage.setItem(
        STORAGE_KEYS.timingsCache(key),
        JSON.stringify({
          savedAt: new Date().toISOString(),
          ...payload,
        })
      );
    } catch {
      // ignore
    }
  }

  function readMasjidCache(slug) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.masjidCache(slug));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj?.savedAt) return null;
      const age = Date.now() - new Date(obj.savedAt).getTime();
      if (age > MASJID_CACHE_TTL_MS) return null;
      return obj.data || null;
    } catch {
      return null;
    }
  }

  function writeMasjidCache(slug, data) {
    try {
      localStorage.setItem(
        STORAGE_KEYS.masjidCache(slug),
        JSON.stringify({
          savedAt: new Date().toISOString(),
          data,
        })
      );
    } catch {
      // ignore
    }
  }

  async function fetchWithRetry(url, options = {}) {
    let lastError = null;
    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
      try {
        const res = await fetch(url, options);
        return res;
      } catch (err) {
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    throw lastError || new Error("Network error");
  }

  function debounceAsync(fn, wait) {
    let timer = null;
    let pendingResolve = null;

    return (...args) => {
      if (timer) clearTimeout(timer);
      if (pendingResolve) pendingResolve(null);

      return new Promise((resolve, reject) => {
        pendingResolve = resolve;
        timer = setTimeout(async () => {
          try {
            const result = await fn(...args);
            pendingResolve = null;
            resolve(result);
          } catch (err) {
            pendingResolve = null;
            reject(err);
          }
        }, wait);
      });
    };
  }
})();
