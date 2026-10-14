// ============================================================
//  Sales Dashboard — Funnel Snapshot  (Section 1)
//  Supports: individual AE view + All AEs team view
// ============================================================

const Funnel = (() => {

  // ----------------------------------------------------------
  //  Compute metrics for one AE
  // ----------------------------------------------------------
  function compute(deals, ae) {
    const myDeals = Parser.dealsForAE(deals, ae);
    const quota   = CONFIG.getQuota(ae);
    const qtr     = Parser.getCurrentQuarter();

    const closedWon    = myDeals.filter(d => d.stage === CONFIG.CLOSED_WON_STAGE);
    const closedWonARR = closedWon.reduce((s, d) => s + d.arr, 0);
    const attainmentPct = quota > 0 ? (closedWonARR / quota) * 100 : 0;

    const pipelineDeals = myDeals.filter(d => d.stage !== CONFIG.CLOSED_WON_STAGE);
    const pipelineARR   = pipelineDeals.reduce((s, d) => s + d.arr, 0);

    const commitDeals = myDeals.filter(d => {
      if (!d.closeDate) return false;
      return d.closeDate >= qtr.start && d.closeDate <= qtr.end;
    });
    const commitARR = commitDeals.reduce((s, d) => s + d.arr, 0);

    return {
      ae, quota, closedWonARR, attainmentPct,
      closedWonDeals: closedWon.length,
      pipelineDeals:  pipelineDeals.length,
      pipelineARR,
      commitDeals:    commitDeals.length,
      commitARR,
      quarter: `Q${qtr.q} ${qtr.year}`,
    };
  }

  // ----------------------------------------------------------
  //  Render — individual AE
  // ----------------------------------------------------------
  function render(deals, ae) {
    const m   = compute(deals, ae);
    const el  = document.getElementById('tab-funnel');
    if (!el) return;

    el.innerHTML = `
      <div class="funnel-grid">

        <!-- Quota Attainment -->
        <div class="card card--large funnel-attainment">
          <div class="card-header">
            <span class="card-icon">🎯</span>
            <div>
              <h3 class="card-title">Quota Attainment</h3>
              <p class="card-subtitle">${m.quarter} · Target ${Charts.formatCurrency(m.quota)}</p>
            </div>
            <span class="badge ${_attainBadge(m.attainmentPct)}">${_attainLabel(m.attainmentPct)}</span>
          </div>
          <div class="gauge-wrap">
            <canvas id="gauge-canvas" height="160"></canvas>
          </div>
          <div class="funnel-stats-row">
            <div class="stat">
              <span class="stat-val">${Charts.formatCurrency(m.closedWonARR)}</span>
              <span class="stat-lbl">Closed Won ARR</span>
            </div>
            <div class="stat-sep"></div>
            <div class="stat">
              <span class="stat-val">${m.closedWonDeals}</span>
              <span class="stat-lbl">Deals Won</span>
            </div>
            <div class="stat-sep"></div>
            <div class="stat">
              <span class="stat-val">${Charts.formatCurrency(Math.max(0, m.quota - m.closedWonARR))}</span>
              <span class="stat-lbl">Remaining</span>
            </div>
          </div>
        </div>

        <!-- Pipeline Coverage -->
        <div class="card funnel-pipeline">
          <div class="card-header">
            <span class="card-icon">📊</span>
            <div>
              <h3 class="card-title">Pipeline Coverage</h3>
              <p class="card-subtitle">All active deals</p>
            </div>
          </div>
          <div class="big-number">${Charts.formatCurrency(m.pipelineARR)}</div>
          <div class="big-number-sub">Total Pipeline ARR</div>
          <div class="funnel-stats-row" style="margin-top:1.5rem">
            <div class="stat">
              <span class="stat-val">${m.pipelineDeals}</span>
              <span class="stat-lbl">Active Deals</span>
            </div>
            <div class="stat-sep"></div>
            <div class="stat">
              <span class="stat-val">${m.quota > 0 ? (m.pipelineARR / m.quota * 100).toFixed(0) + '%' : '—'}</span>
              <span class="stat-lbl">vs Quota</span>
            </div>
          </div>
          <div class="coverage-bar-wrap">
            <div class="coverage-bar-track">
              <div class="coverage-bar-fill" style="width:${Math.min((m.pipelineARR/m.quota)*100,100)}%"></div>
            </div>
          </div>
        </div>

        <!-- Commit Total -->
        <div class="card funnel-commit">
          <div class="card-header">
            <span class="card-icon">📅</span>
            <div>
              <h3 class="card-title">Commit Total</h3>
              <p class="card-subtitle">Close date in ${m.quarter}</p>
            </div>
          </div>
          <div class="big-number commit-color">${Charts.formatCurrency(m.commitARR)}</div>
          <div class="big-number-sub">Committed ARR</div>
          <div class="funnel-stats-row" style="margin-top:1.5rem">
            <div class="stat">
              <span class="stat-val">${m.commitDeals}</span>
              <span class="stat-lbl">Deals Committing</span>
            </div>
            <div class="stat-sep"></div>
            <div class="stat">
              <span class="stat-val">${m.quota > 0 ? (m.commitARR / m.quota * 100).toFixed(0) + '%' : '—'}</span>
              <span class="stat-lbl">of Quota</span>
            </div>
          </div>
        </div>

      </div>`;

    requestAnimationFrame(() => {
      Charts.renderGauge('gauge-canvas', m.attainmentPct, 'Attainment');
    });
  }

  // ----------------------------------------------------------
  //  Render — All AEs team view
  // ----------------------------------------------------------
  function renderAll(deals) {
    const aes     = Parser.getUniqueAEs(deals);
    const metrics = aes.map(ae => compute(deals, ae))
                       .sort((a, b) => b.attainmentPct - a.attainmentPct);
    const qtr = metrics[0]?.quarter || '';
    const el  = document.getElementById('tab-funnel');
    if (!el) return;

    const totalCW      = metrics.reduce((s, m) => s + m.closedWonARR, 0);
    const totalPipe    = metrics.reduce((s, m) => s + m.pipelineARR,  0);
    const totalCommit  = metrics.reduce((s, m) => s + m.commitARR,    0);
    const totalQuota   = metrics.reduce((s, m) => s + m.quota,        0);
    const onTrack      = metrics.filter(m => m.attainmentPct >= 100).length;
    const teamAttain   = totalQuota > 0 ? (totalCW / totalQuota) * 100 : 0;

    el.innerHTML = `
      <!-- Team KPI Strip -->
      <div class="team-kpi-strip">
        <div class="team-kpi">
          <span class="team-kpi-val">${Charts.formatCurrency(totalCW)}</span>
          <span class="team-kpi-lbl">Team Closed Won</span>
        </div>
        <div class="team-kpi">
          <span class="team-kpi-val" style="color:var(--accent-cyan)">${Charts.formatCurrency(totalPipe)}</span>
          <span class="team-kpi-lbl">Total Pipeline</span>
        </div>
        <div class="team-kpi">
          <span class="team-kpi-val" style="color:var(--accent-purple)">${Charts.formatCurrency(totalCommit)}</span>
          <span class="team-kpi-lbl">Total Commit</span>
        </div>
        <div class="team-kpi">
          <span class="team-kpi-val" style="color:${teamAttain>=100?'var(--accent-green)':teamAttain>=70?'var(--accent-amber)':'var(--accent-blue)'}">${Math.round(teamAttain)}%</span>
          <span class="team-kpi-lbl">Team Attainment</span>
        </div>
        <div class="team-kpi">
          <span class="team-kpi-val" style="color:var(--accent-green)">${onTrack} / ${metrics.length}</span>
          <span class="team-kpi-lbl">AEs On Track</span>
        </div>
      </div>

      <!-- AE Comparison Table -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-header">
          <span class="card-icon">👥</span>
          <div>
            <h3 class="card-title">Team Overview</h3>
            <p class="card-subtitle">${qtr} · Click any row to drill into that AE's dashboard</p>
          </div>
        </div>
        <div class="scroll-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>AE Name</th>
                <th class="num">Quota</th>
                <th>Attainment</th>
                <th class="num">Closed Won</th>
                <th class="num">Pipeline</th>
                <th class="num">Commit</th>
                <th class="num">Deals</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${metrics.map(m => `
                <tr class="ae-row" onclick="App.switchToAE('${_jsEsc(m.ae)}')" title="Click to view ${m.ae}'s dashboard">
                  <td style="font-weight:600;color:var(--txt-primary)">${m.ae}</td>
                  <td class="num">${Charts.formatCurrency(m.quota)}</td>
                  <td>
                    <div class="attain-cell">
                      <div class="mini-progress-track">
                        <div class="mini-progress-fill" style="width:${Math.min(m.attainmentPct,100)}%;background:${_attainColor(m.attainmentPct)}"></div>
                      </div>
                      <span class="attain-pct" style="color:${_attainColor(m.attainmentPct)}">${Math.round(m.attainmentPct)}%</span>
                    </div>
                  </td>
                  <td class="num">${Charts.formatCurrency(m.closedWonARR)}</td>
                  <td class="num">${Charts.formatCurrency(m.pipelineARR)}</td>
                  <td class="num">${Charts.formatCurrency(m.commitARR)}</td>
                  <td class="num">${m.pipelineDeals}</td>
                  <td><span class="badge ${_attainBadge(m.attainmentPct)}">${_attainLabel(m.attainmentPct)}</span></td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight:700">
                <td style="color:var(--txt-sec)">Team Total</td>
                <td class="num">${Charts.formatCurrency(totalQuota)}</td>
                <td>
                  <div class="attain-cell">
                    <div class="mini-progress-track">
                      <div class="mini-progress-fill" style="width:${Math.min(teamAttain,100)}%;background:${_attainColor(teamAttain)}"></div>
                    </div>
                    <span class="attain-pct" style="color:${_attainColor(teamAttain)}">${Math.round(teamAttain)}%</span>
                  </div>
                </td>
                <td class="num" style="color:var(--accent-green)">${Charts.formatCurrency(totalCW)}</td>
                <td class="num" style="color:var(--accent-blue)">${Charts.formatCurrency(totalPipe)}</td>
                <td class="num" style="color:var(--accent-purple)">${Charts.formatCurrency(totalCommit)}</td>
                <td class="num">${metrics.reduce((s,m)=>s+m.pipelineDeals,0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Individual AE attainment cards -->
      <div class="all-ae-cards">
        ${metrics.map(m => `
          <div class="card all-ae-card" onclick="App.switchToAE('${_jsEsc(m.ae)}')" title="Click to view ${m.ae}">
            <div class="all-ae-card-name">${m.ae}</div>
            <div class="all-ae-attainment" style="color:${_attainColor(m.attainmentPct)}">${Math.round(m.attainmentPct)}%</div>
            <div class="all-ae-arr">${Charts.formatCurrency(m.closedWonARR)}</div>
            <div class="all-ae-arr-sub">of ${Charts.formatCurrency(m.quota)}</div>
            <div class="mini-progress-track" style="margin-top:0.875rem">
              <div class="mini-progress-fill" style="width:${Math.min(m.attainmentPct,100)}%;background:${_attainColor(m.attainmentPct)}"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:0.75rem;font-size:0.72rem;color:var(--txt-muted)">
              <span>${m.pipelineDeals} deals</span>
              <span>Commit ${Charts.formatCurrency(m.commitARR)}</span>
            </div>
          </div>`).join('')}
      </div>
    `;
  }

  // ----------------------------------------------------------
  //  Helpers
  // ----------------------------------------------------------
  function _attainBadge(pct) {
    if (pct >= 100) return 'badge--success';
    if (pct >= 70)  return 'badge--warning';
    return 'badge--info';
  }
  function _attainLabel(pct) {
    if (pct >= 100) return '✓ On Track';
    if (pct >= 70)  return '⚡ At Risk';
    return '⚠ Behind';
  }
  function _attainColor(pct) {
    if (pct >= 100) return 'var(--accent-green)';
    if (pct >= 70)  return 'var(--accent-amber)';
    return 'var(--accent-blue)';
  }
  function _jsEsc(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  return { render, renderAll, compute };
})();
