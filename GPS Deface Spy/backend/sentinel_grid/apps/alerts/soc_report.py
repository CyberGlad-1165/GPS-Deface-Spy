"""
Sentinel Grid — SOC Investigation Report PDF Generator.

Generates a comprehensive, professional PDF that a Security Analyst
can download after investigating an alert.  Includes:
  • Executive Summary
  • Alert Details & Timeline
  • AI/ML Prediction Analysis
  • Manual Classification Decision
  • Investigation Notes
  • Recommendations
"""

import io
import os
import logging
from datetime import datetime

from django.conf import settings
from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)
from reportlab.lib import colors

logger = logging.getLogger(__name__)

# Brand colours
DARK_NAVY  = HexColor('#0a0f1e')
NAVY       = HexColor('#1a1a2e')
TEAL       = HexColor('#00d4aa')
LIGHT_GREY = HexColor('#f5f5f5')
MED_GREY   = HexColor('#666666')
RED        = HexColor('#ef4444')
ORANGE     = HexColor('#f97316')
GREEN      = HexColor('#22c55e')
WHITE      = colors.white

SEVERITY_COLOURS = {
    'low': GREEN,
    'medium': ORANGE,
    'high': ORANGE,
    'critical': RED,
}


class SOCReportGenerator:
    """Generate a PDF SOC Investigation Report for a given Alert."""

    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._add_custom_styles()

    # ── Custom styles ───────────────────────────────────────────

    def _add_custom_styles(self):
        self.styles.add(ParagraphStyle(
            name='SOC_Title',
            parent=self.styles['Title'],
            fontSize=22,
            textColor=NAVY,
            spaceAfter=6,
        ))
        self.styles.add(ParagraphStyle(
            name='SOC_Subtitle',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=MED_GREY,
            spaceAfter=20,
        ))
        self.styles.add(ParagraphStyle(
            name='SOC_Heading',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=NAVY,
            spaceBefore=18,
            spaceAfter=8,
        ))
        self.styles.add(ParagraphStyle(
            name='SOC_Body',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=HexColor('#333333'),
            leading=14,
        ))
        self.styles.add(ParagraphStyle(
            name='SOC_Small',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=MED_GREY,
        ))
        self.styles.add(ParagraphStyle(
            name='SOC_Label',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=MED_GREY,
            spaceAfter=2,
        ))
        self.styles.add(ParagraphStyle(
            name='SOC_Value',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=NAVY,
            spaceAfter=8,
        ))

    # ── Public API ──────────────────────────────────────────────

    def generate(self, alert) -> str:
        """
        Build the PDF and save it under MEDIA_ROOT/soc_reports/.

        Returns:
            Absolute file path of the generated PDF.
        """
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            rightMargin=54, leftMargin=54,
            topMargin=54, bottomMargin=54,
        )

        story = self._build(alert)
        doc.build(story)

        filename = f"SOC_Report_Alert_{alert.id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        dirpath = os.path.join(settings.MEDIA_ROOT, 'soc_reports')
        os.makedirs(dirpath, exist_ok=True)
        filepath = os.path.join(dirpath, filename)

        with open(filepath, 'wb') as f:
            f.write(buf.getvalue())

        logger.info(f"SOC report generated: {filepath}")
        return filepath

    # ── Report builder ──────────────────────────────────────────

    def _build(self, alert) -> list:
        story = []
        incident = alert.incident
        analysis = None
        if incident and incident.analysis_result_id:
            analysis = incident.analysis_result

        # ─── Header ────────────────────────────────────────
        story.append(Paragraph('DEFACE SPY', self.styles['SOC_Title']))
        story.append(Paragraph('SOC Investigation Report', self.styles['SOC_Subtitle']))
        story.append(HRFlowable(
            width='100%', thickness=2, color=TEAL,
            spaceAfter=14, spaceBefore=4,
        ))

        # Report metadata
        meta = [
            ['Report ID', f'SOC-{alert.id:05d}'],
            ['Generated', timezone.now().strftime('%Y-%m-%d %H:%M:%S UTC')],
            ['Classification', (alert.classification or 'pending').replace('_', ' ').title()],
            ['Analyst', alert.classified_by.email if alert.classified_by else 'N/A'],
        ]
        story.append(self._info_table(meta))
        story.append(Spacer(1, 14))

        # ─── 1. Executive Summary ──────────────────────────
        story.append(Paragraph('1. EXECUTIVE SUMMARY', self.styles['SOC_Heading']))
        sev = alert.severity.upper()
        classification_text = (alert.classification or 'pending').replace('_', ' ').upper()
        summary = (
            f'A <b>{sev}</b> severity alert was raised for website '
            f'<b>{alert.website.name}</b> ({alert.website.url}). '
        )
        if incident:
            summary += (
                f'The analysis engine detected <b>{incident.change_percentage:.1f}%</b> change '
                f'across <b>{incident.affected_blocks}</b> blocks. '
            )
        summary += (
            f'After investigation the alert has been classified as '
            f'<b>{classification_text}</b>.'
        )
        story.append(Paragraph(summary, self.styles['SOC_Body']))
        story.append(Spacer(1, 10))

        # ─── 2. Alert Details ──────────────────────────────
        story.append(Paragraph('2. ALERT DETAILS', self.styles['SOC_Heading']))
        details = [
            ['Alert ID', str(alert.id)],
            ['Title', alert.title],
            ['Severity', sev],
            ['Status', alert.status.upper()],
            ['Website', f'{alert.website.name}'],
            ['URL', alert.website.url],
            ['Detected At', alert.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')],
        ]
        if incident:
            details += [
                ['Incident ID', str(incident.id)],
                ['Change %', f'{incident.change_percentage:.2f}%'],
                ['Affected Blocks', str(incident.affected_blocks)],
            ]
        story.append(self._info_table(details))
        story.append(Spacer(1, 10))

        # ─── 3. AI / ML Prediction ─────────────────────────
        story.append(Paragraph('3. AI / ML PREDICTION ANALYSIS', self.styles['SOC_Heading']))

        if alert.ai_prediction != 'pending':
            pred = alert.ai_prediction.replace('_', ' ').upper()
            conf = alert.ai_prediction_confidence
            ai_details = alert.ai_prediction_details or {}

            ai_rows = [
                ['Prediction', pred],
                ['Confidence', f'{conf:.1f}%'],
                ['Model', ai_details.get('model', 'Ensemble v1.0')],
            ]

            comp = ai_details.get('component_scores', {})
            if comp:
                ai_rows += [
                    ['Rule-Based Score', f"{comp.get('rule_based', 'N/A')}%"],
                    ['Anomaly Score', f"{comp.get('anomaly_detection', 'N/A')}%"],
                ]

            story.append(self._info_table(ai_rows))

            # Feature breakdown
            feats = ai_details.get('features', {})
            if feats:
                story.append(Spacer(1, 6))
                story.append(Paragraph('Feature Vector:', self.styles['SOC_Label']))
                feat_rows = [[k.replace('_', ' ').title(), str(v)] for k, v in feats.items()]
                story.append(self._info_table(feat_rows, small=True))
        else:
            story.append(Paragraph(
                'AI prediction has not been run for this alert.',
                self.styles['SOC_Body'],
            ))

        story.append(Spacer(1, 10))

        # ─── 4. Analysis Results ───────────────────────────
        if analysis:
            story.append(Paragraph('4. ANALYSIS ENGINE RESULTS', self.styles['SOC_Heading']))
            an_rows = [
                ['Confidence Score', f'{analysis.confidence_score:.1f}%'],
                ['Similarity Score', f'{analysis.similarity_score:.1f}%'],
                ['Changed Blocks', f'{analysis.changed_blocks} / {analysis.total_blocks}'],
                ['Change %', f'{analysis.change_percentage:.2f}%'],
                ['Defacement Detected', 'YES' if analysis.is_defacement_detected else 'NO'],
            ]
            story.append(self._info_table(an_rows))

            if analysis.ai_explanation:
                story.append(Spacer(1, 6))
                story.append(Paragraph('AI Explanation:', self.styles['SOC_Label']))
                story.append(Paragraph(analysis.ai_explanation, self.styles['SOC_Body']))

            story.append(Spacer(1, 10))

        # ─── 5. Classification Decision ────────────────────
        section_num = 5 if analysis else 4
        story.append(Paragraph(
            f'{section_num}. CLASSIFICATION DECISION', self.styles['SOC_Heading']
        ))
        cls_rows = [
            ['Classification', classification_text],
            ['Classified By', alert.classified_by.email if alert.classified_by else 'N/A'],
            ['Classified At', (
                alert.classified_at.strftime('%Y-%m-%d %H:%M:%S UTC')
                if alert.classified_at else 'N/A'
            )],
        ]
        story.append(self._info_table(cls_rows))
        story.append(Spacer(1, 10))

        # ─── 6. Investigation Notes ────────────────────────
        section_num += 1
        story.append(Paragraph(
            f'{section_num}. INVESTIGATION NOTES', self.styles['SOC_Heading']
        ))
        notes = alert.investigation_notes or alert.resolution_notes or 'No notes recorded.'
        story.append(Paragraph(notes.replace('\n', '<br/>'), self.styles['SOC_Body']))
        story.append(Spacer(1, 10))

        # ─── 7. Timeline ──────────────────────────────────
        section_num += 1
        story.append(Paragraph(
            f'{section_num}. EVENT TIMELINE', self.styles['SOC_Heading']
        ))
        timeline = [['Timestamp', 'Event']]
        timeline.append([
            alert.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'Alert created',
        ])
        if alert.acknowledged_at:
            timeline.append([
                alert.acknowledged_at.strftime('%Y-%m-%d %H:%M:%S'),
                f'Acknowledged by {alert.acknowledged_by.email if alert.acknowledged_by else "system"}',
            ])
        if alert.classified_at:
            timeline.append([
                alert.classified_at.strftime('%Y-%m-%d %H:%M:%S'),
                f'Classified as {classification_text} by {alert.classified_by.email if alert.classified_by else "system"}',
            ])
        if alert.owner_notified_at:
            timeline.append([
                alert.owner_notified_at.strftime('%Y-%m-%d %H:%M:%S'),
                'Website owner notified',
            ])
        if alert.resolved_at:
            timeline.append([
                alert.resolved_at.strftime('%Y-%m-%d %H:%M:%S'),
                'Alert resolved',
            ])

        tbl = Table(timeline, colWidths=[150, 330])
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, MED_GREY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 10))

        # ─── 8. Recommendations ───────────────────────────
        section_num += 1
        story.append(Paragraph(
            f'{section_num}. RECOMMENDATIONS', self.styles['SOC_Heading']
        ))
        if alert.classification == 'true_positive':
            recs = (
                '• Immediately notify the website owner and stakeholders.<br/>'
                '• Preserve forensic evidence (snapshots, logs).<br/>'
                '• Initiate incident response procedures.<br/>'
                '• Monitor for further malicious activity.<br/>'
                '• Update detection signatures if applicable.'
            )
        elif alert.classification == 'false_positive':
            recs = (
                '• Update baseline snapshot to reflect legitimate changes.<br/>'
                '• Review monitoring thresholds to reduce future false positives.<br/>'
                '• Document the root cause for team knowledge base.<br/>'
                '• No further action required.'
            )
        else:
            recs = (
                '• Complete classification before taking action.<br/>'
                '• Run AI prediction to assist decision-making.<br/>'
                '• Review analysis results and snapshots carefully.'
            )
        story.append(Paragraph(recs, self.styles['SOC_Body']))
        story.append(Spacer(1, 20))

        # ─── Footer ───────────────────────────────────────
        story.append(HRFlowable(
            width='100%', thickness=1, color=MED_GREY,
            spaceAfter=6, spaceBefore=10,
        ))
        story.append(Paragraph(
            f'Generated by Deface Spy — SOC Investigation Module — '
            f'{timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC")}',
            self.styles['SOC_Small'],
        ))

        return story

    # ── Helpers ─────────────────────────────────────────────────

    def _info_table(self, rows: list, small: bool = False) -> Table:
        """Render a list of [label, value] rows as a styled table."""
        fontsize = 8 if small else 9
        tbl = Table(rows, colWidths=[160, 320])
        tbl.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), fontsize),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (0, 0), (0, -1), MED_GREY),
            ('TEXTCOLOR', (1, 0), (1, -1), NAVY),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LINEBELOW', (0, 0), (-1, -1), 0.3, LIGHT_GREY),
        ]))
        return tbl
