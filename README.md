# Well Test Analysis — Horner Method

A web application for analyzing pressure buildup tests using the Horner method. Upload shut-in pressure data, provide reservoir parameters, and get key results: permeability, skin factor, reservoir pressure, and flow efficiency.

## What It Does

The app performs a **Horner analysis** on pressure buildup test data:

1. Computes the Horner time ratio `(tp + Δt) / Δt` for each data point
2. Automatically detects the **semi-log straight line** region on the Horner plot
3. Calculates reservoir properties from the straight line slope:
   - **Permeability** — `k = 162.6 × q × B × μ / (m × h)`
   - **Skin factor** — from the p₁ₕᵣ extrapolation
   - **Reservoir pressure (p\*)** — extrapolation of the straight line
   - **Flow efficiency** — `(p* - pwf - ΔPskin) / (p* - pwf)`

## Input

### CSV Data

Upload a CSV file with two columns:
- **Shut-in time** (`Δt`) in hours — column name containing "dt", "time", or "shut"
- **Shut-in pressure** (`Pws`) in psi — column name containing "pressure", "pws", or "p_ws"

If column names don't match, the app falls back to using the first two columns. A sample dataset (`data/sample_buildup.csv`) is used when no file is uploaded.

### Reservoir Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| tp | Production time before shut-in (hours) | 4800 |
| q | Production rate (STB/day) | 250 |
| B | Formation volume factor (RB/STB) | 1.2 |
| μ | Oil viscosity (cp) | 0.8 |
| h | Net pay thickness (ft) | 50 |
| φ | Porosity (fraction) | 0.15 |
| ct | Total compressibility (1/psi) | 15×10⁻⁶ |
| rw | Wellbore radius (ft) | 0.328 |

## Output

### Result Cards
Permeability, skin factor, reservoir pressure, and flow efficiency with supporting values (slope, R², p₁ₕᵣ, pwf, ΔPskin).

### Charts
- **Horner Plot** — Semi-log plot of Pws vs log₁₀[(tp + Δt) / Δt] with the fitted straight line and identified straight-line points
- **Pressure vs Shut-in Time** — Pws vs Δt
- **Derivative Plot** — Bourdet pressure derivative on log-log scale

## Project Structure

```
well-test-analysis/
├── app.py                  # Flask app and API endpoint
├── src/
│   └── horner.py           # Horner analysis logic
├── static/
│   ├── app.js              # Chart rendering (Chart.js)
│   └── style.css           # UI styles
├── templates/
│   └── index.html          # Main page
├── data/
│   └── sample_buildup.csv  # Sample dataset
├── requirements.txt
└── render.yaml             # Render deployment config
```

## Tech Stack

- **Backend**: Flask, NumPy, SciPy, Pandas
- **Frontend**: Vanilla JS, Chart.js
- **Deployment**: Render (Gunicorn)
