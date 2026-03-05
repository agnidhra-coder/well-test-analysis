"""
Flask web application for Well Test Analysis (Horner Method).
"""

import io
import numpy as np
import pandas as pd
from flask import Flask, render_template, request, jsonify

from src.horner import horner_analysis

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/analyze', methods=['POST'])
def analyze():
    # Reservoir / well parameters
    tp = float(request.form.get('tp', 4800))         # production time (hours)
    q = float(request.form.get('q', 250))             # rate (STB/day)
    B = float(request.form.get('B', 1.2))             # FVF
    mu = float(request.form.get('mu', 0.8))           # viscosity (cp)
    h = float(request.form.get('h', 50))              # net pay (ft)
    phi = float(request.form.get('phi', 0.15))        # porosity
    ct = float(request.form.get('ct', 15e-6))         # compressibility (1/psi)
    rw = float(request.form.get('rw', 0.328))         # wellbore radius (ft)

    # Load CSV
    if 'file' in request.files and request.files['file'].filename:
        file = request.files['file']
        content = file.read().decode('utf-8')
        df = pd.read_csv(io.StringIO(content))
    else:
        df = pd.read_csv('data/sample_buildup.csv')

    # Detect columns
    cols = df.columns.tolist()
    dt_col = None
    pws_col = None
    for c in cols:
        cl = c.lower()
        if 'dt' in cl or 'time' in cl or 'shut' in cl:
            dt_col = c
        if 'pressure' in cl or 'pws' in cl or 'p_ws' in cl:
            pws_col = c

    if not dt_col or not pws_col:
        if len(cols) >= 2:
            dt_col = cols[0]
            pws_col = cols[1]
        else:
            return jsonify({
                'error': 'Could not identify time and pressure columns. '
                         'Expected columns with "dt"/"time" and "pressure"/"pws" in their names.'
            }), 400

    dt = df[dt_col].values.astype(float)
    pws = df[pws_col].values.astype(float)

    # Remove zero/negative dt
    valid = dt > 0
    dt = dt[valid]
    pws = pws[valid]

    if len(dt) < 4:
        return jsonify({'error': 'Need at least 4 data points with positive shut-in time.'}), 400

    try:
        results = horner_analysis(tp, dt, pws, q, B, mu, h, phi, ct, rw)
    except Exception as e:
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 400

    results['input_params'] = {
        'tp': tp, 'q': q, 'B': B, 'mu': mu,
        'h': h, 'phi': phi, 'ct': ct, 'rw': rw,
    }
    results['columns'] = {'dt': dt_col, 'pws': pws_col}
    results['available_columns'] = cols

    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True, port=5051)
