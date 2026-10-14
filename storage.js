// ============================================================
//  Sales Dashboard — Storage Adapter
//  Handles localStorage (always) + Firebase Realtime DB (optional)
// ============================================================

const Storage = (() => {

  let _firebaseApp = null;
  let _db          = null;  // Firebase database reference
  let _fbRef       = null;  // Root ref for deal tables

  // ----------------------------------------------------------
  //  Firebase initialisation
  // ----------------------------------------------------------
  function initFirebase(config) {
    try {
      if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded.');
        return false;
      }
      // Avoid re-initialising with same config
      if (_firebaseApp) {
        try { _firebaseApp.delete(); } catch (_) {}
      }
      _firebaseApp = firebase.initializeApp(config, 'salesDashboard');
      _db          = firebase.database(_firebaseApp);
      _fbRef       = _db.ref('salesDashboard/dealTables');
      console.log('Firebase connected ✓');
      return true;
    } catch (err) {
      console.error('Firebase init failed:', err);
      return false;
    }
  }

  function loadFirebaseConfig() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.FIREBASE_CONFIG);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function saveFirebaseConfig(configObj) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(configObj));
  }

  function tryInitFromStorage() {
    const cfg = loadFirebaseConfig();
    if (cfg) return initFirebase(cfg);
    return false;
  }

  function isFirebaseReady() {
    return !!_fbRef;
  }

  // ----------------------------------------------------------
  //  Weekly data persistence (localStorage)
  // ----------------------------------------------------------
  function saveCurrentData(payload) {
    // Before saving, promote current → prev
    const prev = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_DATA);
    const prevDate = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_DATE);
    if (prev) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.PREV_DATA, prev);
      localStorage.setItem(CONFIG.STORAGE_KEYS.PREV_DATE, prevDate || '');
    }
    localStorage.setItem(
      CONFIG.STORAGE_KEYS.CURRENT_DATA,
      JSON.stringify(payload.deals)
    );
    localStorage.setItem(
      CONFIG.STORAGE_KEYS.CURRENT_DATE,
      payload.uploadDate.toISOString()
    );
  }

  function loadCurrentData() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_DATA);
    if (!raw) return null;
    try {
      return {
        deals: _rehydrateDates(JSON.parse(raw)),
        uploadDate: new Date(localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_DATE) || Date.now()),
      };
    } catch { return null; }
  }

  function loadPrevData() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.PREV_DATA);
    if (!raw) return null;
    try {
      return {
        deals: _rehydrateDates(JSON.parse(raw)),
        uploadDate: new Date(localStorage.getItem(CONFIG.STORAGE_KEYS.PREV_DATE) || Date.now()),
      };
    } catch { return null; }
  }

  /** JSON.parse loses Date objects — convert ISO strings back */
  function _rehydrateDates(deals) {
    return deals.map(d => ({
      ...d,
      closeDate:          d.closeDate          ? new Date(d.closeDate)          : null,
      lastInteractionDate: d.lastInteractionDate ? new Date(d.lastInteractionDate) : null,
      nextStepDate:       d.nextStepDate       ? new Date(d.nextStepDate)       : null,
    }));
  }

  // ----------------------------------------------------------
  //  Deal Tables — save / load / subscribe
  // ----------------------------------------------------------

  /** Sanitise AE name for use as a Firebase key */
  function _aeKey(aeName) {
    return aeName.replace(/[.#$[\]/]/g, '_');
  }

  /** Save deal table for one AE (Firebase preferred, localStorage fallback) */
  function saveDealTable(aeName, tableData) {
    const payload = {
      deals:       tableData,
      lastUpdated: new Date().toISOString(),
      updatedBy:   aeName,
    };

    // Local fallback always written
    const all = _loadLocalDealTables();
    all[aeName] = payload;
    localStorage.setItem(CONFIG.STORAGE_KEYS.DEAL_TABLES, JSON.stringify(all));

    // Firebase write (if ready)
    if (isFirebaseReady()) {
      _fbRef.child(_aeKey(aeName)).set(payload);
    }
  }

  function loadDealTable(aeName) {
    const all = _loadLocalDealTables();
    return all[aeName]?.deals || [];
  }

  function _loadLocalDealTables() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.DEAL_TABLES);
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  }

  /**
   * Subscribe to real-time deal-table changes for a given AE.
   * callback(deals) is called whenever the data changes.
   * Returns an unsubscribe function.
   */
  function subscribeDealTable(aeName, callback) {
    if (!isFirebaseReady()) {
      // No Firebase — just call back once with local data
      callback(loadDealTable(aeName));
      return () => {};
    }
    const ref = _fbRef.child(_aeKey(aeName));
    const handler = ref.on('value', (snap) => {
      const data = snap.val();
      callback(data?.deals || []);
    });
    return () => ref.off('value', handler);
  }

  /**
   * Subscribe to all AE deal tables (for read-only overview).
   */
  function subscribeAllDealTables(callback) {
    if (!isFirebaseReady()) {
      callback(_loadLocalDealTables());
      return () => {};
    }
    const handler = _fbRef.on('value', (snap) => {
      callback(snap.val() || {});
    });
    return () => _fbRef.off('value', handler);
  }

  // ----------------------------------------------------------
  //  Selected AE persistence
  // ----------------------------------------------------------
  function saveSelectedAE(ae) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.SELECTED_AE, ae);
  }

  function loadSelectedAE() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.SELECTED_AE) || null;
  }

  return {
    // Firebase
    initFirebase,
    loadFirebaseConfig,
    saveFirebaseConfig,
    tryInitFromStorage,
    isFirebaseReady,
    // Weekly data
    saveCurrentData,
    loadCurrentData,
    loadPrevData,
    // Deal tables
    saveDealTable,
    loadDealTable,
    subscribeDealTable,
    subscribeAllDealTables,
    // AE
    saveSelectedAE,
    loadSelectedAE,
  };
})();
