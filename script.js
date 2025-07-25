(() => {
  const form = document.getElementById('entry-form');
  const categoryInput = document.getElementById('category');
  const dateInput = document.getElementById('date');
  const hoursInput = document.getElementById('hours');
  const chartTypeSelect = document.getElementById('chart-type');
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const showChartBtn = document.getElementById('show-chart');
  const ctx = document.getElementById('chart').getContext('2d');

  let chart;
  let entries = JSON.parse(localStorage.getItem('entries') || '[]');

  function saveEntries() {
    localStorage.setItem('entries', JSON.stringify(entries));
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const entry = {
      category: categoryInput.value.trim(),
      date: dateInput.value,
      hours: parseFloat(hoursInput.value)
    };
    if (entry.category && entry.date && !isNaN(entry.hours)) {
      entries.push(entry);
      saveEntries();
      form.reset();
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
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
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
})();
