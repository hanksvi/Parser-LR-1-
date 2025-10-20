# ============================================================
# table_export.py
# Exporta la tabla LR(1) (ACTION/GOTO) a HTML y CSV.
# ============================================================

from __future__ import annotations
from typing import List
import csv

from parse_table import LR1ParseTable, Action

def save_table_csv(table: LR1ParseTable, csv_path: str) -> None:
    terminals = list(table.terminals)
    nonterminals = list(table.nonterminals)

    states = sorted(set(table.action.keys()) | set(table.goto.keys()))
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        # encabezado
        w.writerow(["STATE"] + terminals + ["|"] + nonterminals)
        for s in states:
            row = [f"I{s}"]
            # ACTION
            arow = table.action.get(s, {})
            for t in terminals:
                val = arow.get(t)
                row.append(str(val) if val else "")
            row.append("|")
            # GOTO
            grow = table.goto.get(s, {})
            for A in nonterminals:
                val = grow.get(A)
                row.append(str(val) if val is not None else "")
            w.writerow(row)

def save_table_html(table: LR1ParseTable, html_path: str, title: str = "LR(1) Parse Table") -> None:
    terminals = list(table.terminals)
    nonterminals = list(table.nonterminals)
    states = sorted(set(table.action.keys()) | set(table.goto.keys()))

    def cell_action(s, t):
        a = table.action.get(s, {}).get(t)
        return str(a) if a else ""

    def cell_goto(s, A):
        v = table.goto.get(s, {}).get(A)
        return str(v) if v is not None else ""

    html = []
    html.append(f"<!doctype html><html><head><meta charset='utf-8'><title>{title}</title>")
    html.append("""<style>
    body{font-family:system-ui,Segoe UI,Arial,sans-serif;padding:16px;}
    table{border-collapse:collapse;font-size:14px}
    th,td{border:1px solid #ccc;padding:6px 10px;text-align:center}
    thead th{background:#f3f3f3}
    .sep{background:#fafafa}
    .ok{color:#0a0}
    .warn{color:#a60}
    .bad{color:#a00}
    </style></head><body>""")
    html.append(f"<h2>{title}</h2>")
    if table.conflicts:
        html.append(f"<p class='bad'><strong>Conflictos detectados:</strong></p><ul>")
        for c in table.conflicts:
            html.append(f"<li>{c}</li>")
        html.append("</ul>")
    else:
        html.append(f"<p class='ok'><strong>Sin conflictos (LR(1)).</strong></p>")

    # Tabla
    html.append("<table>")
    # header
    html.append("<thead><tr><th>STATE</th>")
    for t in terminals:
        html.append(f"<th>{t}</th>")
    html.append("<th class='sep'>|</th>")
    for A in nonterminals:
        html.append(f"<th>{A}</th>")
    html.append("</tr></thead>")

    html.append("<tbody>")
    for s in states:
        html.append(f"<tr><td><strong>I{s}</strong></td>")
        for t in terminals:
            html.append(f"<td>{cell_action(s,t)}</td>")
        html.append("<td class='sep'>|</td>")
        for A in nonterminals:
            html.append(f"<td>{cell_goto(s,A)}</td>")
        html.append("</tr>")
    html.append("</tbody></table>")
    html.append("</body></html>")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write("\n".join(html))
