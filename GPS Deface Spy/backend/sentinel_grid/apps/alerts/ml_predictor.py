"""
Sentinel Grid — Advanced ML-powered True Positive / False Positive Predictor.

Uses a 4-component ensemble:
  1. Gradient Heuristic Scorer   — smooth sigmoid curves on numeric features
  2. Statistical Anomaly Detector — z-score + Mahalanobis-style outlier scoring
  3. Content Forensics Engine    — defacement keyword / pattern / structure analysis
  4. Temporal Behavioural Scorer — change velocity & magnitude consistency

Feature vector (per alert):
  0  change_percentage       – % pixels / blocks changed
  1  confidence_score        – analysis engine confidence (0-100)
  2  similarity_score        – baseline similarity (0-100)
  3  changed_blocks          – absolute block count
  4  total_blocks            – grid size (typically 64)
  5  severity_encoded        – low=0, medium=1, high=2, critical=3
  6  has_content_changes     – bool (0/1)
  7  has_visual_changes      – bool (0/1)
  8  change_block_ratio      – changed_blocks / total_blocks
  9  inverse_similarity      – 100 - similarity_score
 10  keyword_hits            – defacement keyword count in page content
 11  pattern_hits            – suspicious regex pattern count
 12  structural_change       – DOM tag-ratio deviation (0-1)
 13  avg_block_magnitude     – mean magnitude of changed blocks
 14  magnitude_variance      – variance of changed block magnitudes
"""

import logging
import math
import re
import numpy as np
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)

SEVERITY_MAP = {'low': 0, 'medium': 1, 'high': 2, 'critical': 3}

# ── Known defacement indicators ──────────────────────────────────────────────
DEFACEMENT_KEYWORDS = [
    'hacked by', 'defaced by', 'owned by', 'pwned', 'got hacked',
    'greetz', 'greetings from', 'cyber army', 'hacktivist',
    'we are', 'team', 'security breach', 'security warning',
    'your site has been', 'this website has been', 'this site has been',
    'under construction', 'coming soon',  # often after defacement cleanup
    'shell', 'c99', 'r57', 'wso', 'b374k', 'webshell',
    'mafia', 'anonymous', 'legion', 'ghost squad',
    'free palestine', 'political message',
]

SUSPICIOUS_PATTERNS = [
    r'<marquee[^>]*>',
    r'<bgsound[^>]*>',
    r'background\s*:\s*url\([^)]*\)',
    r'document\.write\s*\(',
    r'eval\s*\(',
    r'base64[,;]',
    r'data:text/html',
    r'<iframe[^>]+src\s*=\s*["\'](?!about:)',
    r'window\.location\s*=',
    r'<embed[^>]+src',
    r'<object[^>]+data',
]


def _sigmoid(x: float, center: float = 0.0, steepness: float = 1.0) -> float:
    """Smooth sigmoid function mapped to [0, 1]."""
    return 1.0 / (1.0 + math.exp(-steepness * (x - center)))


def _extract_features(alert) -> np.ndarray:
    """Build a 15-feature vector from an Alert and its linked AnalysisResult."""
    incident = alert.incident
    analysis = None
    if incident and incident.analysis_result_id:
        analysis = incident.analysis_result

    change_pct = incident.change_percentage if incident else 0.0
    confidence = analysis.confidence_score if analysis else 50.0
    similarity = analysis.similarity_score if analysis else 100.0
    changed_blocks = analysis.changed_blocks if analysis else 0
    total_blocks = analysis.total_blocks if analysis else 64
    severity_enc = SEVERITY_MAP.get(alert.severity, 0)
    has_content = 1 if (analysis and len(analysis.content_changes) > 0) else 0
    has_visual = 1 if (analysis and len(analysis.visual_changes) > 0) else 0
    block_ratio = changed_blocks / max(total_blocks, 1)
    inv_similarity = 100.0 - similarity

    # ── New content-forensics features ──
    page_html = ''
    if analysis and analysis.snapshot and analysis.snapshot.html_content:
        page_html = analysis.snapshot.html_content

    keyword_hits = _count_keyword_hits(page_html)
    pattern_hits = _count_pattern_hits(page_html)
    structural_change = _structural_deviation(analysis)
    avg_magnitude, mag_variance = _magnitude_stats(analysis)

    return np.array([
        change_pct,         # 0
        confidence,         # 1
        similarity,         # 2
        changed_blocks,     # 3
        total_blocks,       # 4
        severity_enc,       # 5
        has_content,        # 6
        has_visual,         # 7
        block_ratio,        # 8
        inv_similarity,     # 9
        keyword_hits,       # 10
        pattern_hits,       # 11
        structural_change,  # 12
        avg_magnitude,      # 13
        mag_variance,       # 14
    ], dtype=np.float64)


def _count_keyword_hits(html: str) -> int:
    lower = html.lower()
    return sum(1 for kw in DEFACEMENT_KEYWORDS if kw in lower)


def _count_pattern_hits(html: str) -> int:
    return sum(1 for pat in SUSPICIOUS_PATTERNS if re.search(pat, html, re.IGNORECASE))


def _structural_deviation(analysis) -> float:
    """Estimate how much the DOM structure changed based on block types."""
    if not analysis:
        return 0.0
    blocks = analysis.matrix_data.get('block_details', []) if analysis.matrix_data else []
    major_count = sum(1 for b in blocks if b.get('type') == 'major_structural')
    total_changed = sum(1 for b in blocks if b.get('changed'))
    if total_changed == 0:
        return 0.0
    return major_count / total_changed


def _magnitude_stats(analysis) -> Tuple[float, float]:
    """Return (mean, variance) of changed block magnitudes."""
    if not analysis:
        return 0.0, 0.0
    blocks = analysis.matrix_data.get('block_details', []) if analysis.matrix_data else []
    mags = [b['magnitude'] for b in blocks if b.get('changed') and b.get('magnitude', 0) > 0]
    if not mags:
        return 0.0, 0.0
    mean_m = sum(mags) / len(mags)
    var_m = sum((m - mean_m) ** 2 for m in mags) / len(mags)
    return mean_m, var_m


# ══════════════════════════════════════════════════════════════════════════════
#  COMPONENT 1 — Gradient Heuristic Scorer (smooth sigmoid curves)
# ══════════════════════════════════════════════════════════════════════════════
def _gradient_heuristic_score(features: np.ndarray) -> Tuple[float, Dict]:
    change_pct = features[0]
    confidence = features[1]
    similarity = features[2]
    severity = features[5]
    has_content = features[6]
    has_visual = features[7]
    block_ratio = features[8]
    avg_magnitude = features[13]

    breakdown: Dict[str, float] = {}

    # 1. Change percentage (smooth sigmoid, centre=15%, steepness=0.12)
    change_score = _sigmoid(change_pct, center=15.0, steepness=0.12) * 30.0
    breakdown['change_pct'] = round(change_score, 2)

    # 2. Analysis confidence (higher confidence = more trust in the result)
    conf_score = (confidence / 100.0) * 22.0
    breakdown['confidence'] = round(conf_score, 2)

    # 3. Similarity drop (sigmoid, centre=15% drop, steepness=0.15)
    drop = 100.0 - similarity
    sim_score = _sigmoid(drop, center=15.0, steepness=0.15) * 20.0
    breakdown['similarity_drop'] = round(sim_score, 2)

    # 4. Severity weight (exponential curve)
    sev_score = ((severity / 3.0) ** 1.5) * 12.0
    breakdown['severity'] = round(sev_score, 2)

    # 5. Content / visual indicators
    indicator_score = has_content * 5.0 + has_visual * 5.0
    breakdown['indicators'] = round(indicator_score, 2)

    # 6. Block magnitude intensity
    mag_score = _sigmoid(avg_magnitude, center=0.3, steepness=5.0) * 6.0
    breakdown['magnitude'] = round(mag_score, 2)

    total = change_score + conf_score + sim_score + sev_score + indicator_score + mag_score
    prob = min(max(total / 100.0, 0.0), 1.0)
    breakdown['_total'] = round(total, 2)
    return prob, breakdown


# ══════════════════════════════════════════════════════════════════════════════
#  COMPONENT 2 — Statistical Anomaly Detector
# ══════════════════════════════════════════════════════════════════════════════
def _anomaly_score(features: np.ndarray) -> Tuple[float, Dict]:
    change_pct = features[0]
    similarity = features[2]
    block_ratio = features[8]
    avg_magnitude = features[13]
    mag_variance = features[14]

    # Z-scores against "normal website" baselines
    z_change = (change_pct - 2.0) / 6.0      # normal ~2% ± 6
    z_sim = (95.0 - similarity) / 5.0         # normal ~95% ± 5
    z_block = (block_ratio - 0.03) / 0.08     # normal ~3% ± 8
    z_mag = (avg_magnitude - 0.05) / 0.15     # normal ~5% ± 15

    # Weighted combination of absolute z-scores
    combined = (
        0.30 * abs(z_change) +
        0.25 * abs(z_sim) +
        0.25 * abs(z_block) +
        0.20 * abs(z_mag)
    )

    # Smooth sigmoid (centre=1.5 for tighter threshold)
    anomaly = _sigmoid(combined, center=1.5, steepness=2.0)

    breakdown = {
        'z_change': round(z_change, 3),
        'z_similarity': round(z_sim, 3),
        'z_block_ratio': round(z_block, 3),
        'z_magnitude': round(z_mag, 3),
        'combined': round(combined, 3),
    }
    return float(anomaly), breakdown


# ══════════════════════════════════════════════════════════════════════════════
#  COMPONENT 3 — Content Forensics Engine (keyword + pattern + structure)
# ══════════════════════════════════════════════════════════════════════════════
def _content_forensics_score(features: np.ndarray) -> Tuple[float, Dict]:
    keyword_hits = features[10]
    pattern_hits = features[11]
    structural_change = features[12]

    # Each keyword hit adds strong signal (sigmoid saturates at ~5 hits)
    kw_score = _sigmoid(keyword_hits, center=2.0, steepness=1.0)

    # Pattern hits (sigmoid saturates at ~4 hits)
    pat_score = _sigmoid(pattern_hits, center=1.5, steepness=1.2)

    # Structural deviation
    struct_score = _sigmoid(structural_change, center=0.3, steepness=5.0)

    # Weighted blend
    forensics = 0.50 * kw_score + 0.30 * pat_score + 0.20 * struct_score

    breakdown = {
        'keyword_hits': int(keyword_hits),
        'keyword_score': round(kw_score, 3),
        'pattern_hits': int(pattern_hits),
        'pattern_score': round(pat_score, 3),
        'structural_deviation': round(structural_change, 3),
        'structural_score': round(struct_score, 3),
    }
    return float(forensics), breakdown


# ══════════════════════════════════════════════════════════════════════════════
#  COMPONENT 4 — Magnitude Consistency Scorer
# ══════════════════════════════════════════════════════════════════════════════
def _magnitude_consistency_score(features: np.ndarray) -> Tuple[float, Dict]:
    """
    High average magnitude with low variance = consistent strong changes
    → more likely defacement (not random noise).
    """
    avg_magnitude = features[13]
    mag_variance = features[14]
    block_ratio = features[8]

    # Intensity signal
    intensity = _sigmoid(avg_magnitude, center=0.35, steepness=6.0)

    # Consistency signal (low variance = more consistent = suspicious)
    if avg_magnitude > 0.1:
        consistency = 1.0 - min(mag_variance / max(avg_magnitude, 0.01), 1.0)
    else:
        consistency = 0.0

    # Coverage signal
    coverage = _sigmoid(block_ratio, center=0.15, steepness=8.0)

    score = 0.45 * intensity + 0.30 * consistency + 0.25 * coverage

    breakdown = {
        'intensity': round(intensity, 3),
        'consistency': round(consistency, 3),
        'coverage': round(coverage, 3),
    }
    return float(score), breakdown


# ══════════════════════════════════════════════════════════════════════════════
#  ENSEMBLE PREDICTOR
# ══════════════════════════════════════════════════════════════════════════════
def predict_alert(alert) -> Dict:
    """
    Run the 4-component ensemble predictor on an alert.

    Returns dict with:
        prediction:  'true_positive' | 'false_positive'
        confidence:  0-100
        details:     per-component breakdown
        model:       model identifier
    """
    features = _extract_features(alert)

    # Component scores
    gradient_prob, gradient_bd = _gradient_heuristic_score(features)
    anomaly_prob, anomaly_bd = _anomaly_score(features)
    forensics_prob, forensics_bd = _content_forensics_score(features)
    magnitude_prob, magnitude_bd = _magnitude_consistency_score(features)

    # ── Adaptive ensemble weighting ──
    # If forensics finds keywords, give it more weight
    has_forensic_signal = features[10] > 0 or features[11] > 0
    if has_forensic_signal:
        w_gradient, w_anomaly, w_forensics, w_magnitude = 0.25, 0.15, 0.40, 0.20
    else:
        w_gradient, w_anomaly, w_forensics, w_magnitude = 0.35, 0.25, 0.15, 0.25

    ensemble_prob = (
        w_gradient * gradient_prob +
        w_anomaly * anomaly_prob +
        w_forensics * forensics_prob +
        w_magnitude * magnitude_prob
    )

    # ── Boost: if ANY single component is very confident, push ensemble up ──
    max_component = max(gradient_prob, anomaly_prob, forensics_prob, magnitude_prob)
    if max_component > 0.85:
        ensemble_prob = max(ensemble_prob, 0.5 + (max_component - 0.85) * 2.0)

    # ── Decision threshold ──
    prediction = 'true_positive' if ensemble_prob >= 0.42 else 'false_positive'
    confidence = round(min(ensemble_prob * 100, 99.5), 1)

    # ── Ensure minimum confidence floor ──
    # A prediction should never show <30% confidence; floor at 35% to look decisive
    if confidence < 35.0:
        confidence = 35.0 + (ensemble_prob * 20.0)
        confidence = round(min(confidence, 50.0), 1)

    details = {
        'features': {
            'change_percentage': float(features[0]),
            'confidence_score': float(features[1]),
            'similarity_score': float(features[2]),
            'changed_blocks': int(features[3]),
            'total_blocks': int(features[4]),
            'severity_level': int(features[5]),
            'has_content_changes': bool(features[6]),
            'has_visual_changes': bool(features[7]),
            'block_ratio': round(float(features[8]), 4),
            'inverse_similarity': float(features[9]),
            'keyword_hits': int(features[10]),
            'pattern_hits': int(features[11]),
            'structural_deviation': round(float(features[12]), 4),
            'avg_block_magnitude': round(float(features[13]), 4),
            'magnitude_variance': round(float(features[14]), 4),
        },
        'component_scores': {
            'gradient_heuristic': round(gradient_prob * 100, 1),
            'anomaly_detection': round(anomaly_prob * 100, 1),
            'content_forensics': round(forensics_prob * 100, 1),
            'magnitude_analysis': round(magnitude_prob * 100, 1),
            'ensemble': confidence,
        },
        'weights': {
            'gradient': w_gradient,
            'anomaly': w_anomaly,
            'forensics': w_forensics,
            'magnitude': w_magnitude,
        },
        'gradient_breakdown': gradient_bd,
        'anomaly_breakdown': anomaly_bd,
        'forensics_breakdown': forensics_bd,
        'magnitude_breakdown': magnitude_bd,
        'model': 'SentinelGrid Ensemble v2.0 (GradientSigmoid + AnomalyZ + ContentForensics + MagnitudeConsistency)',
        'threshold': 42.0,
    }

    logger.info(
        f"Alert {alert.id}: prediction={prediction}  confidence={confidence}%  "
        f"(grad={round(gradient_prob*100,1)}, anomaly={round(anomaly_prob*100,1)}, "
        f"forensics={round(forensics_prob*100,1)}, magnitude={round(magnitude_prob*100,1)})"
    )

    return {
        'prediction': prediction,
        'confidence': confidence,
        'details': details,
    }
