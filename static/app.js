let charts = {};

// File upload label
document.getElementById('csvFile').addEventListener('change', function () {
    const label = document.getElementById('fileLabel');
    if (this.files.length > 0) {
        label.textContent = this.files[0].name;
        label.style.color = 'var(--text)';
        label.style.borderColor = 'var(--accent)';
    }
});

function toggleAdvanced() {
    const panel = document.getElementById('advancedPanel');
    const icon = document.getElementById('advToggleIcon');
    panel.classList.toggle('open');
    icon.textContent = panel.classList.contains('open') ? '−' : '+';
}

function runAnalysis() {
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    btn.textContent = 'Running...';

    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('results').style.display = 'none';
    document.getElementById('loading').classList.add('active');
    document.getElementById('errorMsg').style.display = 'none';

    const formData = new FormData();
    const fileInput = document.getElementById('csvFile');
    if (fileInput.files.length > 0) {
        formData.append('file', fileInput.files[0]);
    }

    formData.append('tp', document.getElementById('tp').value);
    formData.append('q', document.getElementById('q').value);
    formData.append('B', document.getElementById('B').value);
    formData.append('mu', document.getElementById('mu').value);
    formData.append('h', document.getElementById('h').value);
    formData.append('phi', document.getElementById('phi').value);
    formData.append('ct', document.getElementById('ct').value);
    formData.append('rw', document.getElementById('rw').value);

    fetch('/api/analyze', { method: 'POST', body: formData })
        .then(r => r.json().then(data => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
            document.getElementById('loading').classList.remove('active');
            btn.disabled = false;
            btn.textContent = 'Analyze';

            if (!ok) {
                document.getElementById('errorMsg').textContent = data.error;
                document.getElementById('errorMsg').style.display = 'block';
                return;
            }

            renderResults(data);
        })
        .catch(err => {
            document.getElementById('loading').classList.remove('active');
            btn.disabled = false;
            btn.textContent = 'Analyze';
            document.getElementById('errorMsg').textContent = 'Network error: ' + err.message;
            document.getElementById('errorMsg').style.display = 'block';
        });
}

function renderResults(data) {
    document.getElementById('results').style.display = 'block';

    // Result cards
    const cardsDiv = document.getElementById('resultCards');

    const skinColor = data.skin_factor > 0 ? 'var(--red)' : 'var(--green)';
    const skinLabel = data.skin_factor > 0 ? 'Damaged' : 'Stimulated';
    const feColor = data.flow_efficiency >= 1.0 ? 'var(--green)' : 'var(--orange)';

    cardsDiv.innerHTML = `
        <div class="card highlight">
            <div class="card-label">Permeability</div>
            <div class="card-value" style="color: var(--accent)">
                ${data.permeability_md.toFixed(2)}<span class="card-unit">md</span>
            </div>
            <div class="card-detail">
                Slope m = <span>${data.slope_m.toFixed(2)}</span> psi/cycle<br>
                R&sup2; = <span>${data.sl_r2.toFixed(4)}</span>
            </div>
        </div>
        <div class="card highlight">
            <div class="card-label">Skin Factor</div>
            <div class="card-value" style="color: ${skinColor}">
                ${data.skin_factor > 0 ? '+' : ''}${data.skin_factor.toFixed(2)}
            </div>
            <div class="card-detail">
                ${skinLabel}<br>
                &Delta;P<sub>skin</sub> = <span>${data.delta_p_skin_psi.toFixed(1)}</span> psi
            </div>
        </div>
        <div class="card highlight">
            <div class="card-label">Reservoir Pressure</div>
            <div class="card-value" style="color: var(--green)">
                ${data.reservoir_pressure_psi.toFixed(0)}<span class="card-unit">psi</span>
            </div>
            <div class="card-detail">
                P<sub>1hr</sub> = <span>${data.p1hr_psi.toFixed(1)}</span> psi<br>
                P<sub>wf</sub> = <span>${data.pwf_psi.toFixed(1)}</span> psi
            </div>
        </div>
        <div class="card">
            <div class="card-label">Flow Efficiency</div>
            <div class="card-value" style="color: ${feColor}">
                ${(data.flow_efficiency * 100).toFixed(1)}<span class="card-unit">%</span>
            </div>
            <div class="card-detail">
                FE = (P* - P<sub>wf</sub> - &Delta;P<sub>s</sub>) / (P* - P<sub>wf</sub>)
            </div>
        </div>
    `;

    // Destroy old charts
    Object.values(charts).forEach(c => c.destroy());
    charts = {};

    renderHornerChart(data);
    renderPressureChart(data);
    renderDerivativeChart(data);
}

const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: {
                color: '#8b8fa8',
                font: { size: 12 },
                usePointStyle: true,
                boxWidth: 8,
                boxHeight: 8,
                generateLabels: function (chart) {
                    const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                    labels.forEach(l => { l.pointStyle = 'line'; });
                    return labels;
                },
            },
        },
    },
    scales: {
        x: {
            ticks: { color: '#8b8fa8', maxTicksLimit: 10 },
            grid: { color: 'rgba(46,51,72,0.5)' },
        },
        y: {
            ticks: { color: '#8b8fa8' },
            grid: { color: 'rgba(46,51,72,0.5)' },
        },
    },
};

function renderHornerChart(data) {
    // Separate SLSL and non-SLSL points
    const slslPoints = [];
    const otherPoints = [];
    for (let i = 0; i < data.log_horner.length; i++) {
        const pt = { x: data.log_horner[i], y: data.pws[i] };
        if (data.slsl_mask[i]) {
            slslPoints.push(pt);
        } else {
            otherPoints.push(pt);
        }
    }

    // Straight line
    const linePoints = [];
    for (let i = 0; i < data.sl_x.length; i++) {
        linePoints.push({ x: data.sl_x[i], y: data.sl_y[i] });
    }

    charts.horner = new Chart(document.getElementById('hornerChart'), {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Horner Straight Line',
                    data: linePoints,
                    type: 'line',
                    borderColor: '#e74c3c',
                    borderWidth: 2,
                    borderDash: [6, 3],
                    pointRadius: 0,
                    pointStyle: 'dash',
                    fill: false,
                    order: 0,
                },
                {
                    label: 'Straight Line Points',
                    data: slslPoints,
                    backgroundColor: '#4f8cff',
                    borderColor: '#4f8cff',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointStyle: 'circle',
                    order: 1,
                },
                {
                    label: 'Other Points',
                    data: otherPoints,
                    backgroundColor: '#8b8fa855',
                    borderColor: '#8b8fa888',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointStyle: 'circle',
                    order: 2,
                },
            ],
        },
        options: {
            ...CHART_DEFAULTS,
            plugins: {
                ...CHART_DEFAULTS.plugins,
                legend: {
                    labels: {
                        color: '#8b8fa8',
                        font: { size: 12 },
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true,
                    },
                },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            return `log(Horner): ${ctx.parsed.x.toFixed(3)}, Pws: ${ctx.parsed.y.toFixed(1)} psi`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ...CHART_DEFAULTS.scales.x,
                    title: { display: true, text: 'log\u2081\u2080[(tp + \u0394t) / \u0394t]', color: '#8b8fa8' },
                    reverse: true,
                },
                y: {
                    ...CHART_DEFAULTS.scales.y,
                    title: { display: true, text: 'Shut-in Pressure Pws (psi)', color: '#8b8fa8' },
                },
            },
        },
    });
}

function renderPressureChart(data) {
    const points = [];
    for (let i = 0; i < data.dt.length; i++) {
        points.push({ x: data.dt[i], y: data.pws[i] });
    }

    charts.pressure = new Chart(document.getElementById('pressureChart'), {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Pws vs \u0394t',
                    data: points,
                    backgroundColor: '#2ecc71',
                    borderColor: '#2ecc71',
                    pointRadius: 4,
                    showLine: true,
                    tension: 0.3,
                    borderWidth: 2,
                },
            ],
        },
        options: {
            ...CHART_DEFAULTS,
            scales: {
                x: {
                    ...CHART_DEFAULTS.scales.x,
                    title: { display: true, text: 'Shut-in Time \u0394t (hours)', color: '#8b8fa8' },
                },
                y: {
                    ...CHART_DEFAULTS.scales.y,
                    title: { display: true, text: 'Pressure (psi)', color: '#8b8fa8' },
                },
            },
        },
    });
}

function renderDerivativeChart(data) {
    // Bourdet pressure derivative: d(pws)/d(ln(dt))
    // Approximate using central differences
    const dt = data.dt;
    const pws = data.pws;
    const derivPoints = [];

    for (let i = 1; i < dt.length - 1; i++) {
        const dlndt = Math.log(dt[i + 1]) - Math.log(dt[i - 1]);
        if (dlndt === 0) continue;
        const dpws = pws[i + 1] - pws[i - 1];
        const deriv = dpws / dlndt;
        derivPoints.push({ x: dt[i], y: Math.abs(deriv) });
    }

    charts.derivative = new Chart(document.getElementById('derivativeChart'), {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Pressure Derivative',
                    data: derivPoints,
                    backgroundColor: '#e67e22',
                    borderColor: '#e67e22',
                    pointRadius: 4,
                    showLine: true,
                    tension: 0.3,
                    borderWidth: 2,
                },
            ],
        },
        options: {
            ...CHART_DEFAULTS,
            scales: {
                x: {
                    ...CHART_DEFAULTS.scales.x,
                    type: 'logarithmic',
                    title: { display: true, text: '\u0394t (hours)', color: '#8b8fa8' },
                    ticks: { color: '#8b8fa8' },
                },
                y: {
                    ...CHART_DEFAULTS.scales.y,
                    type: 'logarithmic',
                    title: { display: true, text: '|dP/d(ln \u0394t)| (psi)', color: '#8b8fa8' },
                    ticks: { color: '#8b8fa8' },
                },
            },
        },
    });
}
