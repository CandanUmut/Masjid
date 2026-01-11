(() => {
  "use strict";

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
    school: "standard",
    highLatRule: "angleBased",
    tune: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  };

  const STORAGE_KEYS = {
    lang: "prayerhub_lang",
    locations: "prayerhub_locations_v1",
    viewPrefs: "prayerhub_viewprefs_v1",
    tempMethod: "prayerhub_temp_method_v1",
    masjidCache: (slug) => `prayerhub:masjid:${slug}`,
    timingsCache: (key) => `prayerhub:timings:${key}`,
    geocodeCache: "prayerhub_geocode_cache_v1",
  };

  const MASJID_CACHE_TTL_MS = 1000 * 60 * 10;
  const TIMINGS_CACHE_TTL_MS = 1000 * 60 * 60;
  const GEO_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
  const COUNTDOWN_TICK_MS = 1000;
  const RETRY_LIMIT = 2;

  const el = {
    root: document.documentElement,
    masjidName: $("#masjidName"),
    masjidSubtitle: $("#masjidSubtitle"),
    masjidSubtitleSep: $("#masjidSubtitleSep"),
    masjidCity: $("#masjidCity"),
    todayDate: $("#todayDate"),
    langToggleBtn: $("#langToggleBtn"),
    langToggleBtn2: $("#langToggleBtn2"),
    copyLinkBtn: $("#copyLinkBtn"),
    copyLinkBtn2: $("#copyLinkBtn2"),
    shareLinkInput: $("#shareLinkInput"),
    settingsBtn: $("#settingsBtn"),
    adminBtn: $("#adminBtn"),
    loginBtn: $("#loginBtn"),
    userBadge: $("#userBadge"),
    installBtn: $("#installBtn"),
    iosInstallTip: $("#iosInstallTip"),
    offlineBadge: $("#offlineBadge"),
    slugGate: $("#slugGate"),
    slugInput: $("#slugInput"),
    openSlugBtn: $("#openSlugBtn"),

    tzBadge: $("#tzBadge"),
    nowPrayerName: $("#nowPrayerName"),
    nowPrayerStatus: $("#nowPrayerStatus"),
    nowPrayerStart: $("#nowPrayerStart"),
    nextPrayerLabel: $("#nextPrayerLabel"),
    nextPrayerTime: $("#nextPrayerTime"),
    nextTypePill: $("#nextTypePill"),
    nextMeta: $("#nextMeta"),
    nextIqamaLine: $("#nextIqamaLine"),
    countdown: $("#countdown"),
    countdownLabel: document.querySelector(".countdown__label"),
    refreshBtn: $("#refreshBtn"),
    useLocationBtn: $("#useLocationBtn"),
    locationStatus: $("#locationStatus"),
    locationCoords: $("#locationCoords"),
    providerStatus: $("#providerStatus"),
    iqamaSetSelect: $("#iqamaSetSelect"),
    iqamaSetWrap: $("#iqamaSetWrap"),
    iqamaSetHelper: $("#iqamaSetHelper"),
    iqamaSetCreateBtn: $("#iqamaSetCreateBtn"),
    dataFreshnessBadge: $("#dataFreshnessBadge"),

    manualLocationDetails: $("#manualLocationDetails"),
    manualLocationInput: $("#manualLocationInput"),
    manualLocationBtn: $("#manualLocationBtn"),

    methodBadge: $("#methodBadge"),
    calcProvider: $("#calcProvider"),
    calcMethodId: $("#calcMethodId"),
    calcSchool: $("#calcSchool"),
    calcHighLat: $("#calcHighLat"),
    calcTune: $("#calcTune"),
    safetyNote: $("#safetyNote"),

    settingsModal: $("#settingsModal"),
    settingsCloseBtn: $("#settingsCloseBtn"),
    methodSelect: $("#methodSelect"),
    schoolSelect: $("#schoolSelect"),
    highLatSelect: $("#highLatSelect"),
    tuneFajrInput: $("#tuneFajrInput"),
    tuneDhuhrInput: $("#tuneDhuhrInput"),
    tuneAsrInput: $("#tuneAsrInput"),
    tuneMaghribInput: $("#tuneMaghribInput"),
    tuneIshaInput: $("#tuneIshaInput"),
    tuneAdvancedInput: $("#tuneAdvancedInput"),
    resetMethodBtn: $("#resetMethodBtn"),
    methodScopeNote: $("#methodScopeNote"),

    savedLocationsSelect: $("#savedLocationsSelect"),
    useSavedLocationBtn: $("#useSavedLocationBtn"),
    removeSavedLocationBtn: $("#removeSavedLocationBtn"),
    saveLocationLabelInput: $("#saveLocationLabelInput"),
    saveLocationBtn: $("#saveLocationBtn"),

    actionRefreshBtn: $("#actionRefreshBtn"),
    actionLocationBtn: $("#actionLocationBtn"),
    actionSettingsBtn: $("#actionSettingsBtn"),
    actionAdminBtn: $("#actionAdminBtn"),

    loginModal: $("#loginModal"),
    loginCloseBtn: $("#loginCloseBtn"),
    loginEmailInput: $("#loginEmailInput"),
    loginSendBtn: $("#loginSendBtn"),
    loginStatus: $("#loginStatus"),

    adminModal: $("#adminModal"),
    adminCloseBtn: $("#adminCloseBtn"),
    signOutBtn: $("#signOutBtn"),
    authStatus: $("#authStatus"),

    builderEditWrap: $("#builderEditWrap"),
    builderEditLabel: $("#builderEditLabel"),
    builderUseCurrentBtn: $("#builderUseCurrentBtn"),
    builderNameMain: $("#builderNameMain"),
    builderNameEnToggle: $("#builderNameEnToggle"),
    builderNameEnRow: $("#builderNameEnRow"),
    builderNameEn: $("#builderNameEn"),
    builderCityMain: $("#builderCityMain"),
    builderCityEnToggle: $("#builderCityEnToggle"),
    builderCityEnRow: $("#builderCityEnRow"),
    builderCityEn: $("#builderCityEn"),
    builderSlugInput: $("#builderSlugInput"),
    builderCheckSlugBtn: $("#builderCheckSlugBtn"),
    slugStatus: $("#slugStatus"),
    slugSuggestions: $("#slugSuggestions"),
    myMasjidsSelect: $("#myMasjidsSelect"),
    openMasjidBtn: $("#openMasjidBtn"),
    builderIqamaSetSelect: $("#builderIqamaSetSelect"),
    builderAddIqamaSetBtn: $("#builderAddIqamaSetBtn"),
    builderRemoveIqamaSetBtn: $("#builderRemoveIqamaSetBtn"),
    builderIqamaEditor: $("#builderIqamaEditor"),
    builderMethodId: $("#builderMethodId"),
    builderSchool: $("#builderSchool"),
    builderHighLat: $("#builderHighLat"),
    builderTuneFajr: $("#builderTuneFajr"),
    builderTuneDhuhr: $("#builderTuneDhuhr"),
    builderTuneAsr: $("#builderTuneAsr"),
    builderTuneMaghrib: $("#builderTuneMaghrib"),
    builderTuneIsha: $("#builderTuneIsha"),
    builderSafetyFajr: $("#builderSafetyFajr"),
    builderSafetyDhuhr: $("#builderSafetyDhuhr"),
    builderSafetyAsr: $("#builderSafetyAsr"),
    builderSafetyMaghrib: $("#builderSafetyMaghrib"),
    builderSafetyIsha: $("#builderSafetyIsha"),
    builderTimezone: $("#builderTimezone"),
    builderIsPublic: $("#builderIsPublic"),
    builderPrevBtn: $("#builderPrevBtn"),
    builderNextBtn: $("#builderNextBtn"),
    saveMasjidBtn: $("#saveMasjidBtn"),
  };

  const i18n = loadI18n();

  const state = {
    lang: detectInitialLang(),
    supabase: null,
    session: null,
    user: null,
    slug: null,
    setId: null,
    masjid: null,
    isOwner: false,
    iqamaSets: [],
    iqamaSet: null,
    methodOverride: null,
    coords: null,
    locationLabel: null,
    locationSource: null,
    manualLocation: null,
    savedLocations: [],
    computed: null,
    countdownTimer: null,
    refreshTimer: null,
    lastFetchInfo: { source: null, at: null },
    timingsCacheKey: null,
    geocodeCache: {},
    slugStatusTimer: null,
    deferredPrompt: null,
    swRegistration: null,
    builder: {
      step: 1,
      iqamaSets: [],
      activeSetId: null,
      slugTouched: false,
    },
  };

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
    wireSettings();
    wireSavedLocations();
    wireAdmin();
    wireConnectivity();
    wireVisibility();
    wirePwaInstall();
    initServiceWorker();

    applyLanguage(state.lang);

    const params = new URLSearchParams(location.search);
    state.slug = (params.get("m") || "").trim() || null;
    state.setId = (params.get("set") || "").trim() || null;

    if (!state.slug) {
      el.slugGate.hidden = false;
    }

    state.supabase = createSupabaseClient();
    if (state.supabase) {
      await initAuth();
    }

    if (state.slug) {
      await loadMasjid(state.slug);
    }

    if (!state.masjid) {
      state.masjid = buildDefaultMasjid();
    }

    loadSavedLocations();
    hydrateMethodOverride();
    loadGeocodeCache();
    renderMethodOptions();
    renderMethodControls();

    setTodayDate(state.masjid.timezone);
    renderMasjidHeader();
    loadIqamaSets();
    pickInitialIqamaSet();
    renderIqamaSelect();
    setShareLink(makeShareLink(state.slug, state.iqamaSet?.id));
    initBuilder();

    await resolveLocation();
    await refreshAll({ preferCache: true });

    startCountdownLoop();
  }

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
      auth: { persistSession: true },
      db: { schema: "prayer_hub" },
    });
  }

  async function initAuth() {
    const { data } = await state.supabase.auth.getSession();
    state.session = data?.session || null;
    state.user = state.session?.user || null;
    updateAuthUI();

    state.supabase.auth.onAuthStateChange((_, session) => {
      state.session = session;
      state.user = session?.user || null;
      updateAuthUI();
      if (state.user && el.loginModal) el.loginModal.hidden = true;
      if (state.user) {
        loadOwnedMasjids().catch((err) => console.warn(err));
      } else {
        state.isOwner = false;
        state.ownedMasjids = [];
        renderOwnedMasjids();
        renderOwnerControls();
      }
    });

    if (state.user) {
      await loadOwnedMasjids();
    }
  }

  async function loadOwnedMasjids() {
    if (!state.supabase || !state.user) return;
    const { data, error } = await state.supabase
      .from("masjids")
      .select("id,slug,name,city")
      .eq("owner_id", state.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      handleSupabaseError(error, "loadOwnedMasjids", { notify: true });
      return;
    }

    state.ownedMasjids = Array.isArray(data) ? data : [];
    renderOwnedMasjids();
  }

  async function loadMasjid(slug) {
    showNotice(t("loadingMasjid") || "Loading masjid profile…", "info");

    const cached = readMasjidCache(slug);
    if (cached) {
      state.masjid = cached;
      renderMasjidHeader();
    }

    if (!state.supabase) return;

    try {
      const { data, error } = await state.supabase
        .from("masjids")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) {
        handleSupabaseError(error, "loadMasjid");
        throw new Error(error.message);
      }
      if (!data) throw new Error(t("masjidNotFound") || `Masjid not found for slug: ${slug}`);

      state.masjid = normalizeMasjid(data);
      state.isOwner = Boolean(state.user && data.owner_id === state.user.id);
      writeMasjidCache(slug, state.masjid);
      renderMasjidHeader();
      renderMethodDetails();
      loadIqamaSets();
      pickInitialIqamaSet();
      renderIqamaSelect();
      renderOwnerControls();
      clearNotice();
      initBuilder();
    } catch (err) {
      console.warn("Masjid load failed:", err?.message);
      const msg = String(err?.message || "");
      const noticeText = isSchemaExposeError({ code: err?.code, message: msg })
        ? friendlySupabaseError({ code: "PGRST", message: msg })
        : t("masjidNotFound") || "Masjid not found. Check the link or slug.";
      showNotice(noticeText, "error");
      state.slug = null;
      state.setId = null;
      el.slugGate.hidden = false;
      state.masjid = null;
      state.isOwner = false;
      renderOwnerControls();
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
    const tune = safeJson(obj.tune, {});
    return {
      provider: obj.provider || DEFAULT_METHOD.provider,
      methodId: numOr(obj.methodId, DEFAULT_METHOD.methodId),
      school: obj.school || DEFAULT_METHOD.school,
      highLatRule: obj.highLatRule || DEFAULT_METHOD.highLatRule,
      tune: {
        fajr: numOr(tune.fajr, 0),
        dhuhr: numOr(tune.dhuhr, 0),
        asr: numOr(tune.asr, 0),
        maghrib: numOr(tune.maghrib, 0),
        isha: numOr(tune.isha, 0),
        aladhan_tune: typeof tune.aladhan_tune === "string" ? tune.aladhan_tune : "",
      },
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

  async function loadOverridesForDay(isoDate) {
    if (!state.supabase || !state.masjid?.id) return [];

    const { data, error } = await state.supabase
      .from("overrides")
      .select("kind,payload")
      .eq("masjid_id", state.masjid.id)
      .eq("day", isoDate);

    if (error) {
      handleSupabaseError(error, "loadOverrides", { notify: true });
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

  async function resolveLocation() {
    updateLocationStatus("resolving");

    const viewPrefs = readViewPrefs();
    if (viewPrefs?.lastLocationId) {
      const saved = state.savedLocations.find((loc) => loc.id === viewPrefs.lastLocationId);
      if (saved) {
        applySavedLocation(saved, true);
        return;
      }
    }

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
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    });
  }

  async function resolveManualLocation(text) {
    const q = (text || "").trim();
    if (!q) throw new Error(t("enterCity") || "Please enter a city/address.");

    updateLocationStatus("searching");

    const cached = readGeocodeCache(q);
    if (cached) {
      applyGeocodeResult(cached, q, "manual");
      return;
    }

    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(q);

    const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Geocoding failed (${res.status}).`);
    const arr = await res.json();
    if (!Array.isArray(arr) || !arr[0]) throw new Error(t("locNotFound") || "Location not found.");

    const result = {
      lat: parseFloat(arr[0].lat),
      lon: parseFloat(arr[0].lon),
      display_name: arr[0].display_name || q,
    };
    if (!isFinite(result.lat) || !isFinite(result.lon)) throw new Error(t("locNotFound") || "Location not found.");

    writeGeocodeCache(q, result);
    applyGeocodeResult(result, q, "manual");
  }

  function applyGeocodeResult(result, query, source) {
    state.coords = { lat: result.lat, lon: result.lon };
    state.locationLabel = result.display_name || query;
    state.locationSource = source;
    state.manualLocation = query;
    updateLocationStatus(source === "saved" ? "saved" : "manual");
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
    renderLocationCoords();
  }

  function renderLocationCoords() {
    if (!el.locationCoords) return;
    if (!state.coords || !isFinite(state.coords.lat) || !isFinite(state.coords.lon)) {
      el.locationCoords.textContent = "—";
      return;
    }
    const lat = Number(state.coords.lat).toFixed(4);
    const lon = Number(state.coords.lon).toFixed(4);
    el.locationCoords.textContent = `${t("gps") || "GPS"}: ${lat}, ${lon}`;
  }

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
        sunrise: normalizeHHMM(timings.Sunrise),
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
    const sunriseTime = baseTimings?.sunrise
      ? dateFromHHMMInTZ(todayISO, baseTimings.sunrise, tz)
      : null;

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

    const tomorrowISO = isoDateInTZ(addDays(now, 1), tz);
    const tomorrowBase = tomorrowTimings || baseTimings;
    const tomorrowFajrBase = dateFromHHMMInTZ(tomorrowISO, tomorrowBase.fajr, tz);
    const tomorrowFajrOffset = Math.max(0, numOr((tomorrowSafetyOffsets || safetyOffsets)?.fajr, 0));
    const tomorrowFajrAdhan = addMinutes(tomorrowFajrBase, tomorrowFajrOffset);

    const endTimes = {
      fajr: sunriseTime || adhanSafe.dhuhr,
      dhuhr: adhanSafe.asr,
      asr: adhanSafe.maghrib,
      maghrib: adhanSafe.isha,
      isha: tomorrowFajrAdhan,
    };

    return {
      tz,
      todayISO,
      baseTimings,
      tomorrowTimings,
      tomorrowSafetyOffsets,
      safetyOffsets,
      tomorrowIqamaSet: tomorrowIqamaSet
        ? {
            id: tomorrowIqamaSet?.id || "main",
            label: safeJson(tomorrowIqamaSet?.label, {}),
            offsets: safeJson(tomorrowIqamaSet?.offsets, {}),
            fixedTimes: tomorrowIqamaSet?.fixedTimes ? safeJson(tomorrowIqamaSet.fixedTimes, {}) : null,
          }
        : null,
      iqamaSet: iqamaSet
        ? {
            id: iqamaSet?.id || "main",
            label: safeJson(iqamaSet?.label, {}),
            offsets: safeJson(iqamaSet?.offsets, {}),
            fixedTimes: fixedTimes,
          }
        : null,
      times: {
        base: baseDates,
        adhanSafe,
        iqama,
        ends: endTimes,
        sunrise: sunriseTime,
      },
    };
  }

  function findNextPrayerStart(now, schedule) {
    const nowMs = now.getTime();
    for (const p of PRAYERS) {
      const start = schedule.times.adhanSafe?.[p];
      if (start && start.getTime() > nowMs) {
        return { prayer: p, at: start, _tomorrow: false };
      }
    }

    const tomorrowISO = isoDateInTZ(addDays(now, 1), schedule.tz);
    const useTimings = schedule.tomorrowTimings || schedule.baseTimings;
    const fajrBase = dateFromHHMMInTZ(tomorrowISO, useTimings.fajr, schedule.tz);
    const fajrAdhan = addMinutes(
      fajrBase,
      Math.max(0, numOr((schedule.tomorrowSafetyOffsets || schedule.safetyOffsets)?.fajr, 0))
    );
    return { prayer: "fajr", at: fajrAdhan, _tomorrow: true };
  }

  function computeIqamaForStart(prayer, startAt, schedule, isTomorrow) {
    const iqamaSet = isTomorrow ? schedule.tomorrowIqamaSet || schedule.iqamaSet : schedule.iqamaSet;
    if (!iqamaSet) return null;
    const fixedTimes = iqamaSet.fixedTimes ? safeJson(iqamaSet.fixedTimes, {}) : null;
    if (fixedTimes?.[prayer]) {
      const dateISO = isoDateInTZ(startAt, schedule.tz);
      return dateFromHHMMInTZ(dateISO, fixedTimes[prayer], schedule.tz);
    }
    const offsets = safeJson(iqamaSet.offsets, {});
    const off = Math.max(0, numOr(offsets?.[prayer], 0));
    const iqamaAt = addMinutes(startAt, off);
    if (iqamaAt.getTime() < startAt.getTime()) return new Date(startAt.getTime());
    return iqamaAt;
  }

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
    renderLocationCoords();
  }

  function renderMasjidHeader() {
    if (!state.masjid) return;
    const hasSlug = Boolean(state.slug);
    const masjidName = pickLang(state.masjid.name, state.lang) || t("masjid") || "Masjid";
    const name = hasSlug ? masjidName : t("appTitle") || "Mescid Vakitleri";
    const city = hasSlug && state.masjid.city ? pickLang(state.masjid.city, state.lang) : null;
    const subtitleText = hasSlug ? t("todaySubtitle") || "Today's Timings" : "";

    el.masjidName.textContent = name;
    if (el.masjidSubtitle) {
      el.masjidSubtitle.textContent = subtitleText;
      el.masjidSubtitle.hidden = !subtitleText;
    }
    if (el.masjidSubtitleSep) {
      el.masjidSubtitleSep.hidden = !subtitleText;
    }
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
    const tuneParts = [
      `fajr:${numOr(tuneObj.fajr, 0)}`,
      `dhuhr:${numOr(tuneObj.dhuhr, 0)}`,
      `asr:${numOr(tuneObj.asr, 0)}`,
      `maghrib:${numOr(tuneObj.maghrib, 0)}`,
      `isha:${numOr(tuneObj.isha, 0)}`,
    ];
    el.calcTune.textContent = tuneParts.join(" • ");
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
    state.iqamaSets = normalizeIqamaSets(state.masjid?.iqama_sets || []);
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
      if (el.iqamaSetHelper) {
        el.iqamaSetHelper.textContent = state.slug
          ? state.isOwner
            ? t("iqamaMissingOwner") || "No iqama sets yet. Add one in Masjid Builder."
            : t("iqamaMissing") || "Iqama sets are not configured yet."
          : t("iqamaMissingPublic") || "Iqama sets appear when a masjid link is used.";
      }
      if (el.iqamaSetCreateBtn) {
        el.iqamaSetCreateBtn.hidden = !state.isOwner;
      }
      return;
    }

    sel.disabled = false;
    if (el.iqamaSetWrap) el.iqamaSetWrap.classList.remove("is-disabled");
    if (el.iqamaSetHelper) el.iqamaSetHelper.textContent = "";
    if (el.iqamaSetCreateBtn) el.iqamaSetCreateBtn.hidden = true;

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

    const rows = document.querySelectorAll("#timesTable tbody tr[data-prayer]");
    rows.forEach((tr) => tr.classList.remove("is-current"));

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
        statusTd.textContent = "—";
        statusTd.className = "status";
      }
    }
  }

  function computeRowStatus(now, prayer, start, end) {
    const n = now.getTime();
    const a = start.getTime();
    const e = end?.getTime?.() ?? a;
    const prayerLabel = pickLang(PRAYER_LABELS[prayer], state.lang) || prayer;

    if (n < a) {
      return { text: `${t("startsIn")}: ${fmtDelta(a - n)}`, className: "status--upcoming", isCurrent: false };
    }
    if (n >= a && n < e) {
      return {
        text: `${t("now") || "Now"}: ${prayerLabel} (${t("inProgress")}) • ${t("endsIn")}: ${fmtDelta(e - n)}`,
        className: "status--current",
        isCurrent: true,
      };
    }
    return { text: `${t("ended")}`, className: "status--passed", isCurrent: false };
  }

  function renderNextCard() {
    updateTimeUI(Date.now());
  }

  function updateTimeUI(nowMs = Date.now()) {
    const c = state.computed;
    if (!c) return;

    const now = new Date(nowMs);
    const nowLabel = t("now") || "Now";
    const nextLabel = t("next") || "Next";
    const inProgressLabel = t("inProgress") || "In progress";
    const endsInLabel = t("endsIn") || "Ends in";
    const startsInLabel = t("startsIn") || "Starts in";
    const activeWindow = findActivePrayerWindow(now, c);
    const nextPrayer = findNextPrayerStart(now, c);

    if (activeWindow) {
      const activeLabel = pickLang(PRAYER_LABELS[activeWindow.prayer], state.lang) || activeWindow.prayer;
      const activeDiff = activeWindow.end.getTime() - nowMs;
      const iqamaAt = computeIqamaForStart(activeWindow.prayer, activeWindow.start, c, false);
      if (el.nowPrayerName) el.nowPrayerName.textContent = activeLabel;
      if (el.nowPrayerStatus) {
        el.nowPrayerStatus.textContent = `${nowLabel}: ${activeLabel} (${inProgressLabel}) • ${endsInLabel}: ${fmtDelta(
          activeDiff
        )}`;
      }
      if (el.nowPrayerStart) {
        const startText = `${t("beganAt")}: ${fmtTime(activeWindow.start, c.tz)}`;
        const iqamaText = `${t("iqama") || "Iqama"}: ${iqamaAt ? fmtTime(iqamaAt, c.tz) : "—"}`;
        el.nowPrayerStart.textContent = `${startText} • ${iqamaText}`;
      }
    } else {
      if (el.nowPrayerName) el.nowPrayerName.textContent = "—";
      if (el.nowPrayerStatus) el.nowPrayerStatus.textContent = "—";
      if (el.nowPrayerStart) el.nowPrayerStart.textContent = "—";
    }

    if (nextPrayer) {
      const prayerLabel = pickLang(PRAYER_LABELS[nextPrayer.prayer], state.lang) || nextPrayer.prayer;
      const nextDiff = nextPrayer.at.getTime() - nowMs;
      el.nextPrayerLabel.textContent = prayerLabel;
      el.nextTypePill.textContent = t("begins") || "Begins";
      el.nextPrayerTime.textContent = fmtTime(nextPrayer.at, c.tz);

      const startsInText = `${nextLabel}: ${prayerLabel} • ${startsInLabel}: ${fmtDelta(nextDiff)}`;
      const nextMetaParts = [startsInText];
      if (nextPrayer._tomorrow) nextMetaParts.push(t("tomorrow") || "Tomorrow");
      el.nextMeta.textContent = nextMetaParts.join(" • ");

      const iqamaAt = computeIqamaForStart(nextPrayer.prayer, nextPrayer.at, c, nextPrayer._tomorrow);
      if (iqamaAt) {
        el.nextIqamaLine.textContent = `${t("iqama") || "Iqama"}: ${fmtTime(iqamaAt, c.tz)}`;
      } else {
        el.nextIqamaLine.textContent = `${t("iqama") || "Iqama"}: —`;
      }
    } else {
      el.nextPrayerLabel.textContent = "—";
      el.nextTypePill.textContent = t("begins") || "Begins";
      el.nextPrayerTime.textContent = "--:--";
      el.nextMeta.textContent = "—";
      el.nextIqamaLine.textContent = `${t("iqama") || "Iqama"}: —`;
    }

    const rows = document.querySelectorAll("#timesTable tbody tr[data-prayer]");
    rows.forEach((tr) => tr.classList.remove("is-current"));

    for (const p of PRAYERS) {
      const tr = document.querySelector(`#timesTable tbody tr[data-prayer="${p}"]`);
      if (!tr) continue;
      const statusTd = tr.querySelector("td.status");
      const ad = c.times.adhanSafe?.[p];
      const end = c.times.ends?.[p];
      if (statusTd && ad && end) {
        const status = computeRowStatus(now, p, ad, end);
        statusTd.textContent = "";
        if (status.isCurrent) {
          const pill = document.createElement("span");
          pill.className = "pill pill--current status-pill";
          pill.textContent = t("current") || "Current";
          statusTd.appendChild(pill);
        }
        statusTd.appendChild(document.createTextNode(status.text));
        statusTd.className = `status ${status.className}`;
        if (status.isCurrent) tr.classList.add("is-current");
      }
    }

    if (activeWindow) {
      const diff = activeWindow.end.getTime() - nowMs;
      if (diff <= 0) {
        if (el.countdown) el.countdown.textContent = "00:00:00";
        scheduleSoftRefresh();
        return;
      }
      const prayerLabel = pickLang(PRAYER_LABELS[activeWindow.prayer], state.lang) || activeWindow.prayer;
      if (el.countdownLabel) {
        el.countdownLabel.textContent = `${nowLabel}: ${prayerLabel} (${inProgressLabel}) • ${endsInLabel}`;
      }
      if (el.countdown) el.countdown.textContent = fmtHMS(diff);
      return;
    }

    if (!nextPrayer) return;
    const diff = nextPrayer.at.getTime() - nowMs;
    if (diff <= 0) {
      if (el.countdown) el.countdown.textContent = "00:00:00";
      scheduleSoftRefresh();
      return;
    }
    if (el.countdownLabel) {
      const prayerLabel = pickLang(PRAYER_LABELS[nextPrayer.prayer], state.lang) || nextPrayer.prayer;
      el.countdownLabel.textContent = `${nextLabel}: ${prayerLabel} • ${startsInLabel}`;
    }
    if (el.countdown) el.countdown.textContent = fmtHMS(diff);
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

  function startCountdownLoop() {
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(() => {
      updateTimeUI(Date.now());
      showFreshnessBadge();
    }, COUNTDOWN_TICK_MS);
  }

  function wireVisibility() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (state.countdownTimer) clearInterval(state.countdownTimer);
        state.countdownTimer = null;
        return;
      }
      updateTimeUI(Date.now());
      showFreshnessBadge();
      startCountdownLoop();
    });
  }

  function findActivePrayerWindow(now, schedule) {
    const n = now.getTime();
    for (const p of PRAYERS) {
      const start = schedule.times.adhanSafe?.[p];
      const end = schedule.times.ends?.[p];
      if (!start || !end) continue;
      if (n >= start.getTime() && n < end.getTime()) {
        return { prayer: p, start, end };
      }
    }
    return null;
  }

  function scheduleSoftRefresh() {
    if (state.refreshTimer) return;
    state.refreshTimer = setTimeout(() => {
      state.refreshTimer = null;
      refreshAll({ preferCache: false }).catch((e) => showNotice(e.message, "error"));
    }, 2500);
  }

  function wireLanguage() {
    const toggle = () => {
      state.lang = state.lang === "tr" ? "en" : "tr";
      localStorage.setItem(STORAGE_KEYS.lang, state.lang);
      applyLanguage(state.lang);
      renderAll();
      renderMethodOptions();
      renderMethodControls();
      renderSavedLocations();
      renderOwnedMasjids();
      renderBuilderIqamaSetSelect();
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
    }, 550);

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
    el.tuneFajrInput?.addEventListener("change", onMethodChange);
    el.tuneDhuhrInput?.addEventListener("change", onMethodChange);
    el.tuneAsrInput?.addEventListener("change", onMethodChange);
    el.tuneMaghribInput?.addEventListener("change", onMethodChange);
    el.tuneIshaInput?.addEventListener("change", onMethodChange);
    el.tuneAdvancedInput?.addEventListener("change", onMethodChange);

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

  function wireAdmin() {
    const openAdmin = () => {
      if (!state.user || !el.adminModal) return;
      el.adminModal.hidden = false;
      initBuilder();
    };
    const closeAdmin = () => {
      if (!el.adminModal) return;
      el.adminModal.hidden = true;
    };
    const openLogin = () => {
      if (!el.loginModal) return;
      el.loginModal.hidden = false;
    };
    const closeLogin = () => {
      if (!el.loginModal) return;
      el.loginModal.hidden = true;
    };

    el.adminBtn?.addEventListener("click", openAdmin);
    el.actionAdminBtn?.addEventListener("click", openAdmin);
    el.adminCloseBtn?.addEventListener("click", closeAdmin);
    el.adminModal?.querySelector("[data-close='admin']")?.addEventListener("click", closeAdmin);

    el.loginBtn?.addEventListener("click", openLogin);
    el.loginCloseBtn?.addEventListener("click", closeLogin);
    el.loginModal?.querySelector("[data-close='login']")?.addEventListener("click", closeLogin);

    el.loginSendBtn?.addEventListener("click", async () => {
      if (el.loginSendBtn?.disabled) return;
      const email = (el.loginEmailInput?.value || "").trim();
      if (!email) {
        showNotice(t("enterEmail") || "Enter an email.", "info");
        if (el.loginStatus) el.loginStatus.textContent = t("enterEmail") || "Enter an email.";
        return;
      }
      if (!isValidEmail(email)) {
        showNotice(t("emailInvalid") || "Enter a valid email.", "error");
        if (el.loginStatus) el.loginStatus.textContent = t("emailInvalid") || "Enter a valid email.";
        return;
      }
      if (!state.supabase) return;
      const baseUrl = location.origin + location.pathname;
      const original = el.loginSendBtn.textContent;
      el.loginSendBtn.disabled = true;
      el.loginSendBtn.textContent = t("sending") || "Sending...";
      try {
        const { error } = await state.supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: baseUrl },
        });
        if (error) {
          showNotice(error.message, "error");
          if (el.loginStatus) el.loginStatus.textContent = error.message;
          return;
        }
        const successMsg = t("loginSentSuccess") || "Link sent. Check your email.";
        if (el.loginStatus) el.loginStatus.textContent = successMsg;
        showNotice(successMsg, "success");
      } finally {
        el.loginSendBtn.disabled = false;
        el.loginSendBtn.textContent = original;
      }
    });

    el.signOutBtn?.addEventListener("click", async () => {
      if (!state.supabase) return;
      await state.supabase.auth.signOut();
      showNotice(t("signedOut") || "Signed out.", "info");
    });

    el.builderNameEnToggle?.addEventListener("change", () => {
      if (el.builderNameEnRow) el.builderNameEnRow.hidden = !el.builderNameEnToggle.checked;
    });
    el.builderCityEnToggle?.addEventListener("change", () => {
      if (el.builderCityEnRow) el.builderCityEnRow.hidden = !el.builderCityEnToggle.checked;
    });

    el.builderNameMain?.addEventListener("input", maybeAutoSlug);
    el.builderCityMain?.addEventListener("input", maybeAutoSlug);
    el.builderSlugInput?.addEventListener("input", () => {
      state.builder.slugTouched = true;
      const slug = (el.builderSlugInput?.value || "").trim();
      if (state.slugStatusTimer) clearTimeout(state.slugStatusTimer);
      state.slugStatusTimer = setTimeout(() => checkSlugAvailability(slug), 500);
    });
    el.builderCheckSlugBtn?.addEventListener("click", () => {
      const slug = (el.builderSlugInput?.value || "").trim();
      checkSlugAvailability(slug);
    });

    document.querySelectorAll(".builder-step-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const step = Number(btn.dataset.step || 1);
        setBuilderStep(step);
      });
    });

    el.builderPrevBtn?.addEventListener("click", () => {
      setBuilderStep(Math.max(1, state.builder.step - 1));
    });
    el.builderNextBtn?.addEventListener("click", () => {
      setBuilderStep(Math.min(4, state.builder.step + 1));
    });

    el.builderAddIqamaSetBtn?.addEventListener("click", () => {
      addBuilderIqamaSet();
    });
    el.builderRemoveIqamaSetBtn?.addEventListener("click", () => {
      removeBuilderIqamaSet();
    });
    el.builderIqamaSetSelect?.addEventListener("change", () => {
      state.builder.activeSetId = el.builderIqamaSetSelect.value;
      renderBuilderIqamaEditor();
    });

    el.builderUseCurrentBtn?.addEventListener("click", () => {
      if (state.masjid) syncBuilderFromMasjid(state.masjid);
    });

    el.openMasjidBtn?.addEventListener("click", () => {
      const slug = el.myMasjidsSelect?.value;
      if (!slug) return;
      const url = new URL(location.href);
      url.searchParams.set("m", slug);
      location.href = url.toString();
    });

    el.saveMasjidBtn?.addEventListener("click", async () => {
      await handleSaveMasjid();
    });

    el.iqamaSetCreateBtn?.addEventListener("click", () => {
      if (!state.isOwner) return;
      if (el.adminModal) el.adminModal.hidden = false;
      initBuilder();
      setBuilderStep(2);
    });
  }

  function wireConnectivity() {
    updateConnectivity();
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
  }

  function updateConnectivity() {
    if (!el.offlineBadge) return;
    el.offlineBadge.hidden = navigator.onLine;
  }

  function wirePwaInstall() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.deferredPrompt = event;
      if (el.installBtn) el.installBtn.hidden = false;
    });

    window.addEventListener("appinstalled", () => {
      state.deferredPrompt = null;
      if (el.installBtn) el.installBtn.hidden = true;
    });

    el.installBtn?.addEventListener("click", async () => {
      if (!state.deferredPrompt) return;
      state.deferredPrompt.prompt();
      try {
        await state.deferredPrompt.userChoice;
      } finally {
        state.deferredPrompt = null;
        if (el.installBtn) el.installBtn.hidden = true;
      }
    });

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (el.iosInstallTip) el.iosInstallTip.hidden = !(isIos && !isStandalone);
  }

  async function initServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js");
      state.swRegistration = registration;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    } catch (err) {
      console.warn("Service worker registration failed", err);
    }
  }

  function renderMethodOptions() {
    const selects = [el.methodSelect, el.builderMethodId];
    selects.forEach((select) => {
      if (!select) return;
      select.innerHTML = "";
      for (const option of METHOD_OPTIONS) {
        const opt = document.createElement("option");
        opt.value = String(option.id);
        opt.textContent = pickLang(option.label, state.lang) || `Method ${option.id}`;
        select.appendChild(opt);
      }
    });
  }

  function renderMethodControls() {
    const method = getActiveMethod();
    if (el.methodSelect) el.methodSelect.value = String(numOr(method.methodId, DEFAULT_METHOD.methodId));
    if (el.schoolSelect) el.schoolSelect.value = method.school || "standard";
    if (el.highLatSelect) el.highLatSelect.value = method.highLatRule || "angleBased";
    if (el.tuneFajrInput) el.tuneFajrInput.value = numOr(method.tune?.fajr, 0);
    if (el.tuneDhuhrInput) el.tuneDhuhrInput.value = numOr(method.tune?.dhuhr, 0);
    if (el.tuneAsrInput) el.tuneAsrInput.value = numOr(method.tune?.asr, 0);
    if (el.tuneMaghribInput) el.tuneMaghribInput.value = numOr(method.tune?.maghrib, 0);
    if (el.tuneIshaInput) el.tuneIshaInput.value = numOr(method.tune?.isha, 0);
    if (el.tuneAdvancedInput) el.tuneAdvancedInput.value = method.tune?.aladhan_tune || "";

    if (el.resetMethodBtn) el.resetMethodBtn.disabled = !state.slug && !state.methodOverride;
    if (el.methodScopeNote) {
      el.methodScopeNote.textContent = state.slug
        ? state.methodOverride
          ? t("methodScopeMasjidOverride") || "Overriding masjid defaults (local only)."
          : t("methodScopeMasjid") || "Using masjid defaults."
        : t("methodScopeGlobal") || "Using global defaults.";
    }
  }

  function onMethodChange() {
    if (!el.methodSelect || !el.schoolSelect || !el.highLatSelect) return;
    const next = {
      methodId: numOr(el.methodSelect.value, DEFAULT_METHOD.methodId),
      school: el.schoolSelect.value,
      highLatRule: el.highLatSelect.value,
      tune: {
        fajr: numOr(el.tuneFajrInput?.value, 0),
        dhuhr: numOr(el.tuneDhuhrInput?.value, 0),
        asr: numOr(el.tuneAsrInput?.value, 0),
        maghrib: numOr(el.tuneMaghribInput?.value, 0),
        isha: numOr(el.tuneIshaInput?.value, 0),
        aladhan_tune: (el.tuneAdvancedInput?.value || "").trim(),
      },
    };
    state.methodOverride = next;

    writeMethodOverride(next);
    renderMethodControls();
    refreshAll({ preferCache: false }).catch((e) => showNotice(e.message, "error"));
  }

  function hydrateMethodOverride() {
    const raw = localStorage.getItem(STORAGE_KEYS.tempMethod);
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return;
      if (state.slug && obj.slugs?.[state.slug]) {
        state.methodOverride = obj.slugs[state.slug];
        return;
      }
      if (!state.slug && obj.global) {
        state.methodOverride = obj.global;
      }
    } catch {
      state.methodOverride = null;
    }
  }

  function writeMethodOverride(override) {
    const raw = localStorage.getItem(STORAGE_KEYS.tempMethod);
    let obj = { global: null, slugs: {} };
    try {
      if (raw) obj = JSON.parse(raw);
    } catch {
      obj = { global: null, slugs: {} };
    }
    if (state.slug) {
      obj.slugs = obj.slugs || {};
      obj.slugs[state.slug] = override;
    } else {
      obj.global = override;
    }
    localStorage.setItem(STORAGE_KEYS.tempMethod, JSON.stringify(obj));
  }

  function clearMethodOverride() {
    const raw = localStorage.getItem(STORAGE_KEYS.tempMethod);
    if (!raw) {
      state.methodOverride = null;
      return;
    }
    try {
      const obj = JSON.parse(raw);
      if (state.slug && obj.slugs) {
        delete obj.slugs[state.slug];
      } else {
        obj.global = null;
      }
      localStorage.setItem(STORAGE_KEYS.tempMethod, JSON.stringify(obj));
    } catch {
      localStorage.removeItem(STORAGE_KEYS.tempMethod);
    }
    state.methodOverride = null;
  }

  function getActiveMethod(baseMethod = state.masjid?.calc_method || DEFAULT_METHOD) {
    if (state.methodOverride) {
      return {
        ...baseMethod,
        ...state.methodOverride,
        tune: { ...baseMethod.tune, ...state.methodOverride.tune },
      };
    }
    return baseMethod;
  }

  function loadSavedLocations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.locations);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) state.savedLocations = arr;
    } catch {
      state.savedLocations = [];
    }
  }

  function writeSavedLocations() {
    try {
      localStorage.setItem(STORAGE_KEYS.locations, JSON.stringify(state.savedLocations));
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
      type: state.locationSource || "manual",
    };
    state.savedLocations.push(entry);
    writeSavedLocations();
    renderSavedLocations();
    if (el.saveLocationLabelInput) el.saveLocationLabelInput.value = "";
    writeViewPrefs({ lastLocationId: entry.id });
    showNotice(t("saved") || "Saved.", "info");
  }

  function applySavedLocation(loc, silent = false) {
    if (!loc?.coords) return;
    state.coords = loc.coords;
    state.manualLocation = loc.manualQuery || null;
    state.locationLabel = loc.label;
    state.locationSource = "saved";
    updateLocationStatus("saved");
    writeViewPrefs({ lastLocationId: loc.id });
    if (!silent) refreshAll({ preferCache: true }).catch((e) => showNotice(e.message, "error"));
  }

  function readViewPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.viewPrefs);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeViewPrefs(next) {
    const current = readViewPrefs();
    const merged = { ...current, ...next };
    localStorage.setItem(STORAGE_KEYS.viewPrefs, JSON.stringify(merged));
  }

  function loadGeocodeCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.geocodeCache);
      state.geocodeCache = raw ? JSON.parse(raw) : {};
    } catch {
      state.geocodeCache = {};
    }
  }

  function readGeocodeCache(query) {
    if (!query) return null;
    const key = query.toLowerCase();
    const entry = state.geocodeCache?.[key];
    if (!entry) return null;
    if (Date.now() - entry.savedAt > GEO_CACHE_TTL_MS) return null;
    return entry.result;
  }

  function writeGeocodeCache(query, result) {
    if (!query) return;
    const key = query.toLowerCase();
    state.geocodeCache[key] = { savedAt: Date.now(), result };
    try {
      localStorage.setItem(STORAGE_KEYS.geocodeCache, JSON.stringify(state.geocodeCache));
    } catch {
      // ignore
    }
  }

  function updateAuthUI() {
    if (state.user) {
      if (el.authStatus) {
        el.authStatus.textContent = `${t("signedInAs") || "Signed in as"}: ${state.user.email}`;
      }
      if (el.signOutBtn) el.signOutBtn.hidden = false;
      if (el.adminBtn) el.adminBtn.hidden = false;
      if (el.loginBtn) el.loginBtn.hidden = true;
      if (el.actionAdminBtn) el.actionAdminBtn.hidden = false;
      if (el.userBadge) {
        el.userBadge.textContent = state.user.email;
        el.userBadge.hidden = false;
      }
      if (el.loginStatus) {
        el.loginStatus.textContent = `${t("signedInAs") || "Signed in as"}: ${state.user.email}`;
      }
    } else {
      if (el.authStatus) {
        el.authStatus.textContent = t("signedOutState") || "Not signed in";
      }
      if (el.signOutBtn) el.signOutBtn.hidden = true;
      if (el.adminBtn) el.adminBtn.hidden = true;
      if (el.loginBtn) el.loginBtn.hidden = false;
      if (el.actionAdminBtn) el.actionAdminBtn.hidden = true;
      if (el.userBadge) el.userBadge.hidden = true;
      if (el.adminModal) el.adminModal.hidden = true;
      if (el.loginStatus) {
        el.loginStatus.textContent = t("signedOutState") || "Not signed in";
      }
    }
    renderOwnerControls();
  }

  function renderOwnedMasjids() {
    if (!el.myMasjidsSelect) return;
    el.myMasjidsSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = state.ownedMasjids?.length ? t("selectMasjid") || "Select" : t("noMasjid") || "No masjid yet";
    el.myMasjidsSelect.appendChild(placeholder);

    (state.ownedMasjids || []).forEach((masjid) => {
      const opt = document.createElement("option");
      opt.value = masjid.slug;
      const name = pickLang(safeJson(masjid.name, {}), state.lang) || masjid.slug;
      const city = masjid.city ? pickLang(safeJson(masjid.city, {}), state.lang) : "";
      opt.textContent = city ? `${name} • ${city}` : name;
      el.myMasjidsSelect.appendChild(opt);
    });
  }

  function renderOwnerControls() {
    if (el.builderEditWrap) {
      el.builderEditWrap.hidden = !state.isOwner;
    }
    if (el.builderEditLabel) {
      el.builderEditLabel.textContent = state.isOwner && state.masjid?.slug
        ? `${t("editing") || "Editing"}: ${state.masjid.slug}`
        : "";
    }
  }

  function initBuilder() {
    if (state.isOwner && state.masjid) {
      syncBuilderFromMasjid(state.masjid);
    } else {
      resetBuilderForCreate();
    }
    setBuilderStep(state.builder.step || 1);
  }

  function resetBuilderForCreate() {
    if (el.builderNameMain) el.builderNameMain.value = "";
    if (el.builderNameEn) el.builderNameEn.value = "";
    if (el.builderCityMain) el.builderCityMain.value = "";
    if (el.builderCityEn) el.builderCityEn.value = "";
    if (el.builderNameEnToggle) el.builderNameEnToggle.checked = false;
    if (el.builderNameEnRow) el.builderNameEnRow.hidden = true;
    if (el.builderCityEnToggle) el.builderCityEnToggle.checked = false;
    if (el.builderCityEnRow) el.builderCityEnRow.hidden = true;
    if (el.builderSlugInput) el.builderSlugInput.value = "";
    if (el.slugSuggestions) el.slugSuggestions.textContent = "";
    setSlugStatus("");
    state.builder.slugTouched = false;

    if (el.builderMethodId) el.builderMethodId.value = String(DEFAULT_METHOD.methodId);
    if (el.builderSchool) el.builderSchool.value = DEFAULT_METHOD.school;
    if (el.builderHighLat) el.builderHighLat.value = DEFAULT_METHOD.highLatRule;
    if (el.builderTuneFajr) el.builderTuneFajr.value = DEFAULT_METHOD.tune.fajr;
    if (el.builderTuneDhuhr) el.builderTuneDhuhr.value = DEFAULT_METHOD.tune.dhuhr;
    if (el.builderTuneAsr) el.builderTuneAsr.value = DEFAULT_METHOD.tune.asr;
    if (el.builderTuneMaghrib) el.builderTuneMaghrib.value = DEFAULT_METHOD.tune.maghrib;
    if (el.builderTuneIsha) el.builderTuneIsha.value = DEFAULT_METHOD.tune.isha;

    if (el.builderSafetyFajr) el.builderSafetyFajr.value = 0;
    if (el.builderSafetyDhuhr) el.builderSafetyDhuhr.value = 0;
    if (el.builderSafetyAsr) el.builderSafetyAsr.value = 0;
    if (el.builderSafetyMaghrib) el.builderSafetyMaghrib.value = 0;
    if (el.builderSafetyIsha) el.builderSafetyIsha.value = 0;

    if (el.builderTimezone) {
      el.builderTimezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
    }
    if (el.builderIsPublic) el.builderIsPublic.value = "true";

    state.builder.iqamaSets = [defaultIqamaSet()];
    state.builder.activeSetId = state.builder.iqamaSets[0].id;
    renderBuilderIqamaSetSelect();
    renderBuilderIqamaEditor();
    renderOwnerControls();
  }

  function syncBuilderFromMasjid(m) {
    const nameTr = m?.name?.tr || "";
    const nameEn = m?.name?.en || "";
    if (el.builderNameMain) el.builderNameMain.value = nameTr || nameEn || "";
    if (el.builderNameEn) el.builderNameEn.value = nameEn || "";
    if (el.builderNameEnToggle) el.builderNameEnToggle.checked = Boolean(nameEn && nameEn !== nameTr);
    if (el.builderNameEnRow) el.builderNameEnRow.hidden = !el.builderNameEnToggle?.checked;

    const cityTr = m?.city?.tr || "";
    const cityEn = m?.city?.en || "";
    if (el.builderCityMain) el.builderCityMain.value = cityTr || cityEn || "";
    if (el.builderCityEn) el.builderCityEn.value = cityEn || "";
    if (el.builderCityEnToggle) el.builderCityEnToggle.checked = Boolean(cityEn && cityEn !== cityTr);
    if (el.builderCityEnRow) el.builderCityEnRow.hidden = !el.builderCityEnToggle?.checked;

    if (el.builderSlugInput) el.builderSlugInput.value = m?.slug || "";
    if (el.slugSuggestions) el.slugSuggestions.textContent = "";
    setSlugStatus("");
    state.builder.slugTouched = true;

    if (el.builderMethodId) el.builderMethodId.value = String(numOr(m?.calc_method?.methodId, DEFAULT_METHOD.methodId));
    if (el.builderSchool) el.builderSchool.value = m?.calc_method?.school || DEFAULT_METHOD.school;
    if (el.builderHighLat) el.builderHighLat.value = m?.calc_method?.highLatRule || DEFAULT_METHOD.highLatRule;
    if (el.builderTuneFajr) el.builderTuneFajr.value = numOr(m?.calc_method?.tune?.fajr, 0);
    if (el.builderTuneDhuhr) el.builderTuneDhuhr.value = numOr(m?.calc_method?.tune?.dhuhr, 0);
    if (el.builderTuneAsr) el.builderTuneAsr.value = numOr(m?.calc_method?.tune?.asr, 0);
    if (el.builderTuneMaghrib) el.builderTuneMaghrib.value = numOr(m?.calc_method?.tune?.maghrib, 0);
    if (el.builderTuneIsha) el.builderTuneIsha.value = numOr(m?.calc_method?.tune?.isha, 0);

    if (el.builderSafetyFajr) el.builderSafetyFajr.value = numOr(m?.safety_offsets?.fajr, 0);
    if (el.builderSafetyDhuhr) el.builderSafetyDhuhr.value = numOr(m?.safety_offsets?.dhuhr, 0);
    if (el.builderSafetyAsr) el.builderSafetyAsr.value = numOr(m?.safety_offsets?.asr, 0);
    if (el.builderSafetyMaghrib) el.builderSafetyMaghrib.value = numOr(m?.safety_offsets?.maghrib, 0);
    if (el.builderSafetyIsha) el.builderSafetyIsha.value = numOr(m?.safety_offsets?.isha, 0);

    if (el.builderTimezone) {
      el.builderTimezone.value = m?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
    }
    if (el.builderIsPublic) el.builderIsPublic.value = m?.is_public ? "true" : "false";

    state.builder.iqamaSets = normalizeIqamaSets(m?.iqama_sets || []);
    if (!state.builder.iqamaSets.length) {
      state.builder.iqamaSets = [defaultIqamaSet()];
    }
    state.builder.activeSetId = state.builder.iqamaSets[0].id;
    renderBuilderIqamaSetSelect();
    renderBuilderIqamaEditor();
    renderOwnerControls();
  }

  function setBuilderStep(step) {
    const safeStep = Math.min(4, Math.max(1, Number(step) || 1));
    state.builder.step = safeStep;
    document.querySelectorAll(".builder-step-btn").forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.step) === safeStep);
    });
    document.querySelectorAll(".builder-panel").forEach((panel) => {
      panel.classList.toggle("is-active", Number(panel.dataset.step) === safeStep);
    });
    if (el.builderPrevBtn) el.builderPrevBtn.disabled = safeStep === 1;
    if (el.builderNextBtn) el.builderNextBtn.disabled = safeStep === 4;
  }

  function renderBuilderIqamaSetSelect() {
    if (!el.builderIqamaSetSelect) return;
    el.builderIqamaSetSelect.innerHTML = "";
    for (const set of state.builder.iqamaSets) {
      const opt = document.createElement("option");
      opt.value = set.id;
      opt.textContent = pickLang(set.label, state.lang) || set.id;
      if (state.builder.activeSetId === set.id) opt.selected = true;
      el.builderIqamaSetSelect.appendChild(opt);
    }
    if (!state.builder.activeSetId && state.builder.iqamaSets[0]) {
      state.builder.activeSetId = state.builder.iqamaSets[0].id;
    }
  }

  function renderBuilderIqamaEditor() {
    if (!el.builderIqamaEditor) return;
    const set = state.builder.iqamaSets.find((s) => s.id === state.builder.activeSetId);
    el.builderIqamaEditor.innerHTML = "";
    if (!set) return;

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr>
          <th>${t("prayer") || "Prayer"}</th>
          <th>${t("mode") || "Mode"}</th>
          <th>${t("offsetMinutes") || "Offset (min)"}</th>
          <th>${t("fixedTime") || "Fixed time"}</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    PRAYERS.forEach((p) => {
      const row = document.createElement("tr");
      const label = pickLang(PRAYER_LABELS[p], state.lang) || p;
      const mode = set.fixedTimes?.[p] ? "fixed" : "offset";
      const offsetValue = numOr(set.offsets?.[p], 0);
      const fixedValue = set.fixedTimes?.[p] || "";
      row.innerHTML = `
        <th>${label}</th>
        <td>
          <select data-field="mode">
            <option value="offset">${t("offset") || "Offset"}</option>
            <option value="fixed">${t("fixed") || "Fixed"}</option>
          </select>
        </td>
        <td>
          <input data-field="offset" type="number" min="0" inputmode="numeric" value="${offsetValue}" />
        </td>
        <td>
          <input data-field="fixed" type="text" placeholder="HH:MM" value="${escapeHtml(fixedValue)}" />
        </td>
      `;
      const modeSel = row.querySelector("[data-field='mode']");
      const offsetInput = row.querySelector("[data-field='offset']");
      const fixedInput = row.querySelector("[data-field='fixed']");
      if (modeSel) modeSel.value = mode;

      const updateFixedTimes = () => {
        if (modeSel.value === "fixed") {
          set.fixedTimes = set.fixedTimes || {};
          set.fixedTimes[p] = fixedInput.value.trim();
        } else if (set.fixedTimes) {
          delete set.fixedTimes[p];
          if (!Object.keys(set.fixedTimes).length) set.fixedTimes = null;
        }
        offsetInput.disabled = modeSel.value !== "offset";
        fixedInput.disabled = modeSel.value !== "fixed";
        offsetInput.style.display = modeSel.value === "offset" ? "block" : "none";
        fixedInput.style.display = modeSel.value === "fixed" ? "block" : "none";
      };

      modeSel?.addEventListener("change", () => {
        updateFixedTimes();
      });
      offsetInput?.addEventListener("input", () => {
        set.offsets[p] = Math.max(0, Math.floor(numOr(offsetInput.value, 0)));
      });
      fixedInput?.addEventListener("input", () => {
        if (modeSel.value !== "fixed") return;
        updateFixedTimes();
      });

      updateFixedTimes();

      tbody?.appendChild(row);
    });

    el.builderIqamaEditor.appendChild(table);
  }

  function addBuilderIqamaSet() {
    const nextIndex = state.builder.iqamaSets.length + 1;
    let id = `set-${nextIndex}`;
    while (state.builder.iqamaSets.some((s) => s.id === id)) {
      id = `set-${Math.floor(Math.random() * 9000 + 1000)}`;
    }
    const label = `${t("iqamaSetNew") || "Set"} ${nextIndex}`;
    state.builder.iqamaSets.push({
      id,
      label: { tr: label, en: label },
      offsets: buildDefaultOffsets(),
      fixedTimes: null,
    });
    state.builder.activeSetId = id;
    renderBuilderIqamaSetSelect();
    renderBuilderIqamaEditor();
  }

  function removeBuilderIqamaSet() {
    if (state.builder.iqamaSets.length <= 1) {
      showNotice(t("iqamaSetMin") || "At least one iqama set is required.", "info");
      return;
    }
    state.builder.iqamaSets = state.builder.iqamaSets.filter((s) => s.id !== state.builder.activeSetId);
    state.builder.activeSetId = state.builder.iqamaSets[0]?.id || null;
    renderBuilderIqamaSetSelect();
    renderBuilderIqamaEditor();
  }

  async function handleSaveMasjid() {
    if (!state.user) {
      showNotice(t("loginRequired") || "Login required", "info");
      return;
    }
    const result = collectBuilderPayload();
    if (result.error) {
      showNotice(result.error, "error");
      return;
    }
    if (!state.supabase) return;
    const { data: userData, error: userError } = await state.supabase.auth.getUser();
    if (userError || !userData?.user) {
      showNotice(t("loginRequired") || "Login required", "info");
      return;
    }
    state.user = userData.user;
    const payload = result.payload;
    const isEditing = Boolean(state.isOwner && state.masjid?.id);

    if (isEditing) {
      const { error } = await state.supabase
        .from("masjids")
        .update(payload)
        .eq("id", state.masjid.id)
        .eq("owner_id", state.user.id);
      if (error) {
        handleInsertError(error, payload.slug, payload.name, payload.city);
        return;
      }
      showNotice(t("saved") || "Saved.", "success");
      const url = new URL(location.href);
      url.searchParams.set("m", payload.slug);
      if (state.iqamaSet?.id) url.searchParams.set("set", state.iqamaSet.id);
      history.replaceState({}, "", url.toString());
      await loadMasjid(payload.slug);
      await refreshAll({ preferCache: false });
      return;
    }

    payload.owner_id = userData.user.id;
    const { data, error } = await state.supabase
      .from("masjids")
      .insert(payload)
      .select("slug,iqama_sets")
      .single();
    if (error) {
      handleInsertError(error, payload.slug, payload.name, payload.city);
      return;
    }
    showNotice(t("saved") || "Saved.", "success");
    const firstSetId = data?.iqama_sets?.[0]?.id || "";
    const url = new URL(location.href);
    url.searchParams.set("m", data.slug);
    if (firstSetId) url.searchParams.set("set", firstSetId);
    setTimeout(() => {
      location.href = url.toString();
    }, 300);
  }

  function handleInsertError(error, slug, name, city) {
    if (error?.code === "23505") {
      const detail = error.details || "";
      if (detail.includes("slug")) {
        showNotice(t("slugTaken") || "This slug is taken. Try another.", "error");
        showSlugSuggestions(slug, name, city);
        return;
      }
      showNotice(t("nameTaken") || "A masjid with this name and city already exists.", "error");
      return;
    }
    handleSupabaseError(error, "writeMasjid");
    showNotice(friendlySupabaseError(error), "error");
  }

  function collectBuilderPayload() {
    const rawSlug = (el.builderSlugInput?.value || "").trim();
    const slug = slugify(rawSlug);
    if (el.builderSlugInput && slug && slug !== rawSlug) {
      el.builderSlugInput.value = slug;
    }
    const name = buildBuilderName();
    if (!slug || !name?.tr || !name?.en) {
      return { error: t("requiredFields") || "Slug and name fields are required." };
    }
    if (!isValidTimezone(el.builderTimezone?.value)) {
      return { error: t("timezoneInvalid") || "Timezone is invalid." };
    }

    const iqamaResult = validateBuilderIqamaSets();
    if (iqamaResult.error) return { error: iqamaResult.error };

    const payload = {
      slug,
      name,
      city: buildBuilderCity(),
      timezone: el.builderTimezone?.value || Intl.DateTimeFormat().resolvedOptions().timeZone,
      calc_method: {
        provider: "aladhan",
        methodId: numOr(el.builderMethodId?.value, DEFAULT_METHOD.methodId),
        school: el.builderSchool?.value || DEFAULT_METHOD.school,
        highLatRule: el.builderHighLat?.value || DEFAULT_METHOD.highLatRule,
        tune: {
          fajr: numOr(el.builderTuneFajr?.value, 0),
          dhuhr: numOr(el.builderTuneDhuhr?.value, 0),
          asr: numOr(el.builderTuneAsr?.value, 0),
          maghrib: numOr(el.builderTuneMaghrib?.value, 0),
          isha: numOr(el.builderTuneIsha?.value, 0),
        },
      },
      safety_offsets: clampSafetyOffsets({
        fajr: numOr(el.builderSafetyFajr?.value, 0),
        dhuhr: numOr(el.builderSafetyDhuhr?.value, 0),
        asr: numOr(el.builderSafetyAsr?.value, 0),
        maghrib: numOr(el.builderSafetyMaghrib?.value, 0),
        isha: numOr(el.builderSafetyIsha?.value, 0),
      }),
      iqama_sets: iqamaResult.sets,
      meta: {},
      is_public: el.builderIsPublic?.value !== "false",
    };

    return { payload };
  }

  function validateBuilderIqamaSets() {
    if (!state.builder.iqamaSets.length) {
      return { error: t("iqamaMissingBuilder") || "Add at least one iqama set." };
    }
    const seen = new Set();
    const sets = [];
    for (const set of state.builder.iqamaSets) {
      const id = (set.id || "").trim();
      if (!id) return { error: t("iqamaIdRequired") || "Each iqama set needs an id." };
      if (seen.has(id)) return { error: t("iqamaIdUnique") || "Iqama set ids must be unique." };
      seen.add(id);

      const labelTr = set.label?.tr || set.label?.en || id;
      const labelEn = set.label?.en || set.label?.tr || id;
      const offsets = buildDefaultOffsets();
      for (const p of PRAYERS) {
        offsets[p] = Math.max(0, Math.floor(numOr(set.offsets?.[p], 0)));
      }
      let fixedTimes = null;
      if (set.fixedTimes) {
        fixedTimes = {};
        for (const p of PRAYERS) {
          const value = (set.fixedTimes?.[p] || "").trim();
          if (!value) continue;
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
            return { error: t("iqamaFixedInvalid") || "Fixed time must be HH:MM." };
          }
          fixedTimes[p] = value;
        }
        if (!Object.keys(fixedTimes).length) fixedTimes = null;
      }
      sets.push({
        id,
        label: { tr: labelTr, en: labelEn },
        offsets,
        fixedTimes,
      });
    }
    return { sets };
  }

  async function checkSlugAvailability(slug) {
    if (!slug) {
      setSlugStatus("");
      return;
    }
    const normalized = slugify(slug);
    if (normalized !== slug && el.builderSlugInput) {
      el.builderSlugInput.value = normalized;
    }
    if (!state.supabase) {
      setSlugStatus("");
      return;
    }
    const { data, error } = await state.supabase
      .from("masjids")
      .select("id")
      .eq("slug", normalized)
      .maybeSingle();

    if (error) {
      handleSupabaseError(error, "checkSlug", { notify: true });
      setSlugStatus("");
      return;
    }
    if (data && (!state.masjid?.id || data.id !== state.masjid.id)) {
      setSlugStatus(t("slugTaken") || "This slug is taken.", "danger");
      showSlugSuggestions(normalized, buildBuilderName(), buildBuilderCity());
    } else {
      setSlugStatus(t("slugAvailable") || "Slug is available.", "success");
      if (el.slugSuggestions) el.slugSuggestions.textContent = "";
    }
  }

  function setSlugStatus(text, type) {
    if (!el.slugStatus) return;
    el.slugStatus.textContent = text;
    el.slugStatus.className = "helper";
    if (type === "danger") el.slugStatus.classList.add("is-danger");
    if (type === "success") el.slugStatus.classList.add("is-success");
  }

  function showSlugSuggestions(slug, name, city) {
    if (!el.slugSuggestions) return;
    const base = slug || slugify(`${name?.tr || name?.en || ""} ${city?.tr || city?.en || ""}`.trim());
    const cityPart = slugify((city?.tr || city?.en || "").trim());
    const statePart = slugify(extractState(city?.tr || city?.en || ""));
    const suggestions = [
      cityPart ? `${base}-${cityPart}` : "",
      statePart ? `${base}-${statePart}` : "",
      `${base}-${randomSuffix()}`,
    ].filter(Boolean);
    el.slugSuggestions.textContent = `${t("slugSuggestions") || "Suggestions"}: ${suggestions.join(", ")}`;
  }

  function buildBuilderName() {
    const main = (el.builderNameMain?.value || "").trim();
    const en = el.builderNameEnToggle?.checked ? (el.builderNameEn?.value || "").trim() : "";
    const tr = main || en;
    const enVal = en || main;
    return { tr, en: enVal };
  }

  function buildBuilderCity() {
    const main = (el.builderCityMain?.value || "").trim();
    const en = el.builderCityEnToggle?.checked ? (el.builderCityEn?.value || "").trim() : "";
    if (!main && !en) return null;
    const tr = main || en;
    const enVal = en || main;
    return { tr, en: enVal };
  }

  function maybeAutoSlug() {
    if (state.builder.slugTouched) return;
    const name = (el.builderNameMain?.value || "").trim();
    const city = (el.builderCityMain?.value || "").trim();
    const next = slugify(`${name} ${city}`.trim());
    if (next && el.builderSlugInput) el.builderSlugInput.value = next;
  }

  function extractState(city) {
    if (!city) return "";
    const parts = city.split(",");
    if (parts.length < 2) return "";
    return parts[1].trim();
  }


  function defaultIqamaSet() {
    return {
      id: "main",
      label: { tr: "Ana Cemaat", en: "Main Congregation" },
      offsets: buildDefaultOffsets(),
      fixedTimes: null,
    };
  }

  function buildDefaultOffsets() {
    return { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
  }

  function normalizeIqamaSets(rawSets) {
    if (!Array.isArray(rawSets)) return [];
    return rawSets
      .map((raw) => {
        const obj = safeJson(raw, {});
        const id = (obj.id || "").trim();
        if (!id) return null;
        const label = safeJson(obj.label, {});
        const offsets = buildDefaultOffsets();
        for (const p of PRAYERS) {
          offsets[p] = Math.max(0, Math.floor(numOr(obj.offsets?.[p], 0)));
        }
        let fixedTimes = null;
        if (obj.fixedTimes) {
          fixedTimes = {};
          for (const p of PRAYERS) {
            const value = (obj.fixedTimes?.[p] || "").trim();
            if (value) fixedTimes[p] = value;
          }
          if (!Object.keys(fixedTimes).length) fixedTimes = null;
        }
        return {
          id,
          label: {
            tr: label.tr || label.en || id,
            en: label.en || label.tr || id,
          },
          offsets,
          fixedTimes,
        };
      })
      .filter(Boolean);
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
    updateTableLabels();
  }

  function t(key) {
    return i18n?.[state.lang]?.[key] || i18n?.tr?.[key] || "";
  }

  function updateTableLabels() {
    const begins = t("begins") || "Begins";
    const iqama = t("iqama") || "Iqama";
    const status = t("status") || "Status";
    document.querySelectorAll("#timesTable tbody tr").forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      if (cells[0]) cells[0].setAttribute("data-label", begins);
      if (cells[1]) cells[1].setAttribute("data-label", iqama);
      if (cells[2]) cells[2].setAttribute("data-label", status);
    });
  }

  function isSchemaExposeError(error) {
    if (!error) return false;
    const code = typeof error === "object" ? String(error.code || "") : "";
    const message = typeof error === "string" ? error : String(error.message || "");
    const normalized = message.toLowerCase();
    return code === "PGRST106" || normalized.includes("the schema must be one of");
  }

  function friendlySupabaseError(error) {
    if (!error) return "";
    if (String(error.code || "").startsWith("PGRST")) {
      if (isSchemaExposeError(error)) {
        return t("schemaExposeBanner") || "Expose prayer_hub in Supabase Settings → API → Exposed schemas";
      }
      return t("pgrstError") || "Supabase API is not available for this request.";
    }
    return error.message || t("unexpectedError") || "Unexpected error.";
  }

  function handleSupabaseError(error, context, options = {}) {
    if (!error) return;
    if (options.notify && String(error.code || "").startsWith("PGRST")) {
      showNotice(friendlySupabaseError(error), "error");
    }
    if (context) {
      console.warn(`Supabase error in ${context}:`, error);
    }
  }

  i18n.tr = Object.assign(
    {
      loadingMasjid: "Mescid profili yükleniyor…",
      appTitle: "Mescid Vakitleri",
      todaySubtitle: "Bugünün Vakitleri",
      install: "Yükle",
      installTip: "iOS için: Paylaş → Ana Ekrana Ekle",
      updateAvailable: "Güncelleme mevcut",
      refreshPage: "Yenile",
      offline: "Çevrimdışı",
      login: "Giriş",
      loginHelp: "Giriş linki e-posta adresinize gönderilir.",
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
      startsIn: "Başlamasına",
      inProgress: "Vakit girdi",
      endsIn: "Bitmesine",
      ended: "Vakit çıktı",
      now: "Şu an",
      next: "Sıradaki",
      begins: "Vakit girişi",
      beganAt: "Başladı",
      gps: "GPS",
      current: "Şu an",
      adhan: "Adhan",
      iqama: "İkame (Cemaat)",
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
      safetyNoteNone: "Görüntülenen vakit girişlerinde ihtiyat payı yok.",
      loginRequired: "Login required",
      loginSentSuccess: "Link gönderildi. E-postanı kontrol et.",
      emailInvalid: "Geçerli bir e-posta girin.",
      sending: "Gönderiliyor...",
      enterEmail: "E-posta girin.",
      loginSent: "Giriş linki gönderildi.",
      signedOut: "Çıkış yapıldı.",
      signedInAs: "Giriş yapan",
      signedOutState: "Giriş yapılmadı",
      masjidBuilderTitle: "Masjid Builder",
      stepBasics: "Temel",
      stepIqama: "İkame",
      stepMethod: "Yöntem",
      stepSafety: "İhtiyat + Yayın",
      back: "Geri",
      next: "İleri",
      saveMasjid: "Kaydet",
      masjidName: "Mescid İsmi",
      addEnglish: "İngilizce çeviri ekle",
      checkAvailability: "Uygun mu kontrol et",
      editing: "Düzenleniyor",
      mode: "Mod",
      offsetMinutes: "Offset (dk)",
      fixedTime: "Sabit saat",
      offset: "Offset",
      fixed: "Sabit",
      selectMasjid: "Seç",
      noMasjid: "Henüz mescid yok",
      requiredFields: "Slug ve isim alanları zorunlu.",
      timezoneInvalid: "Saat dilimi geçersiz.",
      slugTaken: "Bu slug kullanımda.",
      slugAvailable: "Slug kullanılabilir.",
      slugSuggestions: "Öneriler",
      nameTaken: "Bu isim ve şehirde bir mescid zaten var.",
      resetDone: "Kayıtlı değerlere dönüldü.",
      deleteConfirm: "Bu mescidi silmek istiyor musunuz?",
      deleted: "Mescid silindi.",
      iqamaSetNew: "Set",
      iqamaSetMin: "En az bir ikame seti gerekli.",
      iqamaIdRequired: "Her ikame seti için id gerekli.",
      iqamaIdUnique: "Ikame set id'leri benzersiz olmalı.",
      iqamaFixedInvalid: "Sabit saat HH:MM formatında olmalı.",
      iqamaMissingOwner: "İkame seti yok. Masjid Builder ile ekleyin.",
      iqamaMissingBuilder: "En az bir ikame seti ekleyin.",
      iqamaMissing: "İkame setleri henüz tanımlı değil.",
      iqamaMissingPublic: "İkame setleri mescid linkiyle görünür.",
      createDefaultSet: "Varsayılan set oluştur",
      schemaExposeBanner: "Supabase Settings → API → Exposed schemas içinde prayer_hub açın.",
      copyFixSteps: "Düzeltme adımlarını kopyala",
      copyFailed: "Kopyalama başarısız.",
      pgrstError: "Supabase API isteği başarısız oldu. Ayarları kontrol edin.",
      unexpectedError: "Beklenmeyen hata oluştu.",
    },
    i18n.tr || {}
  );

  i18n.en = Object.assign(
    {
      loadingMasjid: "Loading masjid profile…",
      appTitle: "Masjid Timings",
      todaySubtitle: "Today's Timings",
      install: "Install",
      installTip: "On iOS: Share → Add to Home Screen",
      updateAvailable: "Update available",
      refreshPage: "Refresh",
      offline: "Offline",
      login: "Login",
      loginHelp: "A login link will be sent to your email.",
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
      startsIn: "Starts in",
      inProgress: "In progress",
      endsIn: "Ends in",
      ended: "Ended",
      now: "Now",
      next: "Next",
      begins: "Begins",
      beganAt: "Began at",
      gps: "GPS",
      current: "Current",
      adhan: "Adhan",
      iqama: "Iqama (Congregation)",
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
      safetyNoteNone: "Displayed begin times have no safety offset.",
      loginRequired: "Login required",
      loginSentSuccess: "Link sent. Check your email.",
      emailInvalid: "Enter a valid email.",
      sending: "Sending...",
      enterEmail: "Enter an email.",
      loginSent: "Login link sent.",
      signedOut: "Signed out.",
      signedInAs: "Signed in as",
      signedOutState: "Not signed in",
      masjidBuilderTitle: "Masjid Builder",
      stepBasics: "Basics",
      stepIqama: "Iqama",
      stepMethod: "Method",
      stepSafety: "Safety & Publish",
      back: "Back",
      next: "Next",
      saveMasjid: "Save",
      masjidName: "Masjid Name",
      addEnglish: "Add English translation",
      checkAvailability: "Check availability",
      editing: "Editing",
      mode: "Mode",
      offsetMinutes: "Offset (min)",
      fixedTime: "Fixed time",
      offset: "Offset",
      fixed: "Fixed",
      selectMasjid: "Select",
      noMasjid: "No masjid yet",
      requiredFields: "Slug and name fields are required.",
      timezoneInvalid: "Timezone is invalid.",
      slugTaken: "This slug is taken.",
      slugAvailable: "Slug is available.",
      slugSuggestions: "Suggestions",
      nameTaken: "A masjid with this name and city already exists.",
      resetDone: "Reset to saved values.",
      deleteConfirm: "Delete this masjid?",
      deleted: "Masjid deleted.",
      iqamaSetNew: "Set",
      iqamaSetMin: "At least one iqama set is required.",
      iqamaIdRequired: "Each iqama set needs an id.",
      iqamaIdUnique: "Iqama set ids must be unique.",
      iqamaFixedInvalid: "Fixed time must be HH:MM.",
      iqamaMissingOwner: "No iqama sets yet. Add one in Masjid Builder.",
      iqamaMissingBuilder: "Add at least one iqama set.",
      iqamaMissing: "Iqama sets are not configured yet.",
      iqamaMissingPublic: "Iqama sets appear when a masjid link is used.",
      createDefaultSet: "Create default set",
      schemaExposeBanner: "Expose prayer_hub in Supabase Settings → API → Exposed schemas",
      copyFixSteps: "Copy fix steps",
      copyFailed: "Copy failed.",
      pgrstError: "Supabase API request failed. Check API settings.",
      unexpectedError: "Unexpected error.",
    },
    i18n.en || {}
  );

  function $(sel) {
    return document.querySelector(sel);
  }

  function setNotice(next) {
    if (!el.notice || !el.noticeText) return;
    const message = String(next?.text ?? "").trim();
    if (!message) {
      state.notice = null;
      el.notice.hidden = true;
      el.noticeText.textContent = "";
      delete el.notice.dataset.type;
      return;
    }
    const type = next?.type || "info";
    state.notice = { text: message, type };
    el.notice.hidden = false;
    el.noticeText.textContent = message;
    el.notice.dataset.type = type;
  }

  function showNotice(text, type = "info") {
    setNotice({ text, type });
  }

  function clearNotice() {
    setNotice(null);
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
    if (typeof obj === "string") return obj;
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

  function slugify(text) {
    return (text || "")
      .toString()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function randomSuffix() {
    return Math.random().toString(36).slice(2, 6);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isValidTimezone(tz) {
    if (!tz) return false;
    try {
      Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
})();
