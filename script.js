(() => {
  const form = document.getElementById('entry-form');
  const categoryInput = document.getElementById('category');
  const colorInput = document.getElementById('color');
  const dateInput = document.getElementById('date');
  const hoursInput = document.getElementById('hours');
  const chartTypeSelect = document.getElementById('chart-type');
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const showChartBtn = document.getElementById('show-chart');
  const ctx = document.getElementById('chart').getContext('2d');
  const heatmapTable = document.getElementById('heatmap');

  let chart;
  let entries = JSON.parse(localStorage.getItem('entries') || '[]');
  let categoryColors = JSON.parse(localStorage.getItem('categoryColors') || '{}');

  function saveColors() {
    localStorage.setItem('categoryColors', JSON.stringify(categoryColors));
  }

  function saveEntries() {
    localStorage.setItem('entries', JSON.stringify(entries));
  }

  function renderHeatmap() {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push(d);
    }
    const keys = days.map(d => d.toISOString().slice(0, 10));
    const totals = {};
    entries.forEach(e => {
      if (keys.includes(e.date)) {
        totals[e.category] = totals[e.category] || {};
        totals[e.category][e.date] = (totals[e.category][e.date] || 0) + e.hours;
      }
    });

    const weeklyTotals = {};
    Object.keys(totals).forEach(cat => {
      weeklyTotals[cat] = keys.reduce((sum, k) => sum + (totals[cat][k] || 0), 0);
    });
    const sorted = Object.keys(weeklyTotals).sort((a, b) => weeklyTotals[b] - weeklyTotals[a]);

    let html = '<tr><th>Category</th>' +
      keys.map(k => '<th>' + new Date(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '</th>').join('') +
      '</tr>';
    sorted.forEach(cat => {
      html += '<tr><td>' + cat + '</td>';
      keys.forEach(k => {
        const val = totals[cat] && totals[cat][k] ? totals[cat][k].toFixed(1) : '0';
        html += '<td>' + val + '</td>';
      });
      html += '</tr>';
    });
    heatmapTable.innerHTML = html;
  }

  // initial render
  renderHeatmap();

  form.addEventListener('submit', e => {
    e.preventDefault();
    const entry = {
      category: categoryInput.value.trim(),
      date: dateInput.value,
      hours: parseFloat(hoursInput.value)
    };
    if (entry.category && entry.date && !isNaN(entry.hours)) {
      if (!categoryColors[entry.category]) {
        categoryColors[entry.category] = colorInput.value || '#888888';
        saveColors();
      }
      entries.push(entry);
      saveEntries();
      form.reset();
      renderHeatmap();
    }
  });

  function getFilteredEntries() {
    const start = startDateInput.value ? new Date(startDateInput.value) : null;
    const end = endDateInput.value ? new Date(endDateInput.value) : null;
    return entries.filter(e => {
      const d = new Date(e.date);
      return (!start || d >= start) && (!end || d <= end);
    });
  }

  function renderChart() {
    const filtered = getFilteredEntries();
    const totals = {};
    filtered.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.hours;
    });
    const labels = Object.keys(totals);
    const data = labels.map(l => totals[l]);
    const type = chartTypeSelect.value;

    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type,
      data: {
        labels,
        datasets: [{
          label: 'Hours',
          data,
          backgroundColor: labels.map(l => categoryColors[l] || 'rgba(75, 192, 192, 0.2)'),
          borderColor: labels.map(l => categoryColors[l] || 'rgba(75, 192, 192, 1)'),
          borderWidth: 1,
          fill: type === 'line' ? false : true,
        }]
      },
      options: {
        scales: type === 'line' || type === 'bar' ? {
          y: { beginAtZero: true }
        } : {}
      }
    });
  }

  showChartBtn.addEventListener('click', renderChart);

  window.addEventListener('storage', () => {
    entries = JSON.parse(localStorage.getItem('entries') || '[]');
    categoryColors = JSON.parse(localStorage.getItem('categoryColors') || '{}');
    renderHeatmap();
  });
})();
