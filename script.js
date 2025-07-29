(() => {
  const form = document.getElementById('entry-form');
  const categoryInput = document.getElementById('category');
  const colorInput = document.getElementById('color');
  const dateInput = document.getElementById('date');
  const hoursInput = document.getElementById('hours');
  const chartTypeSelect = document.getElementById('chart-type');
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const dayFilterInputs = document.querySelectorAll('#day-filter input[type="checkbox"]');
  const showChartBtn = document.getElementById('show-chart');
  const ctx = document.getElementById('chart').getContext('2d');
  const heatmapTable = document.getElementById('heatmap');
  const rangeSelect = document.getElementById('time-range');
  const exportBtn = document.getElementById('export-excel');
  const overviewCtx = document.getElementById('overview-chart').getContext('2d');
  const calendarEl = document.getElementById('calendar');
  const tooltipEl = document.getElementById('tooltip');
  const prevWeekBtn = document.getElementById('prev-week');
  const nextWeekBtn = document.getElementById('next-week');
  const weekLabel = document.getElementById('week-label');
  const weekControls = document.getElementById('week-controls');

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const signupBtn = document.getElementById("signup-btn");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userInfo = document.getElementById("user-info");
  const auth = firebase.auth();
  const db = firebase.firestore();
  let chart;
  let overviewChart;
  let currentWeekStart = getWeekStart(new Date());
  let entries = JSON.parse(localStorage.getItem('entries') || '[]');
  let categoryColors = JSON.parse(localStorage.getItem('categoryColors') || '{}');
  let categoryList = JSON.parse(localStorage.getItem('categoryList') || '[]');
  let goals = JSON.parse(localStorage.getItem('goals') || '{"daily":{},"weekly":{}}');

  // ensure category list includes all categories found in saved entries
  const allCategories = [...new Set(entries.map(e => e.category))];
  const merged = new Set(categoryList.concat(allCategories));
  categoryList = Array.from(merged);

  function saveColors() {
    localStorage.setItem('categoryColors', JSON.stringify(categoryColors));
    saveToFirestore();
  }

  function saveEntries() {
    localStorage.setItem('entries', JSON.stringify(entries));
    saveToFirestore();
  }

  function saveCategoryList() {
    localStorage.setItem('categoryList', JSON.stringify(categoryList));
    saveToFirestore();
  }

  function saveGoals() {
    localStorage.setItem('goals', JSON.stringify(goals));
    saveToFirestore();
  }
  function saveToFirestore() {
    if (!auth.currentUser) return;
    db.collection("users").doc(auth.currentUser.uid).set({
      entries,
      categoryColors,
      categoryList,
      goals
    });
  }


  function parseLocalDate(str) {
    return new Date(str + 'T00:00');
  }

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - ((day + 6) % 7);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function renderWeekChart() {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      return d;
    });
    const dayKeys = days.map(d => d.toISOString().slice(0, 10));
    const categories = categoryList.slice();
    const datasets = days.map((d, idx) => {
      const data = categories.map(cat => {
        return entries.filter(e => e.category === cat && e.date === d.toISOString().slice(0, 10)).reduce((s, e) => s + e.hours, 0);
      });
      return {
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        data,
        backgroundColor: `hsl(${idx * 40},70%,60%)`
      };
    });
    if (overviewChart) overviewChart.destroy();
    overviewChart = new Chart(overviewCtx, {
      type: 'bar',
      data: { labels: categories, datasets },
      options: {
        indexAxis: 'y',
        scales: { x: { beginAtZero: true } },
        responsive: true,
      }
    });
    weekLabel.textContent = `${days[0].toLocaleDateString()} - ${days[6].toLocaleDateString()}`;
    calendarEl.innerHTML = '';
  }

  function renderMonthCalendar() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    calendarEl.innerHTML = '';

    const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dows.forEach(dow => {
      const h = document.createElement('div');
      h.className = 'day-header';
      h.textContent = dow;
      calendarEl.appendChild(h);
    });

    const startOffset = (start.getDay() + 6) % 7;
    for (let i = 0; i < startOffset; i++) {
      const empty = document.createElement('div');
      empty.className = 'day empty';
      calendarEl.appendChild(empty);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(start);
      d.setDate(i);
      const key = d.toISOString().slice(0, 10);
      const cell = document.createElement('div');
      cell.className = 'day';
      const dowSpan = document.createElement('span');
      dowSpan.className = 'dow';
      dowSpan.textContent = d.toLocaleDateString(undefined, { weekday: 'short' });
      cell.appendChild(dowSpan);
      const dateSpan = document.createElement('span');
      dateSpan.className = 'date';
      dateSpan.textContent = i;
      cell.appendChild(dateSpan);
      const segContainer = document.createElement('div');
      segContainer.className = 'segments';
      const totals = {};
      entries.filter(e => e.date === key).forEach(e => {
        totals[e.category] = (totals[e.category] || 0) + e.hours;
      });
      const totalHours = Object.values(totals).reduce((a, b) => a + b, 0);
      const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
      sorted.slice(0, 2).forEach(([cat, hrs]) => {
        const seg = document.createElement('div');
        seg.style.background = categoryColors[cat] || '#ccc';
        seg.style.width = totalHours ? `${(hrs / totalHours) * 100}%` : '0%';
        segContainer.appendChild(seg);
      });
      cell.appendChild(segContainer);
      cell.addEventListener('mouseenter', e => {
        if (!totalHours) return;
        tooltipEl.style.display = 'block';
        const lines = sorted.map(([cat, hrs]) => {
          const pct = ((hrs / totalHours) * 100).toFixed(1);
          return `${cat}: ${pct}%`;
        });
        tooltipEl.innerHTML = lines.join('<br>');
      });
      cell.addEventListener('mousemove', e => {
        tooltipEl.style.left = e.pageX + 10 + 'px';
        tooltipEl.style.top = e.pageY + 10 + 'px';
      });
      cell.addEventListener('mouseleave', () => {
        tooltipEl.style.display = 'none';
      });
      calendarEl.appendChild(cell);
    }

    const endBlanks = (7 - ((startOffset + daysInMonth) % 7)) % 7;
    for (let i = 0; i < endBlanks; i++) {
      const empty = document.createElement('div');
      empty.className = 'day empty';
      calendarEl.appendChild(empty);
    }
    if (overviewChart) {
      overviewChart.destroy();
      overviewChart = null;
    }
    weekLabel.textContent = '';
  }

  function renderWeekHeatmap() {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      return d;
    });
    const keys = days.map(d => d.toISOString().slice(0, 10));
    const totals = {};
    categoryList.forEach(cat => {
      totals[cat] = {};
    });
    entries.forEach(e => {
      if (keys.includes(e.date)) {
        totals[e.category] = totals[e.category] || {};
        totals[e.category][e.date] = (totals[e.category][e.date] || 0) + e.hours;
      }
    });

    const weeklyTotals = {};
    categoryList.forEach(cat => {
      weeklyTotals[cat] = keys.reduce((sum, k) => sum + (totals[cat][k] || 0), 0);
    });
    const sorted = categoryList.slice().sort((a, b) => weeklyTotals[b] - weeklyTotals[a]);

    let html = '<tr><th>Category</th>' +
      keys.map(k => '<th>' + parseLocalDate(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '</th>').join('') +
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
    weekLabel.textContent = `${days[0].toLocaleDateString()} - ${days[6].toLocaleDateString()}`;
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
          renderCategoryOverview();
          renderGoalPanel();
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

  async function exportToExcel() {
    const workbook = new ExcelJS.Workbook();
    const now = new Date();

    function applyStyles(sheet) {
      sheet.eachRow((row, rowNumber) => {
        row.eachCell(cell => {
          cell.font = { name: 'Calibri', size: 12, bold: rowNumber === 1 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: rowNumber === 1 ? 'center' : 'left',
            indent: rowNumber === 1 ? 0 : 1
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          if (rowNumber === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF0F0F0' }
            };
          }
        });
      });
      sheet.columns.forEach(col => {
        let max = 10;
        col.eachCell({ includeEmpty: true }, c => {
          const len = c.value ? c.value.toString().length : 0;
          if (len > max) max = len;
        });
        col.width = max + 2;
      });
    }

    function addImage(sheet, dataUrl) {
      if (!dataUrl) return 0;
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const id = workbook.addImage({ base64, extension: 'png' });
      sheet.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 600, height: 300 } });
      return 17; // leave space for image
    }

    function createWeeklyChartImage() {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 300;
      const cctx = canvas.getContext('2d');
      const keys = [];
      const labels = [];
      const data = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        keys.push(key);
        labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        data.push(entries.filter(e => e.date === key).reduce((s, e) => s + e.hours, 0));
      }
      new Chart(cctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Hours', data, backgroundColor: '#69c' }] },
        options: { responsive: false, animation: false, scales: { y: { beginAtZero: true } } }
      });
      return canvas.toDataURL('image/png');
    }

    function createMonthlyChartImage() {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 300;
      const cctx = canvas.getContext('2d');
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
      new Chart(cctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Hours', data, backgroundColor: '#69c' }] },
        options: { responsive: false, animation: false, scales: { y: { beginAtZero: true } } }
      });
      return canvas.toDataURL('image/png');
    }

    function createYearlyChartImage() {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 300;
      const cctx = canvas.getContext('2d');
      const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), i, 1));
      const labels = months.map(m => m.toLocaleDateString(undefined, { month: 'short' }));
      const cats = [...new Set(entries.map(e => e.category))];
      const datasets = cats.map(cat => {
        const data = months.map(m => {
          const monthStr = m.toISOString().slice(0, 7);
          return entries.filter(e => e.category === cat && e.date.startsWith(monthStr)).reduce((s, e) => s + e.hours, 0);
        });
        return { label: cat, data, borderColor: categoryColors[cat] || '#000', backgroundColor: categoryColors[cat] || 'rgba(0,0,0,0.1)', fill: false };
      });
      new Chart(cctx, {
        type: 'line',
        data: { labels, datasets },
        options: { responsive: false, animation: false, scales: { y: { beginAtZero: true } } }
      });
      return canvas.toDataURL('image/png');
    }

    const entrySheet = workbook.addWorksheet('Entries');
    entrySheet.addRow(['Category', 'Hours', 'Date', 'Color']);
    entries.forEach(e => entrySheet.addRow([e.category, e.hours, e.date, categoryColors[e.category] || '']));
    applyStyles(entrySheet);

    const weekKeys = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      weekKeys.push(d.toISOString().slice(0, 10));
    }
    const weekHeader = ['Category'].concat(weekKeys.map(k => parseLocalDate(k).toLocaleDateString()));
    const cats = [...new Set(entries.map(e => e.category))];
    const weekSheet = workbook.addWorksheet('Weekly Summary');
    let startRow = addImage(weekSheet, createWeeklyChartImage());
    for (let i = 1; i < startRow; i++) weekSheet.addRow([]);
    weekSheet.addRow(weekHeader);
    cats.forEach(cat => {
      const row = [cat];
      weekKeys.forEach(k => {
        const total = entries.filter(e => e.category === cat && e.date === k).reduce((s, e) => s + e.hours, 0);
        row.push(total);
      });
      weekSheet.addRow(row);
    });
    applyStyles(weekSheet);

    const monthSheet = workbook.addWorksheet('Monthly Summary');
    startRow = addImage(monthSheet, createMonthlyChartImage());
    for (let i = 1; i < startRow; i++) monthSheet.addRow([]);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthKeys = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(startMonth);
      d.setDate(i + 1);
      return d.toISOString().slice(0, 10);
    });
    const monthHeader = ['Category'].concat(monthKeys.map(k => k.slice(8)));
    monthSheet.addRow(monthHeader);
    cats.forEach(cat => {
      const row = [cat];
      monthKeys.forEach(k => {
        const total = entries.filter(e => e.category === cat && e.date === k).reduce((s, e) => s + e.hours, 0);
        row.push(total);
      });
      monthSheet.addRow(row);
    });
    applyStyles(monthSheet);

    const yearSheet = workbook.addWorksheet('Yearly Summary');
    startRow = addImage(yearSheet, createYearlyChartImage());
    for (let i = 1; i < startRow; i++) yearSheet.addRow([]);
    const monthsArr = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), i, 1));
    const yearHeader = ['Category'].concat(monthsArr.map(m => m.toLocaleDateString(undefined, { month: 'short' })));
    yearSheet.addRow(yearHeader);
    cats.forEach(cat => {
      const row = [cat];
      monthsArr.forEach(m => {
        const prefix = m.toISOString().slice(0, 7);
        const total = entries.filter(e => e.category === cat && e.date.startsWith(prefix)).reduce((s, e) => s + e.hours, 0);
        row.push(total);
      });
      yearSheet.addRow(row);
    });
    applyStyles(yearSheet);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'time-tracking-export.xlsx';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }

  function renderCategoryOverview() {
    if (rangeSelect.value === 'month') {
      renderMonthCalendar();
      heatmapTable.innerHTML = '';
      heatmapTable.style.display = 'none';
      calendarEl.style.display = 'grid';
      weekControls.style.display = 'none';
    } else {
      renderWeekHeatmap();
      calendarEl.innerHTML = '';
      calendarEl.style.display = 'none';
      heatmapTable.style.display = 'table';
      weekControls.style.display = 'flex';
      if (overviewChart) {
        overviewChart.destroy();
        overviewChart = null;
      }
    }
    renderChart();
    renderGoalPanel();
    console.log('Category overview rendered');
  }

  const goalListEl = document.getElementById('goal-list');
  const goalToggleButtons = document.querySelectorAll('#goal-toggle button');
  let goalMode = 'daily';

  goalToggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      goalToggleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      goalMode = btn.dataset.mode;
      renderGoalPanel();
    });
  });

  function getActualForCategory(cat, mode) {
    if (mode === 'daily') {
      const today = new Date().toISOString().slice(0, 10);
      return entries.filter(e => e.category === cat && e.date === today).reduce((s, e) => s + e.hours, 0);
    }
    const start = getWeekStart(new Date());
    const keys = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    return entries.filter(e => e.category === cat && keys.includes(e.date)).reduce((s, e) => s + e.hours, 0);
  }

  function renderGoalPanel() {
    goalListEl.innerHTML = '';
    categoryList.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'goal-item';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'goal-cat';
      nameSpan.textContent = cat;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.1';
      input.placeholder = 'Set Goal';
      input.value = goals[goalMode][cat] !== undefined ? goals[goalMode][cat] : '';
      input.addEventListener('change', () => {
        const val = parseFloat(input.value);
        if (isNaN(val)) {
          delete goals[goalMode][cat];
        } else {
          goals[goalMode][cat] = val;
        }
        saveGoals();
        renderGoalPanel();
      });

      const progress = document.createElement('div');
      progress.className = 'progress';
      const bar = document.createElement('span');
      const goalVal = goals[goalMode][cat];
      const actual = getActualForCategory(cat, goalMode);
      if (goalVal) {
        const pct = Math.min(100, (actual / goalVal) * 100);
        bar.style.width = pct + '%';
        if (actual >= goalVal) progress.classList.add('met');
        else if (actual >= goalVal * 0.8) progress.classList.add('close');
        else progress.classList.add('missed');
      }
      progress.appendChild(bar);

      item.appendChild(nameSpan);
      item.appendChild(input);
      item.appendChild(progress);
      goalListEl.appendChild(item);
    });
    console.log('Goal panel rendered');
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
      if (!categoryList.includes(entry.category)) {
        categoryList.push(entry.category);
        saveCategoryList();
      }
      entries.push(entry);
      saveEntries();
      form.reset();
      renderCategoryOverview();
      renderGoalPanel();
    }
  });

  function getSelectedDays() {
    return Array.from(dayFilterInputs)
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.value, 10));
  }

  function getFilteredEntries() {
    const start = startDateInput.value ? parseLocalDate(startDateInput.value) : null;
    const end = endDateInput.value ? parseLocalDate(endDateInput.value) : null;
    const allowedDays = getSelectedDays();
    return entries.filter(e => {
      const d = parseLocalDate(e.date);
      return (!start || d >= start) && (!end || d <= end) && allowedDays.includes(d.getDay());
    });
  }

  function renderChart() {
    const filtered = getFilteredEntries();
    const type = chartTypeSelect.value;

    if (chart) chart.destroy();

    if (type === 'line') {
      const start = startDateInput.value
        ? parseLocalDate(startDateInput.value)
        : filtered.length
          ? new Date(Math.min(...filtered.map(e => parseLocalDate(e.date).getTime())))
          : new Date();
      const end = endDateInput.value
        ? parseLocalDate(endDateInput.value)
        : filtered.length
          ? new Date(Math.max(...filtered.map(e => parseLocalDate(e.date).getTime())))
          : new Date();

      const allowedDays = getSelectedDays();
      const dates = [];
      const d = new Date(start);
      while (d <= end) {
        if (allowedDays.includes(d.getDay())) {
          dates.push(d.toISOString().slice(0, 10));
        }
        d.setDate(d.getDate() + 1);
      }

      const categories = [...new Set(filtered.map(e => e.category))];
      const datasets = categories.map(cat => {
        const data = dates.map(date => {
          return filtered
            .filter(e => e.category === cat && e.date === date)
            .reduce((s, e) => s + e.hours, 0);
        });
        return {
          label: cat,
          data,
          borderColor: categoryColors[cat] || '#000',
          backgroundColor: categoryColors[cat] || 'rgba(0,0,0,0.1)',
          fill: false,
        };
      });

      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets,
        },
        options: {
          scales: {
            y: { beginAtZero: true },
          },
        },
      });
    } else {
      const totals = {};
      filtered.forEach(e => {
        totals[e.category] = (totals[e.category] || 0) + e.hours;
      });
      const labels = Object.keys(totals);
      const data = labels.map(l => totals[l]);

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
          scales: type === 'bar' ? { y: { beginAtZero: true } } : {}
        }
      });
    }
    console.log('Chart rendered');
  }

  function renderView() {
    renderCategoryOverview();
    renderChart();
    renderGoalPanel();
    console.log('View rendered');
  }

  showChartBtn.addEventListener('click', renderChart);
  dayFilterInputs.forEach(cb => cb.addEventListener('change', renderChart));
  rangeSelect.addEventListener('change', renderCategoryOverview);
  exportBtn.addEventListener('click', exportToExcel);
  prevWeekBtn.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderCategoryOverview();
    renderGoalPanel();
  });
  nextWeekBtn.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderCategoryOverview();
    renderGoalPanel();
  });

  window.addEventListener('storage', () => {
    entries = JSON.parse(localStorage.getItem('entries') || '[]');
    categoryColors = JSON.parse(localStorage.getItem('categoryColors') || '{}');
    renderCategoryOverview();
    categoryList = JSON.parse(localStorage.getItem('categoryList') || '[]');
    goals = JSON.parse(localStorage.getItem('goals') || '{"daily":{},"weekly":{}}');
    renderGoalPanel();
  });
signupBtn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    const pass = passwordInput.value;
    if (email && pass) {
      auth.createUserWithEmailAndPassword(email, pass).catch(e => alert(e.message));
    }
  });
  loginBtn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    const pass = passwordInput.value;
    if (email && pass) {
      auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
    }
  });
  logoutBtn.addEventListener("click", () => {
    auth.signOut();
  });
  auth.onAuthStateChanged(user => {
    if (user) {
      signupBtn.style.display = "none";
      loginBtn.style.display = "none";
      logoutBtn.style.display = "inline";
      userInfo.textContent = user.email;
      db.collection("users").doc(user.uid).get().then(doc => {
        if (doc.exists) {
          const data = doc.data();
          entries = data.entries || [];
          categoryColors = data.categoryColors || {};
          categoryList = data.categoryList || [];
          goals = data.goals || {daily:{},weekly:{}};
        } else {
          entries = [];
          categoryColors = {};
          categoryList = [];
          goals = {daily:{},weekly:{}};
        }
        saveEntries();
        saveColors();
        saveCategoryList();
        saveGoals();
        renderView();
      });
    } else {
      signupBtn.style.display = "inline";
      loginBtn.style.display = "inline";
      logoutBtn.style.display = "none";
      userInfo.textContent = "";
      entries = JSON.parse(localStorage.getItem("entries") || "[]");
      categoryColors = JSON.parse(localStorage.getItem("categoryColors") || "{}");
      categoryList = JSON.parse(localStorage.getItem("categoryList") || "[]");
        goals = JSON.parse(localStorage.getItem("goals") || "{\"daily\":{},\"weekly\":{}}");
      renderView();
    }
  });
})();
