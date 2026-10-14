// ============================================================
//  Sales Dashboard — App Entry Point  (v3 — All AEs view)
// ============================================================

const App = (() => {
  const ALL_AE_KEY = '__ALL__';

  // ----------------------------------------------------------
  //  State
  // ----------------------------------------------------------
  let _deals      = [];
  let _prevDeals  = [];
  let _aes        = [];
  let _activeAE   = ALL_AE_KEY;   // default: All AEs
  let _activeTab  = 'funnel';
  let _uploadDate = null;

  // ----------------------------------------------------------
  //  Initialise
  // ----------------------------------------------------------
  function init() {
    Storage.tryInitFromStorage();

    const saved = Storage.loadCurrentData();
    if (saved) {
      _deals      = saved.deals;
      _uploadDate = saved.uploadDate;
      const prev  = Storage.loadPrevData();
      if (prev) _prevDeals = prev.deals;
      _bootstrapApp();
    } else {
      _showUploadOverlay();
    }

    _wireDragDrop();
    _wireUploadBtn();
    _wireFirebaseModal();
    _wireTabs();
    _wireAESelector();
    _wireHeaderButtons();
  }

  // ----------------------------------------------------------
  //  Upload
  // ----------------------------------------------------------
  function _showUploadOverlay() {
    document.getElementById('upload-overlay').classList.add('active');
    document.getElementById('app').classList.add('hidden');
  }

  function _hideUploadOverlay() {
    document.getElementById('upload-overlay').classList.remove('active');
    document.getElementById('app').classList.remove('hidden');
  }

  function _handleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      _showError('Please upload an Excel (.xlsx / .xls) file.');
      return;
    }

    _setUploadStatus('⏳ Parsing…', 'loading');

    Parser.parseExcelFile(file)
      .then((result) => {
        if (_deals.length) _prevDeals = _deals;
        _deals      = result.deals;
        _uploadDate = result.uploadDate;
        Storage.saveCurrentData(result);
        _bootstrapApp();
        _setUploadStatus(`✓ Loaded ${result.deals.length} deals`, 'success');
        setTimeout(_hideUploadOverlay, 700);
      })
      .catch((err) => {
        console.error(err);
        _setUploadStatus('✗ ' + err.message, 'error');
      });
  }

  function _setUploadStatus(msg, type) {
    const el = document.getElementById('upload-status');
    if (!el) return;
    el.textContent = msg;
    el.className   = 'upload-status upload-status--' + type;
  }

  function _wireDragDrop() {
    const zone = document.getElementById('drop-zone');
    if (!zone) return;
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragging'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('dragging'); _handleFile(e.dataTransfer.files[0]); });
    zone.addEventListener('click', () => document.getElementById('file-input').click());
  }

  function _wireUploadBtn() {
    const input = document.getElementById('file-input');
    if (input) input.addEventListener('change', () => _handleFile(input.files[0]));
    document.getElementById('upload-new-btn')?.addEventListener('click', _showUploadOverlay);
  }

  // ----------------------------------------------------------
  //  Bootstrap
  // ----------------------------------------------------------
  function _bootstrapApp() {
    _aes = Parser.getUniqueAEs(_deals);
    _populateAESelector();

    // Restore last selected AE; default to "All AEs"
    const saved = Storage.loadSelectedAE();
    if (saved === ALL_AE_KEY || _aes.includes(saved)) {
      _activeAE = saved;
    } else {
      _activeAE = ALL_AE_KEY;
    }

    const sel = document.getElementById('ae-selector');
    if (sel) sel.value = _activeAE;

    _updateWeekInfo();
    _renderActiveTab();
    _hideUploadOverlay();
  }

  // ----------------------------------------------------------
  //  AE Selector
  // ----------------------------------------------------------
  function _populateAESelector() {
    const sel = document.getElementById('ae-selector');
    if (!sel) return;
    sel.innerHTML =
      `<option value="${ALL_AE_KEY}">👥 All AEs (Team View)</option>` +
      `<optgroup label="Individual AEs">` +
      _aes.map(ae => `<option value="${_esc(ae)}">${ae}</option>`).join('') +
      `</optgroup>`;
  }

  function _wireAESelector() {
    document.getElementById('ae-selector')?.addEventListener('change', (e) => {
      _activeAE = e.target.value;
      Storage.saveSelectedAE(_activeAE);
      Charts.destroyAll();
      _renderActiveTab();
    });
  }

  // Public: allow funnel/pipeline "drill-down" cards to switch AE
  function switchToAE(ae) {
    _activeAE = ae;
    Storage.saveSelectedAE(ae);
    const sel = document.getElementById('ae-selector');
    if (sel) sel.value = ae;
    Charts.destroyAll();
    _renderActiveTab();
  }

  // ----------------------------------------------------------
  //  Tabs
  // ----------------------------------------------------------
  function _wireTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === _activeTab) return;
        _activeTab = tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        document.getElementById('tab-' + tab)?.classList.add('active');
        Charts.destroyAll();
        _renderActiveTab();
      });
    });
  }

  function _renderActiveTab() {
    if (!_deals.length) return;
    Charts.destroyAll();

    const isAll = _activeAE === ALL_AE_KEY;
    const prev  = _prevDeals.length ? _prevDeals : null;

    switch (_activeTab) {
      case 'funnel':
        isAll ? Funnel.renderAll(_deals) : Funnel.render(_deals, _activeAE);
        break;
      case 'pipeline':
        isAll ? Pipeline.renderAll(_deals, prev) : Pipeline.render(_deals, _activeAE, prev);
        break;
      case 'deals':
        isAll ? DealTable.renderAll(_deals) : DealTable.render(_deals, _activeAE);
        break;
    }
  }

  // ----------------------------------------------------------
  //  Header buttons
  // ----------------------------------------------------------
  function _wireHeaderButtons() {
    document.getElementById('firebase-setup-btn')?.addEventListener('click', () => {
      const modal = document.getElementById('firebase-modal');
      const saved = Storage.loadFirebaseConfig();
      if (saved) document.getElementById('fb-config-input').value = JSON.stringify(saved, null, 2);
      modal?.classList.add('active');
    });
  }

  // ----------------------------------------------------------
  //  Firebase modal
  // ----------------------------------------------------------
  function _wireFirebaseModal() {
    document.getElementById('fb-modal-close')?.addEventListener('click', () => {
      document.getElementById('firebase-modal')?.classList.remove('active');
    });

    document.getElementById('fb-save-btn')?.addEventListener('click', () => {
      const raw = document.getElementById('fb-config-input')?.value?.trim();
      if (!raw) return;
      try {
        const cfg = JSON.parse(raw);
        Storage.saveFirebaseConfig(cfg);
        const ok = Storage.initFirebase(cfg);
        const statusEl = document.getElementById('fb-status');
        if (ok) {
          statusEl.textContent = '✓ Firebase connected!';
          statusEl.className   = 'fb-status fb-status--ok';
          setTimeout(() => { document.getElementById('firebase-modal')?.classList.remove('active'); _renderActiveTab(); }, 1500);
        } else {
          statusEl.textContent = '✗ Connection failed — check config.';
          statusEl.className   = 'fb-status fb-status--err';
        }
      } catch (e) {
        document.getElementById('fb-status').textContent = '✗ Invalid JSON: ' + e.message;
        document.getElementById('fb-status').className   = 'fb-status fb-status--err';
      }
    });

    document.getElementById('fb-clear-btn')?.addEventListener('click', () => {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.FIREBASE_CONFIG);
      document.getElementById('fb-config-input').value = '';
      document.getElementById('fb-status').textContent = 'Config cleared.';
      document.getElementById('fb-status').className   = 'fb-status';
    });

    document.getElementById('firebase-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'firebase-modal') document.getElementById('firebase-modal').classList.remove('active');
    });
  }

  // ----------------------------------------------------------
  //  Week info
  // ----------------------------------------------------------
  function _updateWeekInfo() {
    const el = document.getElementById('week-info');
    if (!el || !_uploadDate) return;
    el.textContent = 'Data: ' + new Date(_uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (_prevDeals.length) { el.title = 'Previous upload available'; el.classList.add('has-prev'); }
  }

  function _showError(msg) {
    const el = document.getElementById('upload-status');
    if (el) { el.textContent = msg; el.className = 'upload-status upload-status--error'; }
    else alert(msg);
  }

  function _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ----------------------------------------------------------
  //  Boot
  // ----------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { switchToAE };
})();
