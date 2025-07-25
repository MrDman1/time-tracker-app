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
  const rangeSelect = document.getElementById('time-range');
  const exportBtn = document.getElementById('export-excel');

  let chart;
  let entries = JSON.parse(localStorage.getItem('entries') || '[]');
  let categoryColors = JSON.parse(localStorage.getItem('categoryColors') || '{}');

  function saveColors() {
    localStorage.setItem('categoryColors', JSON.stringify(categoryColors));
  }

  function saveEntries() {
    localStorage.setItem('entries', JSON.stringify(entries));
  }

  function renderWeekHeatmap() {
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
        html += '<td data-cat="' + cat + '" data-date="' + k + '">' + val + '</td>';
      });
      html += '</tr>';
    });
    heatmapTable.innerHTML = html;
    heatmapTable.querySelectorAll('td[data-cat]').forEach(td => {
      td.addEventListener('click', () => {
        const cat = td.dataset.cat;
        const date = td.dataset.date;
        const current = parseFloat(td.textContent) || 0;
        const val = prompt('Hours', current);
        if (val === null) return;
        const hours = parseFloat(val);
        if (!isNaN(hours)) {
          entries = entries.filter(e => !(e.category === cat && e.date === date));
          if (hours > 0) entries.push({ category: cat, date, hours });
          saveEntries();
          td.classList.add('edited');
          setTimeout(() => td.classList.remove('edited'), 800);
          renderView();
        }
      });
    });
  }

  function renderMonthChart() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const labels = [];
    const data = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(start);
      d.setDate(i);
      const key = d.toISOString().slice(0, 10);
      labels.push(i.toString());
      data.push(entries.filter(e => e.date === key).reduce((s, e) => s + e.hours, 0));
    }
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Hours', data, backgroundColor: '#69c' }] },
      options: { scales: { y: { beginAtZero: true } } }
    });
    heatmapTable.innerHTML = '';
  }

  function renderYearChart() {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), i, 1));
    const labels = months.map(m => m.toLocaleDateString(undefined, { month: 'short' }));
    const cats = [...new Set(entries.map(e => e.category))];
    const datasets = cats.map(cat => {
      const data = months.map(m => {
        const monthStr = m.toISOString().slice(0, 7);
        return entries
          .filter(e => e.category === cat && e.date.startsWith(monthStr))
          .reduce((s, e) => s + e.hours, 0);
      });
      return {
        label: cat,
        data,
        borderColor: categoryColors[cat] || '#000',
        backgroundColor: categoryColors[cat] || 'rgba(0,0,0,0.1)',
        fill: false
      };
    });
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: { scales: { y: { beginAtZero: true } } }
    });
    heatmapTable.innerHTML = '';
  }

  function exportToExcel() {
    const wb = XLSX.utils.book_new();

    const entrySheet = XLSX.utils.json_to_sheet(entries.map(e => ({
      Category: e.category,
      Hours: e.hours,
      Date: e.date,
      Color: categoryColors[e.category] || ''
    })));
    XLSX.utils.book_append_sheet(wb, entrySheet, 'Entries');

    // weekly summary
    const now = new Date();
    const weekKeys = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      weekKeys.push(d.toISOString().slice(0, 10));
    }
    const weekHeader = ['Category'].concat(weekKeys.map(k => new Date(k).toLocaleDateString()));
    const cats = [...new Set(entries.map(e => e.category))];
    const weekData = [weekHeader];
    cats.forEach(cat => {
      const row = [cat];
      weekKeys.forEach(k => {
        const total = entries.filter(e => e.category === cat && e.date === k).reduce((s, e) => s + e.hours, 0);
        row.push(total);
      });
      weekData.push(row);
    });
    const weekSheet = XLSX.utils.aoa_to_sheet(weekData);
    XLSX.utils.book_append_sheet(wb, weekSheet, 'Weekly Summary');

    // monthly summary
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthKeys = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(start);
      d.setDate(i + 1);
      return d.toISOString().slice(0, 10);
    });
    const monthHeader = ['Category'].concat(monthKeys.map(k => k.slice(8)));
    const monthData = [monthHeader];
    cats.forEach(cat => {
      const row = [cat];
      monthKeys.forEach(k => {
        const total = entries.filter(e => e.category === cat && e.date === k).reduce((s, e) => s + e.hours, 0);
        row.push(total);
      });
      monthData.push(row);
    });
    const monthSheet = XLSX.utils.aoa_to_sheet(monthData);
    XLSX.utils.book_append_sheet(wb, monthSheet, 'Monthly Summary');

    // yearly summary
    const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), i, 1));
    const yearHeader = ['Category'].concat(months.map(m => m.toLocaleDateString(undefined, { month: 'short' })));
    const yearData = [yearHeader];
    cats.forEach(cat => {
      const row = [cat];
      months.forEach(m => {
        const prefix = m.toISOString().slice(0, 7);
        const total = entries.filter(e => e.category === cat && e.date.startsWith(prefix)).reduce((s, e) => s + e.hours, 0);
        row.push(total);
      });
      yearData.push(row);
    });
    const yearSheet = XLSX.utils.aoa_to_sheet(yearData);
    XLSX.utils.book_append_sheet(wb, yearSheet, 'Yearly Summary');

    XLSX.writeFile(wb, 'time-tracking-export.xlsx');
  }

  function renderView() {
    if (rangeSelect.value === 'month') {
      renderMonthChart();
    } else if (rangeSelect.value === 'year') {
      renderYearChart();
    } else {
      renderWeekHeatmap();
    }
  }

  // initial render
  renderView();

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
      renderView();
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
  rangeSelect.addEventListener('change', renderView);
  exportBtn.addEventListener('click', exportToExcel);

  window.addEventListener('storage', () => {
    entries = JSON.parse(localStorage.getItem('entries') || '[]');
    categoryColors = JSON.parse(localStorage.getItem('categoryColors') || '{}');
    renderView();
  });
})();
