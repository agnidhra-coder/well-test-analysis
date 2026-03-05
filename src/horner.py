"""
Horner Analysis for pressure buildup tests.

Theory:
    During a pressure buildup test, a well is shut in after producing at rate q
    for time tp. The Horner time ratio is defined as:
        X = (tp + dt) / dt

    Plotting pressure (pws) vs log10(X) yields the Horner plot.
    The straight-line portion has slope m, from which:
        - Permeability: k = 162.6 * q * B * mu / (m * h)
        - Skin factor:  s = 1.1513 * [(p1hr - pwf) / m - log10(k / (phi * mu * ct * rw^2)) + 3.2275]
        - Reservoir pressure: p* = extrapolation of straight line to Horner time = 1 (log=0)
"""

import numpy as np
from scipy import stats


def compute_horner_time(tp, dt):
    """Compute Horner time ratio (tp + dt) / dt."""
    dt_safe = np.where(dt > 0, dt, 1e-10)
    return (tp + dt_safe) / dt_safe


def horner_analysis(tp, dt, pws, q, B, mu, h, phi, ct, rw):
    """
    Perform Horner analysis on pressure buildup data.

    Parameters
    ----------
    tp : float
        Production time before shut-in (hours)
    dt : array-like
        Shut-in time (hours)
    pws : array-like
        Shut-in pressure (psi)
    q : float
        Production rate before shut-in (STB/day)
    B : float
        Formation volume factor (RB/STB)
    mu : float
        Oil viscosity (cp)
    h : float
        Net pay thickness (ft)
    phi : float
        Porosity (fraction)
    ct : float
        Total compressibility (1/psi)
    rw : float
        Wellbore radius (ft)

    Returns
    -------
    dict with analysis results
    """
    dt = np.asarray(dt, dtype=float)
    pws = np.asarray(pws, dtype=float)

    horner_ratio = compute_horner_time(tp, dt)
    log_horner = np.log10(horner_ratio)

    # Sort by log_horner ascending for regression
    sort_idx = np.argsort(log_horner)
    log_horner_sorted = log_horner[sort_idx]
    pws_sorted = pws[sort_idx]

    # Auto-detect the semi-log straight line (SLSL) region
    n = len(log_horner_sorted)
    best_score = -1
    best_start = 0
    best_end = n
    best_slope = 0
    best_intercept = 0
    best_r2_val = 0

    min_points = max(4, n // 4)
    for start in range(0, n - min_points):
        for end in range(start + min_points, n + 1):
            segment_x = log_horner_sorted[start:end]
            segment_y = pws_sorted[start:end]
            slope, intercept, r_value, _, _ = stats.linregress(segment_x, segment_y)
            r2 = r_value ** 2
            length_bonus = len(segment_x) / n * 0.05
            score = r2 + length_bonus
            if score > best_score and r2 > 0.9:
                best_score = score
                best_start = start
                best_end = end
                best_slope = slope
                best_intercept = intercept
                best_r2_val = r2

    # Fallback: use all points
    if best_score < 0:
        best_slope, best_intercept, r_value, _, _ = stats.linregress(
            log_horner_sorted, pws_sorted
        )
        best_r2_val = r_value ** 2
        best_start = 0
        best_end = n

    m = abs(best_slope)  # slope magnitude (psi/cycle)

    # Permeability (md)
    k = 162.6 * q * B * mu / (m * h)

    # Reservoir pressure p* = extrapolate to log10(horner_time) = 0
    p_star = best_intercept

    # p1hr: pressure at dt = 1 hour from the straight line
    log_horner_1hr = np.log10((tp + 1.0) / 1.0)
    p1hr = best_slope * log_horner_1hr + best_intercept

    # Flowing pressure at shut-in
    pwf = pws[0]

    # Skin factor
    log_term = np.log10(k / (phi * mu * ct * rw ** 2))
    s = 1.1513 * ((p1hr - pwf) / m - log_term + 3.2275)

    # Pressure drop due to skin
    delta_p_skin = 0.8691 * m * s

    # Flow efficiency
    if p_star > pwf:
        flow_efficiency = (p_star - pwf - delta_p_skin) / (p_star - pwf)
    else:
        flow_efficiency = 1.0

    # Straight line for plotting
    x_line = np.linspace(0, max(log_horner_sorted) * 1.05, 100)
    y_line = best_slope * x_line + best_intercept

    # SLSL region mask in original data order
    slsl_mask = np.zeros(n, dtype=bool)
    slsl_mask[sort_idx[best_start:best_end]] = True

    return {
        'horner_ratio': horner_ratio.tolist(),
        'log_horner': log_horner.tolist(),
        'pws': pws.tolist(),
        'dt': dt.tolist(),

        'sl_x': x_line.tolist(),
        'sl_y': y_line.tolist(),
        'sl_r2': round(best_r2_val, 6),
        'slope_m': round(m, 4),
        'intercept': round(best_intercept, 4),
        'slsl_mask': slsl_mask.tolist(),

        'permeability_md': round(k, 4),
        'skin_factor': round(s, 4),
        'reservoir_pressure_psi': round(p_star, 2),
        'p1hr_psi': round(p1hr, 2),
        'pwf_psi': round(pwf, 2),
        'delta_p_skin_psi': round(delta_p_skin, 2),
        'flow_efficiency': round(flow_efficiency, 4),
    }
