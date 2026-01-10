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
    masjidCity: $("#masjidCity"),
    todayDate: $("#todayDate"),
    langToggleBtn: $("#langToggleBtn"),
    langToggleBtn2: $("#langToggleBtn2"),
    copyLinkBtn: $("#copyLinkBtn"),
    copyLinkBtn2: $("#copyLinkBtn2"),
    shareLinkInput: $("#shareLinkInput"),
    settingsBtn: $("#settingsBtn"),
    adminBtn: $("#adminBtn"),
    installBtn: $("#installBtn"),
    iosInstallTip: $("#iosInstallTip"),
    offlineBadge: $("#offlineBadge"),
    updateToast: $("#updateToast"),
    reloadBtn: $("#reloadBtn"),

    slugGate: $("#slugGate"),
    slugInput: $("#slugInput"),
    openSlugBtn: $("#openSlugBtn"),

    notice: $("#notice"),
    noticeText: $("#noticeText"),
    noticeClose: $("#noticeClose"),

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
    iqamaSetHelper: $("#iqamaSetHelper"),
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

    adminModal: $("#adminModal"),
    adminCloseBtn: $("#adminCloseBtn"),
    authEmailInput: $("#authEmailInput"),
    signInBtn: $("#signInBtn"),
    signOutBtn: $("#signOutBtn"),
    authStatus: $("#authStatus"),

    myMasjidsSelect: $("#myMasjidsSelect"),
    openMasjidBtn: $("#openMasjidBtn"),

    createMasjidForm: $("#createMasjidForm"),
    createSlugInput: $("#createSlugInput"),
    generateSlugBtn: $("#generateSlugBtn"),
    createNameTr: $("#createNameTr"),
    createNameEn: $("#createNameEn"),
    createCityTr: $("#createCityTr"),
    createCityEn: $("#createCityEn"),
    createTimezone: $("#createTimezone"),
    createIsPublic: $("#createIsPublic"),
    createMethodId: $("#createMethodId"),
    createSchool: $("#createSchool"),
    createHighLat: $("#createHighLat"),
    createTuneFajr: $("#createTuneFajr"),
    createTuneDhuhr: $("#createTuneDhuhr"),
    createTuneAsr: $("#createTuneAsr"),
    createTuneMaghrib: $("#createTuneMaghrib"),
    createTuneIsha: $("#createTuneIsha"),
    createTuneAdvanced: $("#createTuneAdvanced"),
    createSafetyFajr: $("#createSafetyFajr"),
    createSafetyDhuhr: $("#createSafetyDhuhr"),
    createSafetyAsr: $("#createSafetyAsr"),
    createSafetyMaghrib: $("#createSafetyMaghrib"),
    createSafetyIsha: $("#createSafetyIsha"),
    addIqamaSetBtn: $("#addIqamaSetBtn"),
    iqamaSetsEditor: $("#iqamaSetsEditor"),
    slugStatus: $("#slugStatus"),
    slugSuggestions: $("#slugSuggestions"),

    editMasjidDetails: $("#editMasjidDetails"),
    editMasjidForm: $("#editMasjidForm"),
    editSlugInput: $("#editSlugInput"),
    editNameTr: $("#editNameTr"),
    editNameEn: $("#editNameEn"),
    editCityTr: $("#editCityTr"),
    editCityEn: $("#editCityEn"),
    editTimezone: $("#editTimezone"),
    editIsPublic: $("#editIsPublic"),
    editMethodId: $("#editMethodId"),
    editSchool: $("#editSchool"),
    editHighLat: $("#editHighLat"),
    editTuneFajr: $("#editTuneFajr"),
    editTuneDhuhr: $("#editTuneDhuhr"),
    editTuneAsr: $("#editTuneAsr"),
    editTuneMaghrib: $("#editTuneMaghrib"),
    editTuneIsha: $("#editTuneIsha"),
    editTuneAdvanced: $("#editTuneAdvanced"),
    editSafetyFajr: $("#editSafetyFajr"),
    editSafetyDhuhr: $("#editSafetyDhuhr"),
    editSafetyAsr: $("#editSafetyAsr"),
    editSafetyMaghrib: $("#editSafetyMaghrib"),
    editSafetyIsha: $("#editSafetyIsha"),
    editAddIqamaSetBtn: $("#editAddIqamaSetBtn"),
    editIqamaSetsEditor: $("#editIqamaSetsEditor"),
    saveMasjidBtn: $("#saveMasjidBtn"),
    resetMasjidBtn: $("#resetMasjidBtn"),
    deleteMasjidBtn: $("#deleteMasjidBtn"),
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
    wireNotice();
    wireSettings();
    wireSavedLocations();
    wireAdmin();
    wireConnectivity();
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
    populateAdminDefaults();
    if (state.isOwner) populateEditForm();

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
      if (state.user) {
        loadOwnedMasjids().catch((err) => console.warn(err));
      } else {
        state.isOwner = false;
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
      .schema("prayer_hub")
      .from("masjids")
      .select("id,slug,name,city")
      .eq("owner_id", state.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn(error.message);
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
        .schema("prayer_hub")
        .from("masjids")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw new Error(error.message);
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
      if (state.isOwner) populateEditForm();
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
      if (el.iqamaSetHelper) {
        el.iqamaSetHelper.textContent = state.slug
          ? state.isOwner
            ? t("iqamaMissingOwner") || "No iqama sets yet. Add one in Admin → Edit Masjid."
            : t("iqamaMissing") || "Iqama sets are not configured yet."
          : t("iqamaMissingPublic") || "Iqama sets appear when a masjid link is used.";
      }
      return;
    }

    sel.disabled = false;
    if (el.iqamaSetWrap) el.iqamaSetWrap.classList.remove("is-disabled");
    if (el.iqamaSetHelper) el.iqamaSetHelper.textContent = "";

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
    const open = () => {
      if (!el.adminModal) return;
      el.adminModal.hidden = false;
    };
    const close = () => {
      if (!el.adminModal) return;
      el.adminModal.hidden = true;
    };

    el.adminBtn?.addEventListener("click", open);
    el.actionAdminBtn?.addEventListener("click", open);
    el.adminCloseBtn?.addEventListener("click", close);
    el.adminModal?.querySelector("[data-close='admin']")?.addEventListener("click", close);

    el.signInBtn?.addEventListener("click", async () => {
      const email = (el.authEmailInput?.value || "").trim();
      if (!email) return showNotice(t("enterEmail") || "Enter an email.", "info");
      if (!state.supabase) return;
      const { error } = await state.supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + location.pathname },
      });
      if (error) {
        showNotice(error.message, "error");
        return;
      }
      showNotice(t("loginSent") || "Login link sent. Check your email.", "info");
    });

    el.signOutBtn?.addEventListener("click", async () => {
      if (!state.supabase) return;
      await state.supabase.auth.signOut();
      showNotice(t("signedOut") || "Signed out.", "info");
    });

    el.generateSlugBtn?.addEventListener("click", () => {
      const name = el.createNameTr?.value || el.createNameEn?.value || "";
      const city = el.createCityTr?.value || el.createCityEn?.value || "";
      const slug = slugify(`${name} ${city}`.trim());
      if (el.createSlugInput) {
        el.createSlugInput.value = slug;
        checkSlugAvailability(slug);
      }
    });

    el.createSlugInput?.addEventListener("input", () => {
      const slug = (el.createSlugInput?.value || "").trim();
      if (state.slugStatusTimer) clearTimeout(state.slugStatusTimer);
      state.slugStatusTimer = setTimeout(() => checkSlugAvailability(slug), 500);
    });

    el.createMasjidForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleCreateMasjid();
    });

    el.addIqamaSetBtn?.addEventListener("click", () => {
      addIqamaSetRow(el.iqamaSetsEditor);
    });

    el.editAddIqamaSetBtn?.addEventListener("click", () => {
      addIqamaSetRow(el.editIqamaSetsEditor);
    });

    el.openMasjidBtn?.addEventListener("click", () => {
      const slug = el.myMasjidsSelect?.value;
      if (!slug) return;
      const url = new URL(location.href);
      url.searchParams.set("m", slug);
      location.href = url.toString();
    });

    el.editMasjidForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleUpdateMasjid();
    });

    el.resetMasjidBtn?.addEventListener("click", async () => {
      if (state.slug) await loadMasjid(state.slug);
      if (state.isOwner) populateEditForm();
      showNotice(t("resetDone") || "Reset to latest saved values.", "info");
    });

    el.deleteMasjidBtn?.addEventListener("click", async () => {
      if (!state.isOwner || !state.supabase || !state.masjid?.id) return;
      const confirmed = confirm(t("deleteConfirm") || "Delete this masjid? This cannot be undone.");
      if (!confirmed) return;
      const { error } = await state.supabase
        .schema("prayer_hub")
        .from("masjids")
        .delete()
        .eq("id", state.masjid.id)
        .eq("owner_id", state.user?.id);
      if (error) {
        showNotice(error.message, "error");
        return;
      }
      showNotice(t("deleted") || "Masjid deleted.", "info");
      location.href = location.origin + location.pathname;
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

      if (registration.waiting) {
        showUpdateToast();
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast();
          }
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });

      el.reloadBtn?.addEventListener("click", () => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      });
    } catch (err) {
      console.warn("Service worker registration failed", err);
    }
  }

  function showUpdateToast() {
    if (!el.updateToast) return;
    el.updateToast.hidden = false;
  }

  function renderMethodOptions() {
    const selects = [el.methodSelect, el.createMethodId, el.editMethodId];
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
    if (!el.authStatus) return;
    if (state.user) {
      el.authStatus.textContent = `${t("signedInAs") || "Signed in as"}: ${state.user.email}`;
      if (el.signOutBtn) el.signOutBtn.hidden = false;
      if (el.signInBtn) el.signInBtn.hidden = true;
    } else {
      el.authStatus.textContent = t("signedOutState") || "Not signed in";
      if (el.signOutBtn) el.signOutBtn.hidden = true;
      if (el.signInBtn) el.signInBtn.hidden = false;
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
    if (!el.editMasjidDetails) return;
    el.editMasjidDetails.hidden = !state.isOwner;
    if (!state.isOwner) return;
    populateEditForm();
  }

  function populateAdminDefaults() {
    if (el.createTimezone) {
      el.createTimezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    addIqamaSetRow(el.iqamaSetsEditor);
  }

  function populateEditForm() {
    if (!state.masjid || !state.isOwner) return;
    const m = state.masjid;
    if (el.editSlugInput) el.editSlugInput.value = m.slug || "";
    if (el.editNameTr) el.editNameTr.value = m.name?.tr || "";
    if (el.editNameEn) el.editNameEn.value = m.name?.en || "";
    if (el.editCityTr) el.editCityTr.value = m.city?.tr || "";
    if (el.editCityEn) el.editCityEn.value = m.city?.en || "";
    if (el.editTimezone) el.editTimezone.value = m.timezone || "";
    if (el.editIsPublic) el.editIsPublic.value = m.is_public ? "true" : "false";

    if (el.editMethodId) el.editMethodId.value = String(numOr(m.calc_method?.methodId, DEFAULT_METHOD.methodId));
    if (el.editSchool) el.editSchool.value = m.calc_method?.school || "standard";
    if (el.editHighLat) el.editHighLat.value = m.calc_method?.highLatRule || "angleBased";
    if (el.editTuneFajr) el.editTuneFajr.value = numOr(m.calc_method?.tune?.fajr, 0);
    if (el.editTuneDhuhr) el.editTuneDhuhr.value = numOr(m.calc_method?.tune?.dhuhr, 0);
    if (el.editTuneAsr) el.editTuneAsr.value = numOr(m.calc_method?.tune?.asr, 0);
    if (el.editTuneMaghrib) el.editTuneMaghrib.value = numOr(m.calc_method?.tune?.maghrib, 0);
    if (el.editTuneIsha) el.editTuneIsha.value = numOr(m.calc_method?.tune?.isha, 0);
    if (el.editTuneAdvanced) el.editTuneAdvanced.value = m.calc_method?.tune?.aladhan_tune || "";

    if (el.editSafetyFajr) el.editSafetyFajr.value = numOr(m.safety_offsets?.fajr, 0);
    if (el.editSafetyDhuhr) el.editSafetyDhuhr.value = numOr(m.safety_offsets?.dhuhr, 0);
    if (el.editSafetyAsr) el.editSafetyAsr.value = numOr(m.safety_offsets?.asr, 0);
    if (el.editSafetyMaghrib) el.editSafetyMaghrib.value = numOr(m.safety_offsets?.maghrib, 0);
    if (el.editSafetyIsha) el.editSafetyIsha.value = numOr(m.safety_offsets?.isha, 0);

    if (el.editIqamaSetsEditor) {
      el.editIqamaSetsEditor.innerHTML = "";
      const sets = Array.isArray(m.iqama_sets) && m.iqama_sets.length ? m.iqama_sets : [defaultIqamaSet()];
      sets.forEach((set) => addIqamaSetRow(el.editIqamaSetsEditor, set));
    }
  }

  async function handleCreateMasjid() {
    if (!state.user) {
      showNotice(t("loginRequired") || "Please sign in to create a masjid.", "info");
      return;
    }
    const slug = (el.createSlugInput?.value || "").trim();
    const nameTr = (el.createNameTr?.value || "").trim();
    const nameEn = (el.createNameEn?.value || "").trim();
    if (!slug || !nameTr || !nameEn) {
      showNotice(t("requiredFields") || "Slug and names are required.", "error");
      return;
    }
    if (!isValidTimezone(el.createTimezone?.value)) {
      showNotice(t("timezoneInvalid") || "Timezone is invalid.", "error");
      return;
    }

    const iqamaParse = parseIqamaSets(el.iqamaSetsEditor);
    if (iqamaParse.error) {
      showNotice(iqamaParse.error, "error");
      return;
    }

    const payload = {
      slug,
      name: { tr: nameTr, en: nameEn },
      city: buildCity(el.createCityTr?.value, el.createCityEn?.value),
      timezone: el.createTimezone?.value || Intl.DateTimeFormat().resolvedOptions().timeZone,
      calc_method: {
        provider: "aladhan",
        methodId: numOr(el.createMethodId?.value, DEFAULT_METHOD.methodId),
        school: el.createSchool?.value || "standard",
        highLatRule: el.createHighLat?.value || "angleBased",
        tune: {
          fajr: numOr(el.createTuneFajr?.value, 0),
          dhuhr: numOr(el.createTuneDhuhr?.value, 0),
          asr: numOr(el.createTuneAsr?.value, 0),
          maghrib: numOr(el.createTuneMaghrib?.value, 0),
          isha: numOr(el.createTuneIsha?.value, 0),
          aladhan_tune: (el.createTuneAdvanced?.value || "").trim(),
        },
      },
      safety_offsets: clampSafetyOffsets({
        fajr: numOr(el.createSafetyFajr?.value, 0),
        dhuhr: numOr(el.createSafetyDhuhr?.value, 0),
        asr: numOr(el.createSafetyAsr?.value, 0),
        maghrib: numOr(el.createSafetyMaghrib?.value, 0),
        isha: numOr(el.createSafetyIsha?.value, 0),
      }),
      iqama_sets: iqamaParse.sets,
      meta: {},
      is_public: el.createIsPublic?.value !== "false",
      owner_id: state.user.id,
    };

    const { data, error } = await state.supabase
      .schema("prayer_hub")
      .from("masjids")
      .insert(payload)
      .select("slug,iqama_sets")
      .single();

    if (error) {
      handleInsertError(error, slug, payload.name, payload.city);
      return;
    }

    const firstSetId = data?.iqama_sets?.[0]?.id || "";
    const url = new URL(location.href);
    url.searchParams.set("m", data.slug);
    if (firstSetId) url.searchParams.set("set", firstSetId);
    location.href = url.toString();
  }

  async function handleUpdateMasjid() {
    if (!state.user || !state.isOwner || !state.supabase || !state.masjid?.id) return;
    const nameTr = (el.editNameTr?.value || "").trim();
    const nameEn = (el.editNameEn?.value || "").trim();
    if (!nameTr || !nameEn) {
      showNotice(t("requiredFields") || "Slug and names are required.", "error");
      return;
    }
    if (!isValidTimezone(el.editTimezone?.value)) {
      showNotice(t("timezoneInvalid") || "Timezone is invalid.", "error");
      return;
    }

    const iqamaParse = parseIqamaSets(el.editIqamaSetsEditor);
    if (iqamaParse.error) {
      showNotice(iqamaParse.error, "error");
      return;
    }

    const payload = {
      name: { tr: nameTr, en: nameEn },
      city: buildCity(el.editCityTr?.value, el.editCityEn?.value),
      timezone: el.editTimezone?.value || state.masjid.timezone,
      calc_method: {
        provider: "aladhan",
        methodId: numOr(el.editMethodId?.value, DEFAULT_METHOD.methodId),
        school: el.editSchool?.value || "standard",
        highLatRule: el.editHighLat?.value || "angleBased",
        tune: {
          fajr: numOr(el.editTuneFajr?.value, 0),
          dhuhr: numOr(el.editTuneDhuhr?.value, 0),
          asr: numOr(el.editTuneAsr?.value, 0),
          maghrib: numOr(el.editTuneMaghrib?.value, 0),
          isha: numOr(el.editTuneIsha?.value, 0),
          aladhan_tune: (el.editTuneAdvanced?.value || "").trim(),
        },
      },
      safety_offsets: clampSafetyOffsets({
        fajr: numOr(el.editSafetyFajr?.value, 0),
        dhuhr: numOr(el.editSafetyDhuhr?.value, 0),
        asr: numOr(el.editSafetyAsr?.value, 0),
        maghrib: numOr(el.editSafetyMaghrib?.value, 0),
        isha: numOr(el.editSafetyIsha?.value, 0),
      }),
      iqama_sets: iqamaParse.sets,
      is_public: el.editIsPublic?.value !== "false",
    };

    const { error } = await state.supabase
      .schema("prayer_hub")
      .from("masjids")
      .update(payload)
      .eq("id", state.masjid.id)
      .eq("owner_id", state.user.id);

    if (error) {
      showNotice(error.message, "error");
      return;
    }

    showNotice(t("saved") || "Saved.", "info");
    await loadMasjid(state.masjid.slug);
    await refreshAll({ preferCache: false });
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
    showNotice(error.message, "error");
  }

  async function checkSlugAvailability(slug) {
    if (!slug) {
      setSlugStatus("");
      return;
    }
    const normalized = slugify(slug);
    if (normalized !== slug && el.createSlugInput) {
      el.createSlugInput.value = normalized;
    }
    if (!state.supabase) {
      setSlugStatus("");
      return;
    }
    const { data, error } = await state.supabase
      .schema("prayer_hub")
      .from("masjids")
      .select("id")
      .eq("slug", normalized)
      .maybeSingle();

    if (error) {
      setSlugStatus("");
      return;
    }
    if (data) {
      setSlugStatus(t("slugTaken") || "This slug is taken.", "danger");
      showSlugSuggestions(normalized, buildName(), buildCityObject());
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
    const suggestions = [
      base,
      `${base}-${randomSuffix()}`,
      `${base}-${new Date().getFullYear()}`,
    ].filter(Boolean);
    el.slugSuggestions.textContent = `${t("slugSuggestions") || "Suggestions"}: ${suggestions.join(", ")}`;
  }

  function buildName() {
    return { tr: el.createNameTr?.value || "", en: el.createNameEn?.value || "" };
  }

  function buildCityObject() {
    return buildCity(el.createCityTr?.value, el.createCityEn?.value);
  }

  function buildCity(tr, en) {
    const tVal = (tr || "").trim();
    const eVal = (en || "").trim();
    if (!tVal && !eVal) return null;
    return { tr: tVal, en: eVal };
  }

  function addIqamaSetRow(container, preset = null) {
    if (!container) return;
    const set = preset || defaultIqamaSet();
    const wrapper = document.createElement("div");
    wrapper.className = "iqama-set";
    wrapper.innerHTML = `
      <div class="iqama-set__header">
        <strong>${t("iqamaSet") || "Iqama Set"}</strong>
        <button class="btn btn--ghost" type="button" data-action="remove">${t("remove") || "Remove"}</button>
      </div>
      <div class="row row--wrap">
        <label class="field">
          <span class="field__label">ID</span>
          <input class="input" data-field="id" value="${escapeHtml(set.id || "")}" placeholder="main" />
        </label>
        <label class="field">
          <span class="field__label">Label (TR)</span>
          <input class="input" data-field="labelTr" value="${escapeHtml(set.label?.tr || "")}" />
        </label>
        <label class="field">
          <span class="field__label">Label (EN)</span>
          <input class="input" data-field="labelEn" value="${escapeHtml(set.label?.en || "")}" />
        </label>
      </div>
      <div class="iqama-set__grid">
        ${PRAYERS.map((p) => {
          const offset = numOr(set.offsets?.[p], "");
          const fixed = set.fixedTimes?.[p] || "";
          return `
            <label class="field">
              <span class="field__label">${p} offset</span>
              <input class="input" data-field="offset-${p}" type="number" min="0" inputmode="numeric" value="${offset}" />
            </label>
            <label class="field">
              <span class="field__label">${p} fixed</span>
              <input class="input" data-field="fixed-${p}" placeholder="HH:MM" value="${escapeHtml(fixed)}" />
            </label>
          `;
        }).join("")}
      </div>
    `;
    wrapper.querySelector("[data-action='remove']")?.addEventListener("click", () => {
      wrapper.remove();
    });
    container.appendChild(wrapper);
  }

  function parseIqamaSets(container) {
    if (!container) return { sets: [] };
    const nodes = Array.from(container.querySelectorAll(".iqama-set"));
    const sets = [];
    const seen = new Set();

    for (const node of nodes) {
      const id = (node.querySelector("[data-field='id']")?.value || "").trim();
      if (!id) return { error: t("iqamaIdRequired") || "Each iqama set needs an id." };
      if (seen.has(id)) return { error: t("iqamaIdUnique") || "Iqama set ids must be unique." };
      seen.add(id);

      const labelTr = (node.querySelector("[data-field='labelTr']")?.value || "").trim();
      const labelEn = (node.querySelector("[data-field='labelEn']")?.value || "").trim();

      const offsets = {};
      const fixedTimes = {};
      for (const p of PRAYERS) {
        const offVal = node.querySelector(`[data-field='offset-${p}']`)?.value;
        if (offVal !== "" && offVal != null) {
          offsets[p] = Math.max(0, Math.floor(numOr(offVal, 0)));
        }
        const fixedVal = (node.querySelector(`[data-field='fixed-${p}']`)?.value || "").trim();
        if (fixedVal) {
          if (!/^\d{2}:\d{2}$/.test(fixedVal)) {
            return { error: t("iqamaFixedInvalid") || "Fixed time must be HH:MM." };
          }
          fixedTimes[p] = fixedVal;
        }
      }

      sets.push({
        id,
        label: { tr: labelTr, en: labelEn },
        offsets,
        fixedTimes: Object.keys(fixedTimes).length ? fixedTimes : null,
      });
    }

    return { sets };
  }

  function defaultIqamaSet() {
    return {
      id: "main",
      label: { tr: "Ana", en: "Main" },
      offsets: { fajr: 20, dhuhr: 10, asr: 10, maghrib: 5, isha: 10 },
      fixedTimes: null,
    };
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
  }

  function t(key) {
    return i18n?.[state.lang]?.[key] || i18n?.tr?.[key] || "";
  }

  i18n.tr = Object.assign(
    {
      loadingMasjid: "Mescid profili yükleniyor…",
      install: "Yükle",
      installTip: "iOS için: Paylaş → Ana Ekrana Ekle",
      offline: "Çevrimdışı",
      updateAvailable: "Güncelleme hazır",
      reload: "Yenile",
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
      loginRequired: "Lütfen giriş yapın.",
      enterEmail: "E-posta girin.",
      loginSent: "Giriş linki gönderildi.",
      signedOut: "Çıkış yapıldı.",
      signedInAs: "Giriş yapan",
      signedOutState: "Giriş yapılmadı",
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
      iqamaIdRequired: "Her ikame seti için id gerekli.",
      iqamaIdUnique: "Ikame set id'leri benzersiz olmalı.",
      iqamaFixedInvalid: "Sabit saat HH:MM formatında olmalı.",
      iqamaMissingOwner: "İkame seti yok. Admin → Mescid Düzenle ile ekleyin.",
      iqamaMissing: "İkame setleri henüz tanımlı değil.",
      iqamaMissingPublic: "İkame setleri mescid linkiyle görünür.",
    },
    i18n.tr || {}
  );

  i18n.en = Object.assign(
    {
      loadingMasjid: "Loading masjid profile…",
      install: "Install",
      installTip: "On iOS: Share → Add to Home Screen",
      offline: "Offline",
      updateAvailable: "Update available",
      reload: "Reload",
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
      loginRequired: "Please sign in.",
      enterEmail: "Enter an email.",
      loginSent: "Login link sent.",
      signedOut: "Signed out.",
      signedInAs: "Signed in as",
      signedOutState: "Not signed in",
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
      iqamaIdRequired: "Each iqama set needs an id.",
      iqamaIdUnique: "Iqama set ids must be unique.",
      iqamaFixedInvalid: "Fixed time must be HH:MM.",
      iqamaMissingOwner: "No iqama sets yet. Add one in Admin → Edit Masjid.",
      iqamaMissing: "Iqama sets are not configured yet.",
      iqamaMissingPublic: "Iqama sets appear when a masjid link is used.",
    },
    i18n.en || {}
  );

  function $(sel) {
    return document.querySelector(sel);
  }

  function showNotice(text, type = "info") {
    if (!el.notice || !el.noticeText) return;
    if (!text) {
      clearNotice();
      return;
    }
    el.notice.hidden = false;
    el.noticeText.textContent = text;
    el.notice.dataset.type = type;
  }

  function clearNotice() {
    if (!el.notice) return;
    el.notice.hidden = true;
    if (el.noticeText) el.noticeText.textContent = "";
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
})();
