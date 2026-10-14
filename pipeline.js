// ============================================================
//  Sales Dashboard — Pipeline Section (Section 2)
//  Supports: Individual AE view + All AEs team view
// ============================================================

const Pipeline = (() => {

  // ----------------------------------------------------------
  //  Date helpers
  // ----------------------------------------------------------
  const NOW = () => new Date();

  function daysDiff(date) {
    if (!date) return Infinity;
    const diffMs = NOW() - new Date(date);
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  function fmtDate(date) {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return '—'; }
  }

  function fmtDateShort(date) {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
      });
    } catch { return '—'; }
  }

  function _jsEsc(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ----------------------------------------------------------
  //  Compute all pipeline metrics for one AE
  // ----------------------------------------------------------
  function compute(deals, ae, prevDeals) {
    const myDeals = Parser.dealsForAE(deals, ae);

    // 2a. New Pipeline — age <= 7 days
    const newPipeline = myDeals.filter(d => d.age <= CONFIG.NEW_OPP_AGE_DAYS);

    // Group new pipeline by stage for pie chart
    const newByStage = _groupBy(newPipeline, 'stage');

    // 2b. Last Meeting / Next Steps table (all AE deals)
    const meetingRows = myDeals.map(d => ({
      oppName:        d.oppName,
      accountName:    d.accountName,
      lastDate:       d.lastInteractionDate,
      interactionRaw: d.interactionHistory,
      nextDate:       d.nextStepDate,
      nextDesc:       d.nextStepDesc,
      daysAgo:        daysDiff(d.lastInteractionDate),
    })).sort((a, b) => {
      if (!a.lastDate) return 1;
      if (!b.lastDate) return -1;
      return new Date(b.lastDate) - new Date(a.lastDate);
    });

    // 2c. Meetings held last week
    const metLastWeek = myDeals.filter(
      d => d.lastInteractionDate && daysDiff(d.lastInteractionDate) <= CONFIG.RECENT_MEETING_DAYS
    );

    // 2d. Deals & value per stage
    const byStage = _groupBy(myDeals, 'stage');

    // 2e. Days in Stage
    const daysInStage = myDeals.map(d => ({
      oppName:  d.oppName,
      stage:    d.stage,
      duration: d.stageDuration,
      arr:      d.arr,
    })).sort((a, b) => b.duration - a.duration);

    // 2f. Week-over-week change
    let wow = null;
    if (prevDeals) {
      const prevMy = Parser.dealsForAE(prevDeals, ae);
      wow = _computeWoW(myDeals, prevMy);
    }

    return {
      newPipeline, newByStage,
      meetingRows,
      metLastWeek,
      byStage,
      daysInStage,
      wow,
    };
  }

  // ----------------------------------------------------------
  //  Compute team-wide metrics (All AEs)
  // ----------------------------------------------------------
  function computeAll(deals, prevDeals) {
    // 2a. Team New Pipeline — age <= 7 days
    const newPipeline = deals.filter(d => d.age <= CONFIG.NEW_OPP_AGE_DAYS);
    const newByStage  = _groupBy(newPipeline, 'stage');
    const newByAE     = _groupBy(newPipeline, 'aePrimary');

    // 2b. Team Last Meeting / Next Steps table (all active deals)
    const meetingRows = deals.map(d => ({
      ae:             d.aePrimary,
      oppName:        d.oppName,
      accountName:    d.accountName,
      lastDate:       d.lastInteractionDate,
      interactionRaw: d.interactionHistory,
      nextDate:       d.nextStepDate,
      nextDesc:       d.nextStepDesc,
      daysAgo:        daysDiff(d.lastInteractionDate),
    })).sort((a, b) => {
      if (!a.lastDate) return 1;
      if (!b.lastDate) return -1;
      return new Date(b.lastDate) - new Date(a.lastDate);
    });

    // 2c. Team Meetings held last week
    const metLastWeek = deals.filter(
      d => d.lastInteractionDate && daysDiff(d.lastInteractionDate) <= CONFIG.RECENT_MEETING_DAYS
    );

    // Group meetings by AE
    const metByAEMap = {};
    metLastWeek.forEach(d => {
      metByAEMap[d.aePrimary] = (metByAEMap[d.aePrimary] || 0) + 1;
    });
    const metByAE = Object.entries(metByAEMap)
      .map(([ae, count]) => ({ ae, count }))
      .sort((a, b) => b.count - a.count);

    // 2d. Team Deals & value per stage
    const byStage = _groupBy(deals, 'stage');

    // 2e. Team Days in Stage
    const daysInStage = deals.map(d => ({
      ae:       d.aePrimary,
      oppName:  d.oppName,
      stage:    d.stage,
      duration: d.stageDuration,
      arr:      d.arr,
    })).sort((a, b) => b.duration - a.duration);

    // 2f. Team Week-over-week change
    let wow = null;
    if (prevDeals) {
      wow = _computeWoW(deals, prevDeals);
    }

    return {
      newPipeline, newByStage, newByAE,
      meetingRows,
      metLastWeek, metByAE,
      byStage,
      daysInStage,
      wow,
    };
  }

  function _groupBy(deals, field) {
    const map = {};
    deals.forEach(d => {
      const key = d[field] || 'Unknown';
      if (!map[key]) map[key] = { stage: key, deals: [], totalARR: 0 };
      map[key].deals.push(d);
      map[key].totalARR += d.arr;
    });
    return Object.values(map).sort((a, b) => b.totalARR - a.totalARR);
  }

  function _computeWoW(curr, prev) {
    const currARR   = curr.reduce((s, d) => s + d.arr, 0);
    const prevARR   = prev.reduce((s, d) => s + d.arr, 0);
    const currWon   = curr.filter(d => d.stage === CONFIG.CLOSED_WON_STAGE).reduce((s, d) => s + d.arr, 0);
    const prevWon   = prev.filter(d => d.stage === CONFIG.CLOSED_WON_STAGE).reduce((s, d) => s + d.arr, 0);
    const currCount = curr.length;
    const prevCount = prev.length;

    // New deals this week (by opp name)
    const prevNames = new Set(prev.map(d => d.oppName));
    const newDeals  = curr.filter(d => !prevNames.has(d.oppName));
    const lostDeals = prev.filter(d => !new Set(curr.map(x => x.oppName)).has(d.oppName));

    return {
      deltaARR:   currARR - prevARR,
      deltaWon:   currWon - prevWon,
      deltaCount: currCount - prevCount,
      newDeals,
      lostDeals,
    };
  }

  // ----------------------------------------------------------
  //  Render — Individual AE
  // ----------------------------------------------------------
  function render(deals, ae, prevDeals) {
    const m  = compute(deals, ae, prevDeals);
    const el = document.getElementById('tab-pipeline');
    if (!el) return;

    el.innerHTML = `
      <!-- Row 1: New Pipeline + Meetings Last Week -->
      <div class="pipeline-row">

        <!-- 2a: New Pipeline Pie -->
        <div class="card pipeline-new-pipeline">
          <div class="card-header">
            <span class="card-icon">🌱</span>
            <div>
              <h3 class="card-title">New Pipeline</h3>
              <p class="card-subtitle">Opportunities ≤ 7 days old · ${m.newPipeline.length} deals</p>
            </div>
          </div>
          ${m.newPipeline.length === 0
            ? '<div class="empty-state">No new opportunities this week</div>'
            : `<div class="chart-wrap" style="height:220px">
                <canvas id="new-pipeline-chart"></canvas>
               </div>
               ${_newPipelineTable(m.newPipeline)}`
          }
        </div>

        <!-- 2c: Meetings last week -->
        <div class="card pipeline-meetings-kpi">
          <div class="card-header">
            <span class="card-icon">📞</span>
            <div>
              <h3 class="card-title">Meetings Last Week</h3>
              <p class="card-subtitle">Interactions within 7 days</p>
            </div>
          </div>
          <div class="big-number accent-purple">${m.metLastWeek.length}</div>
          <div class="big-number-sub">accounts engaged</div>
          ${m.metLastWeek.length > 0
            ? `<ul class="mini-list">
                ${m.metLastWeek.map(d => `
                  <li>
                    <span class="mini-list-name">${d.accountName ? d.accountName + ' · ' : ''}${d.oppName}</span>
                    <span class="mini-list-date">${fmtDateShort(d.lastInteractionDate)}</span>
                  </li>`).join('')}
               </ul>`
            : '<div class="empty-state-sm">No recent meetings recorded in this period</div>'
          }
        </div>

      </div>

      <!-- Row 2: Last Meeting table -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-header">
          <span class="card-icon">📋</span>
          <div>
            <h3 class="card-title">Last Meeting Held &amp; Next Steps</h3>
            <p class="card-subtitle">All accounts for ${ae}</p>
          </div>
        </div>
        ${_meetingTable(m.meetingRows)}
      </div>

      <!-- Row 3: Deals per Stage -->
      <div class="pipeline-row">

        <!-- Chart -->
        <div class="card pipeline-stage-chart">
          <div class="card-header">
            <span class="card-icon">📈</span>
            <div>
              <h3 class="card-title">ARR by Stage</h3>
              <p class="card-subtitle">Total pipeline value</p>
            </div>
          </div>
          <div class="chart-wrap" style="height:${Math.max(180, m.byStage.length * 40)}px">
            <canvas id="stage-bar-chart"></canvas>
          </div>
        </div>

        <!-- Stage detail table -->
        <div class="card pipeline-stage-table">
          <div class="card-header">
            <span class="card-icon">🗂️</span>
            <div>
              <h3 class="card-title">Deals per Stage</h3>
              <p class="card-subtitle">Count, names, and ARR</p>
            </div>
          </div>
          ${_stageTable(m.byStage)}
        </div>

      </div>

      <!-- Row 4: Days in Stage + WoW Change -->
      <div class="pipeline-row">

        <!-- Days in Stage -->
        <div class="card">
          <div class="card-header">
            <span class="card-icon">⏱️</span>
            <div>
              <h3 class="card-title">Days in Stage</h3>
              <p class="card-subtitle">Per opportunity</p>
            </div>
          </div>
          ${_daysInStageTable(m.daysInStage)}
        </div>

        <!-- Week-over-Week -->
        <div class="card">
          <div class="card-header">
            <span class="card-icon">🔄</span>
            <div>
              <h3 class="card-title">Week-over-Week Change</h3>
              <p class="card-subtitle">vs. previous upload</p>
            </div>
          </div>
          ${m.wow ? _wowSection(m.wow) : '<div class="empty-state">Upload a second week to see changes</div>'}
        </div>

      </div>
    `;

    // Render charts after DOM update
    requestAnimationFrame(() => {
      if (m.newPipeline.length > 0 && m.newByStage.length > 0) {
        Charts.renderPie(
          'new-pipeline-chart',
          m.newByStage.map(s => s.stage),
          m.newByStage.map(s => s.totalARR),
        );
      }
      if (m.byStage.length > 0) {
        Charts.renderBarH(
          'stage-bar-chart',
          m.byStage.map(s => s.stage),
          m.byStage.map(s => s.totalARR),
        );
      }
    });
  }

  // ----------------------------------------------------------
  //  Render — All AEs (Team View)
  // ----------------------------------------------------------
  function renderAll(deals, prevDeals) {
    const m  = computeAll(deals, prevDeals);
    const el = document.getElementById('tab-pipeline');
    if (!el) return;

    const totalNewARR = m.newPipeline.reduce((s, d) => s + d.arr, 0);

    el.innerHTML = `
      <!-- Row 1: Team New Pipeline + Team Meetings Last Week -->
      <div class="pipeline-row">

        <!-- 2a: Team New Pipeline -->
        <div class="card pipeline-new-pipeline">
          <div class="card-header">
            <span class="card-icon">🌱</span>
            <div>
              <h3 class="card-title">Team New Pipeline</h3>
              <p class="card-subtitle">Opportunities ≤ 7 days old · ${m.newPipeline.length} deals · ${Charts.formatCurrency(totalNewARR)}</p>
            </div>
          </div>
          ${m.newPipeline.length === 0
            ? '<div class="empty-state">No new opportunities created this week across the team</div>'
            : `<div class="chart-wrap" style="height:220px">
                <canvas id="team-new-pipeline-chart"></canvas>
               </div>
               ${_teamNewPipelineTable(m.newPipeline)}`
          }
        </div>

        <!-- 2c: Team Meetings last week -->
        <div class="card pipeline-meetings-kpi">
          <div class="card-header">
            <span class="card-icon">📞</span>
            <div>
              <h3 class="card-title">Team Meetings Last Week</h3>
              <p class="card-subtitle">Interactions within 7 days across all AEs</p>
            </div>
          </div>
          <div class="big-number accent-purple">${m.metLastWeek.length}</div>
          <div class="big-number-sub">total customer engagements</div>

          ${m.metByAE.length > 0 ? `
            <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.875rem">
              ${m.metByAE.map(a => `
                <span class="badge badge--info ae-pill-badge" onclick="App.switchToAE('${_jsEsc(a.ae)}')" title="Click to view ${a.ae}">
                  ${a.ae}: <strong>${a.count}</strong>
                </span>`).join('')}
            </div>` : ''}

          ${m.metLastWeek.length > 0
            ? `<ul class="mini-list" style="max-height:160px;overflow-y:auto;margin-top:0.875rem">
                ${m.metLastWeek.slice(0, 15).map(d => `
                  <li>
                    <span class="mini-list-name" onclick="App.switchToAE('${_jsEsc(d.aePrimary)}')" style="cursor:pointer" title="Switch to ${d.aePrimary}">
                      <span style="color:var(--accent-blue)">[${d.aePrimary}]</span> ${d.accountName ? d.accountName + ' · ' : ''}${d.oppName}
                    </span>
                    <span class="mini-list-date">${fmtDateShort(d.lastInteractionDate)}</span>
                  </li>`).join('')}
               </ul>`
            : '<div class="empty-state-sm">No meetings recorded within the last 7 days</div>'
          }
        </div>

      </div>

      <!-- Row 2: Team Last Meeting held & next steps table -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-header">
          <span class="card-icon">📋</span>
          <div>
            <h3 class="card-title">Team Account Engagement &amp; Next Steps</h3>
            <p class="card-subtitle">All active pipeline accounts across all AEs · Click AE name to drill down</p>
          </div>
        </div>
        ${_teamMeetingTable(m.meetingRows)}
      </div>

      <!-- Row 3: Team Deals per Stage -->
      <div class="pipeline-row">

        <!-- Chart -->
        <div class="card pipeline-stage-chart">
          <div class="card-header">
            <span class="card-icon">📈</span>
            <div>
              <h3 class="card-title">Team ARR by Stage</h3>
              <p class="card-subtitle">Consolidated pipeline value across stages</p>
            </div>
          </div>
          <div class="chart-wrap" style="height:${Math.max(180, m.byStage.length * 40)}px">
            <canvas id="team-stage-bar-chart"></canvas>
          </div>
        </div>

        <!-- Stage detail table -->
        <div class="card pipeline-stage-table">
          <div class="card-header">
            <span class="card-icon">🗂️</span>
            <div>
              <h3 class="card-title">Team Deals per Stage</h3>
              <p class="card-subtitle">Count, opportunities, and ARR by stage</p>
            </div>
          </div>
          ${_stageTable(m.byStage)}
        </div>

      </div>

      <!-- Row 4: Team Days in Stage + Team WoW Change -->
      <div class="pipeline-row">

        <!-- Days in Stage -->
        <div class="card">
          <div class="card-header">
            <span class="card-icon">⏱️</span>
            <div>
              <h3 class="card-title">Team Pipeline Velocity (Days in Stage)</h3>
              <p class="card-subtitle">Longest-stalled opportunities across all AEs</p>
            </div>
          </div>
          ${_teamDaysInStageTable(m.daysInStage)}
        </div>

        <!-- Week-over-Week -->
        <div class="card">
          <div class="card-header">
            <span class="card-icon">🔄</span>
            <div>
              <h3 class="card-title">Team Week-over-Week Change</h3>
              <p class="card-subtitle">Consolidated change vs. previous upload</p>
            </div>
          </div>
          ${m.wow ? _wowSection(m.wow) : '<div class="empty-state">Upload a second week to see team changes</div>'}
        </div>

      </div>
    `;

    // Render charts after DOM update
    requestAnimationFrame(() => {
      if (m.newPipeline.length > 0 && m.newByStage.length > 0) {
        Charts.renderPie(
          'team-new-pipeline-chart',
          m.newByStage.map(s => s.stage),
          m.newByStage.map(s => s.totalARR),
        );
      }
      if (m.byStage.length > 0) {
        Charts.renderBarH(
          'team-stage-bar-chart',
          m.byStage.map(s => s.stage),
          m.byStage.map(s => s.totalARR),
        );
      }
    });
  }

  // ----------------------------------------------------------
  //  Sub-renderers (Individual AE)
  // ----------------------------------------------------------
  function _newPipelineTable(deals) {
    return `
      <div class="scroll-table-wrap" style="max-height:160px">
        <table class="data-table">
          <thead><tr><th>Opportunity</th><th>Stage</th><th class="num">ARR</th><th class="num">Age</th></tr></thead>
          <tbody>
            ${deals.map(d => `
              <tr>
                <td>${d.accountName ? d.accountName + ' · ' : ''}${d.oppName}</td>
                <td><span class="stage-pill">${d.stage}</span></td>
                <td class="num">${Charts.formatCurrency(d.arr)}</td>
                <td class="num">${d.age}d</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function _meetingTable(rows) {
    if (!rows.length) return '<div class="empty-state">No interaction data found</div>';
    return `
      <div class="scroll-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Account / Opportunity</th>
              <th>Last Interaction</th>
              <th>Days Ago</th>
              <th>Next Step Date</th>
              <th>Next Step</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr class="${r.daysAgo <= 7 ? 'row-highlight' : ''}">
                <td class="opp-name">${r.accountName ? `<span style="color:var(--txt-muted);font-size:0.75rem">${r.accountName} · </span>` : ''}${r.oppName}</td>
                <td>
                  <div>${r.lastDate ? fmtDate(r.lastDate) : (r.interactionRaw ? `<span style="font-size:0.78rem;color:var(--txt-sec)">${_esc(r.interactionRaw)}</span>` : '—')}</div>
                  ${r.lastDate && r.interactionRaw && !r.interactionRaw.includes(fmtDateShort(r.lastDate)) ? `<div class="opp-sub-list">${_esc(r.interactionRaw)}</div>` : ''}
                </td>
                <td>
                  <span class="days-badge ${r.daysAgo <= 7 ? 'days-badge--fresh' : r.daysAgo <= 14 ? 'days-badge--recent' : 'days-badge--stale'}">
                    ${r.daysAgo === Infinity ? '—' : r.daysAgo + 'd'}
                  </span>
                </td>
                <td>${fmtDate(r.nextDate)}</td>
                <td class="next-step-text">${r.nextDesc || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function _stageTable(byStage) {
    if (!byStage.length) return '<div class="empty-state">No stage data</div>';
    return `
      <div class="scroll-table-wrap" style="max-height:400px">
        <table class="data-table">
          <thead><tr><th>Stage</th><th class="num">#</th><th class="num">ARR</th></tr></thead>
          <tbody>
            ${byStage.map((s, i) => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span class="color-dot" style="background:${CONFIG.CHART_COLORS[i % CONFIG.CHART_COLORS.length]}"></span>
                    <span>${s.stage}</span>
                  </div>
                  <div class="opp-sub-list">${s.deals.map(d => d.oppName).join(' · ')}</div>
                </td>
                <td class="num">${s.deals.length}</td>
                <td class="num">${Charts.formatCurrency(s.totalARR)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function _daysInStageTable(rows) {
    if (!rows.length) return '<div class="empty-state">No stage duration data</div>';
    return `
      <div class="scroll-table-wrap" style="max-height:360px">
        <table class="data-table">
          <thead><tr><th>Opportunity</th><th>Stage</th><th class="num">Days</th><th class="num">ARR</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="opp-name">${r.oppName}</td>
                <td><span class="stage-pill">${r.stage}</span></td>
                <td class="num">
                  <span class="days-badge ${r.duration > 30 ? 'days-badge--stale' : r.duration > 14 ? 'days-badge--recent' : 'days-badge--fresh'}">
                    ${r.duration}d
                  </span>
                </td>
                <td class="num">${Charts.formatCurrency(r.arr)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // ----------------------------------------------------------
  //  Sub-renderers (Team View)
  // ----------------------------------------------------------
  function _teamNewPipelineTable(deals) {
    return `
      <div class="scroll-table-wrap" style="max-height:160px">
        <table class="data-table">
          <thead>
            <tr>
              <th>Opportunity</th>
              <th>AE Primary</th>
              <th>Stage</th>
              <th class="num">ARR</th>
              <th class="num">Age</th>
            </tr>
          </thead>
          <tbody>
            ${deals.map(d => `
              <tr>
                <td class="opp-name">${d.accountName ? d.accountName + ' · ' : ''}${d.oppName}</td>
                <td>
                  <span class="badge badge--info" onclick="App.switchToAE('${_jsEsc(d.aePrimary)}')" style="cursor:pointer" title="Switch to ${d.aePrimary}">
                    ${d.aePrimary}
                  </span>
                </td>
                <td><span class="stage-pill">${d.stage}</span></td>
                <td class="num">${Charts.formatCurrency(d.arr)}</td>
                <td class="num">${d.age}d</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function _teamMeetingTable(rows) {
    if (!rows.length) return '<div class="empty-state">No interaction data found</div>';
    return `
      <div class="scroll-table-wrap" style="max-height:460px">
        <table class="data-table">
          <thead>
            <tr>
              <th>AE Primary</th>
              <th>Account / Opportunity</th>
              <th>Last Interaction</th>
              <th>Days Ago</th>
              <th>Next Step Date</th>
              <th>Next Step</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr class="${r.daysAgo <= 7 ? 'row-highlight' : ''}">
                <td>
                  <span class="badge badge--info" onclick="App.switchToAE('${_jsEsc(r.ae)}')" style="cursor:pointer" title="View ${r.ae}'s dashboard">
                    ${r.ae}
                  </span>
                </td>
                <td class="opp-name">
                  ${r.accountName ? `<div style="font-size:0.75rem;color:var(--txt-muted)">${r.accountName}</div>` : ''}
                  <div>${r.oppName}</div>
                </td>
                <td>
                  <div>${r.lastDate ? fmtDate(r.lastDate) : (r.interactionRaw ? `<span style="font-size:0.78rem;color:var(--txt-sec)">${_esc(r.interactionRaw)}</span>` : '—')}</div>
                  ${r.lastDate && r.interactionRaw && !r.interactionRaw.includes(fmtDateShort(r.lastDate)) ? `<div class="opp-sub-list">${_esc(r.interactionRaw)}</div>` : ''}
                </td>
                <td>
                  <span class="days-badge ${r.daysAgo <= 7 ? 'days-badge--fresh' : r.daysAgo <= 14 ? 'days-badge--recent' : 'days-badge--stale'}">
                    ${r.daysAgo === Infinity ? '—' : r.daysAgo + 'd'}
                  </span>
                </td>
                <td>${fmtDate(r.nextDate)}</td>
                <td class="next-step-text">${r.nextDesc || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function _teamDaysInStageTable(rows) {
    if (!rows.length) return '<div class="empty-state">No stage duration data</div>';
    return `
      <div class="scroll-table-wrap" style="max-height:360px">
        <table class="data-table">
          <thead>
            <tr>
              <th>Opportunity</th>
              <th>AE Primary</th>
              <th>Stage</th>
              <th class="num">Days</th>
              <th class="num">ARR</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="opp-name">${r.oppName}</td>
                <td>
                  <span class="badge badge--info" onclick="App.switchToAE('${_jsEsc(r.ae)}')" style="cursor:pointer" title="Switch to ${r.ae}">
                    ${r.ae}
                  </span>
                </td>
                <td><span class="stage-pill">${r.stage}</span></td>
                <td class="num">
                  <span class="days-badge ${r.duration > 30 ? 'days-badge--stale' : r.duration > 14 ? 'days-badge--recent' : 'days-badge--fresh'}">
                    ${r.duration}d
                  </span>
                </td>
                <td class="num">${Charts.formatCurrency(r.arr)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function _wowSection(wow) {
    const sign = (n) => n > 0 ? '+' : '';
    const cls  = (n) => n > 0 ? 'delta--up' : n < 0 ? 'delta--down' : 'delta--flat';

    return `
      <div class="wow-grid">
        <div class="wow-card">
          <span class="wow-label">Pipeline ARR</span>
          <span class="wow-delta ${cls(wow.deltaARR)}">${sign(wow.deltaARR)}${Charts.formatCurrency(Math.abs(wow.deltaARR))}</span>
        </div>
        <div class="wow-card">
          <span class="wow-label">Closed Won ARR</span>
          <span class="wow-delta ${cls(wow.deltaWon)}">${sign(wow.deltaWon)}${Charts.formatCurrency(Math.abs(wow.deltaWon))}</span>
        </div>
        <div class="wow-card">
          <span class="wow-label">Deal Count</span>
          <span class="wow-delta ${cls(wow.deltaCount)}">${sign(wow.deltaCount)}${Math.abs(wow.deltaCount)} deals</span>
        </div>
      </div>
      ${wow.newDeals.length > 0 ? `
        <div class="wow-section">
          <div class="wow-section-title">🆕 New Deals Added (${wow.newDeals.length})</div>
          <ul class="mini-list" style="max-height:140px;overflow-y:auto">
            ${wow.newDeals.map(d => `
              <li>
                <span class="mini-list-name">${d.aePrimary ? `<span style="color:var(--accent-blue)">[${d.aePrimary}]</span> ` : ''}${d.oppName}</span>
                <span class="mini-list-date">${Charts.formatCurrency(d.arr)}</span>
              </li>`).join('')}
          </ul>
        </div>` : ''}
      ${wow.lostDeals.length > 0 ? `
        <div class="wow-section">
          <div class="wow-section-title" style="color:#ef4444">⬇ Deals Removed (${wow.lostDeals.length})</div>
          <ul class="mini-list" style="max-height:140px;overflow-y:auto">
            ${wow.lostDeals.map(d => `
              <li>
                <span class="mini-list-name">${d.aePrimary ? `<span style="color:var(--accent-blue)">[${d.aePrimary}]</span> ` : ''}${d.oppName}</span>
                <span class="mini-list-date" style="color:#ef4444">${Charts.formatCurrency(d.arr)}</span>
              </li>`).join('')}
          </ul>
        </div>` : ''}
    `;
  }

  return { render, renderAll, compute, computeAll };
})();
