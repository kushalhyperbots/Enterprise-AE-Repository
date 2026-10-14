// ============================================================
//  Sales Dashboard — Deal Table (Section 3)
//  Supports: Individual AE top-5 commit picker + Team All-AEs commit view
//  Data syncs via Firebase (if configured) or localStorage.
// ============================================================

const DealTable = (() => {

  let _currentAE    = null;
  let _allDeals     = [];
  let _unsubscribe  = () => {};  // Firebase listener cleanup

  // ----------------------------------------------------------
  //  Format helpers
  // ----------------------------------------------------------
  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return '—'; }
  }

  function _jsEsc(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  // ----------------------------------------------------------
  //  Render the Deal Table tab — Individual AE
  // ----------------------------------------------------------
  function render(deals, ae) {
    _currentAE = ae;
    _allDeals  = deals;
    _unsubscribe();  // Clean up previous listener

    const myDeals    = Parser.dealsForAE(deals, ae)
      .filter(d => d.stage !== CONFIG.CLOSED_WON_STAGE);

    const el = document.getElementById('tab-deals');
    if (!el) return;

    el.innerHTML = `
      <div class="deal-table-layout">

        <!-- Left panel: Picker -->
        <div class="card deal-picker-card">
          <div class="card-header">
            <span class="card-icon">✅</span>
            <div>
              <h3 class="card-title">Select Top 5 Commits</h3>
              <p class="card-subtitle">${ae} · choose up to ${CONFIG.TOP_DEALS_LIMIT} opportunities</p>
            </div>
          </div>
          <div id="deal-picker-list" class="deal-picker-list">
            ${myDeals.length === 0
              ? '<div class="empty-state">No open pipeline deals found for this AE</div>'
              : myDeals.map((d, i) => `
                  <label class="deal-picker-item" id="picker-${i}">
                    <input type="checkbox" class="deal-checkbox" data-opp="${_esc(d.oppName)}"
                           data-stage="${_esc(d.stage)}" data-arr="${d.arr}"
                           data-close="${d.closeDate ? new Date(d.closeDate).toISOString() : ''}">
                    <div class="deal-picker-info">
                      <span class="deal-picker-name">${d.oppName}</span>
                      <span class="deal-picker-meta">
                        <span class="stage-pill">${d.stage}</span>
                        <span class="arr-tag">${Charts.formatCurrency(d.arr)}</span>
                        ${d.closeDate ? `<span class="date-tag">Closes ${fmtDate(d.closeDate)}</span>` : ''}
                      </span>
                    </div>
                  </label>`).join('')
            }
          </div>
          <div class="deal-picker-footer">
            <span id="picker-count" class="picker-count">0 / ${CONFIG.TOP_DEALS_LIMIT} selected</span>
          </div>
        </div>

        <!-- Right panel: Commit table with risk notes -->
        <div class="card deal-commit-card">
          <div class="card-header">
            <span class="card-icon">📌</span>
            <div>
              <h3 class="card-title">Top Commits &amp; Risk Notes</h3>
              <p class="card-subtitle">Editable · auto-saved</p>
            </div>
            <div style="margin-left:auto;display:flex;gap:8px">
              <button id="save-deal-table-btn" class="btn btn--primary btn--sm">💾 Save</button>
              <button id="export-deal-table-btn" class="btn btn--ghost btn--sm">⬇ Export</button>
            </div>
          </div>
          <div id="deal-commit-table-wrap">
            <div class="empty-state">Select deals from the left panel to build your commit list</div>
          </div>
          ${Storage.isFirebaseReady()
            ? '<div class="firebase-badge">⚡ Firebase Sync Active</div>'
            : '<div class="firebase-badge firebase-badge--off">💾 Local Save Only — <a href="#" id="setup-fb-link">Setup Firebase</a></div>'
          }
        </div>

      </div>
    `;

    // Load saved state and populate checkboxes
    _unsubscribe = Storage.subscribeDealTable(ae, (savedDeals) => {
      _applyLoadedDeals(savedDeals, myDeals);
    });

    // Wire up events
    _wireEvents(myDeals);
  }

  // ----------------------------------------------------------
  //  Render the Deal Table tab — All AEs (Team View)
  // ----------------------------------------------------------
  function renderAll(deals) {
    _currentAE = null;
    _allDeals  = deals;
    _unsubscribe();

    const aes = Parser.getUniqueAEs(deals);
    const el  = document.getElementById('tab-deals');
    if (!el) return;

    el.innerHTML = `
      <div id="team-deal-container">
        <!-- Loading state -->
        <div class="card" style="padding:2rem;text-align:center">
          <span style="color:var(--txt-muted)">Loading team commit tables…</span>
        </div>
      </div>
    `;

    _unsubscribe = Storage.subscribeAllDealTables((allTables) => {
      _renderTeamCommitView(deals, aes, allTables || {});
    });
  }

  function _renderTeamCommitView(deals, aes, allTables) {
    const el = document.getElementById('tab-deals');
    if (!el) return;

    // Collect all commits across all AEs
    const allCommits = [];
    const aeSummaries = [];

    aes.forEach(ae => {
      const record  = allTables[ae] || {};
      const commits = record.deals || [];
      const totalARR = commits.reduce((s, c) => s + (c.arr || 0), 0);
      aeSummaries.push({
        ae,
        count: commits.length,
        totalARR,
        commits,
        lastUpdated: record.lastUpdated,
      });

      commits.forEach(c => {
        allCommits.push({
          ae,
          oppName:   c.oppName,
          stage:     c.stage,
          arr:       c.arr || 0,
          closeDate: c.closeDate,
          riskNotes: c.riskNotes || '',
        });
      });
    });

    const teamCommitARR   = allCommits.reduce((s, c) => s + c.arr, 0);
    const activeAEsCount  = aeSummaries.filter(a => a.count > 0).length;

    el.innerHTML = `
      <!-- Team KPI Strip -->
      <div class="team-kpi-strip" style="margin-bottom:1.5rem">
        <div class="team-kpi">
          <span class="team-kpi-val" style="color:var(--accent-green)">${Charts.formatCurrency(teamCommitARR)}</span>
          <span class="team-kpi-lbl">Team Commit ARR</span>
        </div>
        <div class="team-kpi">
          <span class="team-kpi-val" style="color:var(--accent-blue)">${allCommits.length}</span>
          <span class="team-kpi-lbl">Total Committed Deals</span>
        </div>
        <div class="team-kpi">
          <span class="team-kpi-val" style="color:var(--accent-purple)">${activeAEsCount} / ${aes.length}</span>
          <span class="team-kpi-lbl">AEs with Commits</span>
        </div>
        <div class="team-kpi">
          <span class="team-kpi-val" style="color:var(--accent-cyan)">${activeAEsCount > 0 ? Charts.formatCurrency(teamCommitARR / activeAEsCount) : '$0'}</span>
          <span class="team-kpi-lbl">Avg Commit / Active AE</span>
        </div>
      </div>

      <!-- Main Consolidated Commit Table -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-header" style="flex-wrap:wrap">
          <span class="card-icon">📌</span>
          <div>
            <h3 class="card-title">All AEs Top Commits &amp; Risk Notes</h3>
            <p class="card-subtitle">Consolidated view of all AE-selected commit deals across the pipeline</p>
          </div>
          <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
            <button id="export-team-deals-btn" class="btn btn--ghost btn--sm">⬇ Export All Commits (CSV)</button>
          </div>
        </div>

        ${allCommits.length === 0
          ? `<div class="empty-state">
              No AEs have submitted top 5 commits yet.<br>
              <span style="font-size:0.8rem;color:var(--txt-muted);margin-top:0.5rem;display:inline-block">
                Select an individual AE from the dropdown or cards below to pick deals.
              </span>
             </div>`
          : `<div class="scroll-table-wrap" style="max-height:500px">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>AE Primary</th>
                    <th>Opportunity</th>
                    <th>Stage</th>
                    <th class="num">ARR</th>
                    <th>Close Date</th>
                    <th>Risk Notes &amp; Blockers</th>
                    <th style="text-align:center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${allCommits.map((c, i) => `
                    <tr>
                      <td class="num">${i + 1}</td>
                      <td>
                        <span class="badge badge--info" onclick="App.switchToAE('${_jsEsc(c.ae)}')" style="cursor:pointer" title="Switch to ${c.ae}">
                          ${c.ae}
                        </span>
                      </td>
                      <td class="opp-name">${c.oppName}</td>
                      <td><span class="stage-pill">${c.stage}</span></td>
                      <td class="num">${Charts.formatCurrency(c.arr)}</td>
                      <td>${c.closeDate ? fmtDate(new Date(c.closeDate)) : '—'}</td>
                      <td style="max-width:320px">
                        ${c.riskNotes
                          ? `<div style="font-size:0.8rem;color:var(--txt-primary);line-height:1.4">${_esc(c.riskNotes)}</div>`
                          : '<span style="color:var(--txt-muted);font-style:italic;font-size:0.75rem">No risk notes added</span>'
                        }
                      </td>
                      <td style="text-align:center">
                        <button class="btn btn--ghost btn--sm" onclick="App.switchToAE('${_jsEsc(c.ae)}')" title="Edit ${c.ae}'s deals">
                          ✏️ Edit
                        </button>
                      </td>
                    </tr>`).join('')}
                </tbody>
                <tfoot>
                  <tr style="font-weight:700">
                    <td colspan="4" style="text-align:right;color:var(--txt-sec)">Total Team Commit ARR</td>
                    <td class="num" style="color:var(--accent-green)">${Charts.formatCurrency(teamCommitARR)}</td>
                    <td colspan="3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>`
        }

        ${Storage.isFirebaseReady()
          ? '<div class="firebase-badge" style="margin-top:0.75rem">⚡ Firebase Real-time Sync Active across all users</div>'
          : '<div class="firebase-badge firebase-badge--off" style="margin-top:0.75rem">💾 Local Save Only — <a href="#" id="team-setup-fb-link">Setup Firebase</a> for multi-user sync</div>'
        }
      </div>

      <!-- AE Commit Status Cards -->
      <div class="card">
        <div class="card-header">
          <span class="card-icon">👥</span>
          <div>
            <h3 class="card-title">AE Commit Status &amp; Quick Access</h3>
            <p class="card-subtitle">Click any AE to view or edit their commit deals</p>
          </div>
        </div>
        <div class="all-ae-cards">
          ${aeSummaries.map(a => `
            <div class="card all-ae-card" onclick="App.switchToAE('${_jsEsc(a.ae)}')" title="Click to edit ${a.ae}">
              <div class="all-ae-card-name">${a.ae}</div>
              <div class="all-ae-attainment" style="color:${a.count > 0 ? 'var(--accent-green)' : 'var(--txt-muted)'}">
                ${a.count} / ${CONFIG.TOP_DEALS_LIMIT}
              </div>
              <div class="all-ae-arr">${Charts.formatCurrency(a.totalARR)}</div>
              <div class="all-ae-arr-sub">${a.count > 0 ? 'Committed ARR' : 'No commits chosen'}</div>
              <div style="margin-top:0.875rem">
                <button class="btn btn--ghost btn--sm" style="width:100%;justify-content:center">
                  ${a.count > 0 ? '✏️ Manage Commits' : '➕ Select Top 5'}
                </button>
              </div>
            </div>`).join('')}
        </div>
      </div>
    `;

    // Wire team CSV export
    document.getElementById('export-team-deals-btn')?.addEventListener('click', () => {
      _exportTeamCSV(allCommits);
    });

    // Wire Firebase link
    document.getElementById('team-setup-fb-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('firebase-modal')?.classList.add('active');
    });
  }

  function _exportTeamCSV(commits) {
    if (!commits || !commits.length) {
      alert('No commit deals to export.');
      return;
    }

    const header = ['AE-Primary', 'Opportunity', 'Stage', 'ARR', 'Close Date', 'Risk Notes'];
    const rows   = commits.map(c => [
      `"${c.ae.replace(/"/g, '""')}"`,
      `"${c.oppName.replace(/"/g, '""')}"`,
      `"${c.stage.replace(/"/g, '""')}"`,
      c.arr,
      c.closeDate ? new Date(c.closeDate).toLocaleDateString() : '',
      `"${(c.riskNotes || '').replace(/"/g, '""')}"`,
    ]);

    const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `Team_All_AEs_commit_deals.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ----------------------------------------------------------
  //  Events (Individual AE)
  // ----------------------------------------------------------
  function _wireEvents(myDeals) {
    // Checkbox change
    document.querySelectorAll('.deal-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        _enforceLimit();
        _rebuildCommitTable();
      });
    });

    // Save button
    document.getElementById('save-deal-table-btn')?.addEventListener('click', _save);

    // Export button
    document.getElementById('export-deal-table-btn')?.addEventListener('click', _exportCSV);

    // Firebase setup link
    document.getElementById('setup-fb-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('firebase-modal')?.classList.add('active');
    });
  }

  function _enforceLimit() {
    const checked = document.querySelectorAll('.deal-checkbox:checked');
    if (checked.length >= CONFIG.TOP_DEALS_LIMIT) {
      document.querySelectorAll('.deal-checkbox:not(:checked)').forEach(cb => {
        cb.disabled = true;
        cb.closest('label')?.classList.add('disabled');
      });
    } else {
      document.querySelectorAll('.deal-checkbox').forEach(cb => {
        cb.disabled = false;
        cb.closest('label')?.classList.remove('disabled');
      });
    }
    const countEl = document.getElementById('picker-count');
    if (countEl) countEl.textContent = `${checked.length} / ${CONFIG.TOP_DEALS_LIMIT} selected`;
  }

  function _rebuildCommitTable() {
    const checked = [...document.querySelectorAll('.deal-checkbox:checked')];
    const wrap    = document.getElementById('deal-commit-table-wrap');
    if (!wrap) return;

    if (!checked.length) {
      wrap.innerHTML = '<div class="empty-state">Select deals from the left panel to build your commit list</div>';
      return;
    }

    const rows = checked.map(cb => {
      const opp   = cb.dataset.opp;
      const stage = cb.dataset.stage;
      const arr   = parseFloat(cb.dataset.arr) || 0;
      const close = cb.dataset.close;
      // Preserve any existing risk note
      const existingNote = wrap.querySelector(`[data-risk-opp="${CSS.escape(opp)}"]`)?.value || '';
      return { opp, stage, arr, close, existingNote };
    });

    wrap.innerHTML = `
      <div class="scroll-table-wrap">
        <table class="data-table commit-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Opportunity</th>
              <th>Stage</th>
              <th class="num">ARR</th>
              <th>Close Date</th>
              <th>Risk Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr>
                <td class="num">${i + 1}</td>
                <td class="opp-name">${r.opp}</td>
                <td><span class="stage-pill">${r.stage}</span></td>
                <td class="num">${Charts.formatCurrency(r.arr)}</td>
                <td>${r.close ? fmtDate(new Date(r.close)) : '—'}</td>
                <td>
                  <textarea class="risk-notes" data-risk-opp="${_esc(r.opp)}"
                    placeholder="Describe any risks, blockers, or concerns..."
                    rows="2">${r.existingNote}</textarea>
                </td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align:right;color:#94a3b8;font-size:0.75rem">Total ARR</td>
              <td class="num" style="color:#10b981;font-weight:700">
                ${Charts.formatCurrency(rows.reduce((s, r) => s + r.arr, 0))}
              </td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    // Auto-save on risk note change
    wrap.querySelectorAll('.risk-notes').forEach(ta => {
      ta.addEventListener('input', _debounce(_save, 1500));
    });
  }

  function _applyLoadedDeals(savedDeals, myDeals) {
    if (!savedDeals || !savedDeals.length) return;

    const savedNames = new Set(savedDeals.map(d => d.oppName));

    // Check the boxes
    document.querySelectorAll('.deal-checkbox').forEach(cb => {
      if (savedNames.has(cb.dataset.opp)) {
        cb.checked = true;
      }
    });

    _enforceLimit();

    // Build table first so we can fill notes
    _rebuildCommitTable();

    // Fill in risk notes
    savedDeals.forEach(d => {
      const ta = document.querySelector(`[data-risk-opp="${CSS.escape(d.oppName)}"]`);
      if (ta) ta.value = d.riskNotes || '';
    });
  }

  function _collectCommits() {
    const checked = [...document.querySelectorAll('.deal-checkbox:checked')];
    return checked.map(cb => {
      const opp  = cb.dataset.opp;
      const ta   = document.querySelector(`[data-risk-opp="${CSS.escape(opp)}"]`);
      return {
        oppName:   opp,
        stage:     cb.dataset.stage,
        arr:       parseFloat(cb.dataset.arr) || 0,
        closeDate: cb.dataset.close,
        riskNotes: ta?.value?.trim() || '',
      };
    });
  }

  function _save() {
    if (!_currentAE) return;
    const commits = _collectCommits();
    Storage.saveDealTable(_currentAE, commits);
    _flashSaved();
  }

  function _flashSaved() {
    const btn = document.getElementById('save-deal-table-btn');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '✓ Saved!';
    btn.classList.add('btn--success');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('btn--success'); }, 2000);
  }

  function _exportCSV() {
    if (!_currentAE) return;
    const commits = _collectCommits();
    if (!commits.length) { alert('No deals selected to export.'); return; }

    const header = ['AE-Primary', 'Opportunity', 'Stage', 'ARR', 'Close Date', 'Risk Notes'];
    const rows   = commits.map(c => [
      _currentAE,
      `"${c.oppName.replace(/"/g, '""')}"`,
      `"${c.stage.replace(/"/g, '""')}"`,
      c.arr,
      c.closeDate ? new Date(c.closeDate).toLocaleDateString() : '',
      `"${(c.riskNotes || '').replace(/"/g, '""')}"`,
    ]);

    const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `${_currentAE.replace(/\s+/g, '_')}_commit_deals.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ----------------------------------------------------------
  //  Utilities
  // ----------------------------------------------------------
  function _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  return { render, renderAll };
})();
