from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

GREEN = colors.HexColor("#0B7A55")
GREY = colors.HexColor("#9CA3AF")
PALETTE = [GREEN, colors.HexColor("#2563EB"), colors.HexColor("#F59E0B"), colors.HexColor("#DC2626"),
           colors.HexColor("#7C3AED"), colors.HexColor("#0891B2"), colors.HexColor("#65A30D"),
           colors.HexColor("#DB2777")]
STYLES = getSampleStyleSheet()
SMALL = ParagraphStyle("small", parent=STYLES["Normal"], fontSize=7, leading=9)


def _n(x, nd=2):
    return "-" if x is None else f"{x:,.{nd}f}"


def _table(rows, widths=None):
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5), ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
    ]))
    return t


def _section(title, header, rows, widths, empty_msg):
    out = [Spacer(1, 10), Paragraph(title, STYLES["Heading2"])]
    out.append(_table([header] + rows, widths) if rows else Paragraph(empty_msg, STYLES["Normal"]))
    return out


def _pie(allocation):
    d = Drawing(500, 190)
    pie = Pie()
    pie.x, pie.y, pie.width, pie.height = 170, 25, 140, 140
    pie.data = [a["value"] for a in allocation]
    pie.labels = [f"{a['label'][:18]} {a['weight_pct']:.1f}%" for a in allocation]
    pie.sideLabels = 1
    pie.slices.fontSize = 7
    for i in range(len(allocation)):
        pie.slices[i].fillColor = PALETTE[i % len(PALETTE)]
    d.add(pie)
    return d


def _bar(holdings):
    rows = [h for h in holdings if h["market_value"] is not None]
    if not rows:
        return None
    d = Drawing(500, 190)
    bc = VerticalBarChart()
    bc.x, bc.y, bc.width, bc.height = 50, 30, 420, 130
    bc.data = [[h["cost"] for h in rows], [h["market_value"] for h in rows]]
    bc.categoryAxis.categoryNames = [h["security_id"] for h in rows]
    bc.categoryAxis.labels.fontSize = 7
    bc.valueAxis.labels.fontSize = 7
    bc.valueAxis.valueMin = 0
    bc.bars[0].fillColor, bc.bars[1].fillColor = GREY, GREEN
    d.add(bc)
    return d


def build_pdf(data: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=30, rightMargin=30, topMargin=30,
                            bottomMargin=30, title=f"Portfolio report {data['portfolio_id']}")
    t = data["totals"]
    story = [
        Paragraph(f"Portfolio Report: {escape(data['portfolio_name'])} ({data['portfolio_id']})", STYLES["Title"]),
        Paragraph(f"Generated on {data['generated_on']}", STYLES["Normal"]), Spacer(1, 8),
        Paragraph("Summary", STYLES["Heading2"]), Paragraph(escape(data["summary"]), STYLES["Normal"]),
        Spacer(1, 8),
        _table([["Cost", "Market value", "Cash", "Total value", "Unrealised P&L"],
                [_n(t["cost"]), _n(t["market_value"]), _n(t["cash"]), _n(t["total_value"]), _n(t["pnl"])]]),
    ]

    story += _section(
        "Holdings", ["Security", "Name", "Qty", "Avg cost", "Price", "Cost", "Market value", "P&L"],
        [[h["security_id"], escape(str(h["name"])), _n(h["quantity"], 0), _n(h["avg_cost"]), _n(h["price"]),
          _n(h["cost"]), _n(h["market_value"]), _n(h["pnl"])] for h in data["holdings"]],
        [50, 125, 45, 50, 50, 60, 65, 50], "No holdings.")

    if data["allocation"]:
        story += [Spacer(1, 10), Paragraph("Allocation", STYLES["Heading2"]), _pie(data["allocation"])]
    bar = _bar(data["holdings"])
    if bar:
        story += [Paragraph("Cost vs market value (grey = cost, green = market value)", STYLES["Heading2"]), bar]

    story += _section(
        "Past corporate actions",
        ["Date", "Action", "Type", "Security", "Qty before > after", "Cash", "Rule applied"],
        [[p["date"], p["action_id"], p["action_type"], p["security_id"],
          f"{_n(p['qty_before'], 0)} > {_n(p['qty_after'], 0)}", _n(p["cash_movement"]),
          Paragraph(escape(p["rule_applied"] or ""), SMALL)] for p in data["past_actions"]],
        [55, 45, 70, 45, 85, 50, 185], "No processed corporate actions.")

    story += _section(
        "Upcoming corporate actions",
        ["Action", "Type", "Security", "Record date", "Pay date", "Est. cash", "Est. qty change"],
        [[f["action_id"], f["action_type"], f["security_id"], f["record_date"] or "-",
          f["payment_date"] or "-", _n(f["est_cash"]), _n(f["est_qty_change"], 0)]
         for f in data["future_actions"]],
        [50, 90, 55, 70, 70, 65, 80], "No upcoming corporate actions.")

    doc.build(story)
    return buf.getvalue()