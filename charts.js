// ============================================================
//  Sales Dashboard — Chart.js Helpers
// ============================================================

const Charts = (() => {

  // Keep references so we can destroy before re-creating
  const _instances = {};

  function _destroy(id) {
    if (_instances[id]) {
      _instances[id].destroy();
      delete _instances[id];
    }
  }

  // ----------------------------------------------------------
  //  Doughnut gauge — Quota Attainment
  //  Renders a half-doughnut with a % label in the centre.
  // ----------------------------------------------------------
  function renderGauge(canvasId, pct, label) {
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const clamped = Math.min(pct, 150); // cap visual at 150%
    const remaining = Math.max(0, 100 - clamped);
    const overshoot = clamped > 100 ? clamped - 100 : 0;

    const colors = pct >= 100 ? ['#10b981', '#1e2a42'] :
                   pct >= 70  ? ['#f59e0b', '#1e2a42'] :
                                ['#3b82f6', '#1e2a42'];

    _instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [Math.min(clamped, 100), remaining, overshoot > 0 ? overshoot : 0],
          backgroundColor: [colors[0], colors[1], '#10b981'],
          borderWidth: 0,
          circumference: 180,
          rotation: -90,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        animation: { animateRotate: true, duration: 800 },
      },
      plugins: [{
        id: 'gauge-label',
        afterDraw(chart) {
          const { ctx: c, width, height } = chart;
          const cx = width / 2;
          const cy = height * 0.78;
          c.save();
          c.textAlign = 'center';
          c.fillStyle = '#f1f5f9';
          c.font      = `bold ${Math.round(width * 0.12)}px Inter, sans-serif`;
          c.fillText(`${Math.round(pct)}%`, cx, cy);
          c.fillStyle = '#64748b';
          c.font      = `${Math.round(width * 0.065)}px Inter, sans-serif`;
          c.fillText(label || 'Attainment', cx, cy + Math.round(width * 0.09));
          c.restore();
        },
      }],
    });
  }

  // ----------------------------------------------------------
  //  Pie / Doughnut — New Pipeline by stage
  // ----------------------------------------------------------
  function renderPie(canvasId, labels, values, title) {
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const colors = labels.map((_, i) => CONFIG.CHART_COLORS[i % CONFIG.CHART_COLORS.length]);

    _instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#0f1623',
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter, sans-serif', size: 11 },
              boxWidth: 12,
              padding: 10,
            },
          },
          title: {
            display: !!title,
            text: title || '',
            color: '#f1f5f9',
            font: { family: 'Inter, sans-serif', size: 13, weight: '600' },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                return ` ${ctx.label}: ${formatCurrency(val)}`;
              },
            },
          },
        },
      },
    });
  }

  // ----------------------------------------------------------
  //  Horizontal Bar — ARR per Stage
  // ----------------------------------------------------------
  function renderBarH(canvasId, labels, values, title) {
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const colors = labels.map((_, i) => CONFIG.CHART_COLORS[i % CONFIG.CHART_COLORS.length]);

    _instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'ARR ($)',
          data: values,
          backgroundColor: colors.map(c => c + 'bb'),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: !!title,
            text: title || '',
            color: '#f1f5f9',
            font: { family: 'Inter, sans-serif', size: 13, weight: '600' },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${formatCurrency(ctx.parsed.x)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: '#1e2a42' },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter, sans-serif', size: 11 },
              callback: (v) => '$' + compactNum(v),
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Inter, sans-serif', size: 11 },
            },
          },
        },
      },
    });
  }

  // ----------------------------------------------------------
  //  Mini Sparkline — week-over-week trend (placeholder data)
  // ----------------------------------------------------------
  function renderSparkline(canvasId, values, color) {
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    _instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: values.map((_, i) => i),
        datasets: [{
          data: values,
          borderColor: color || '#3b82f6',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          backgroundColor: (color || '#3b82f6') + '22',
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        animation: { duration: 500 },
      },
    });
  }

  // ----------------------------------------------------------
  //  Utility formatters
  // ----------------------------------------------------------
  function formatCurrency(n) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toLocaleString()}`;
  }

  function compactNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
    return String(n);
  }

  function destroyAll() {
    Object.keys(_instances).forEach(_destroy);
  }

  return {
    renderGauge,
    renderPie,
    renderBarH,
    renderSparkline,
    formatCurrency,
    compactNum,
    destroyAll,
  };
})();
