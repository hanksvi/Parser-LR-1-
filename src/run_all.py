# run_all.py
from __future__ import annotations
import os
from pathlib import Path

from grammar_spec import Grammar
from first_sets import FirstSets
from lr1_items import build_canonical_collection
from parse_table import LR1ParseTable
from parser_driver import ParserDriver
from scanner import Scanner

# Visualización (usa Graphviz)
from viz_automata import build_lr1_items_afn, afn_to_png, afd_to_png

# Export de tabla (CSV/HTML)
from table_export import save_table_csv, save_table_html


# =========================
# Config de demo
# =========================
GRAMMAR_TEXT = r"""
# Puedes incluir Start: si quieres, o dejar que tome la 1ra producción
# Start: S
S -> A B
A -> 'a' | ε
B -> 'b'
"""

INPUT = "a b"  # prueba también "b"


def main():
    out_dir = Path("out")
    out_dir.mkdir(parents=True, exist_ok=True)

    print("[1] Construyendo gramática...")
    g = Grammar.from_text(GRAMMAR_TEXT)
    print(g, "\n")

    print("[2] FIRST sets...")
    fs = FirstSets.compute_first_sets(g)
    # (opcional) mostrar cuántos símbolos tienen FIRST calculado
    try:
        # si tu clase expone el mapa internamente:
        first_map_size = len(fs.first_map)  # type: ignore[attr-defined]
        print(f"  FIRST calculado para {first_map_size} símbolos\n")
    except Exception:
        print("  FIRST calculado.\n")

    print("[3] Colección canónica LR(1)...")
    aut = build_canonical_collection(g, fs)
    num_states = len(aut.states)
    num_edges = sum(len(v) for v in aut.transitions.values())
    print("  Estados:", num_states)
    print("  Transiciones:", num_edges, "\n")

    print("[3.b] Renderizando imágenes del autómata...")
    # AFD (colección canónica)
    afd_png_path = out_dir / "lr1_afd.png"
    afd_to_png(aut, str(out_dir / "lr1_afd"), show_items=True)
    print("  AFD (colección canónica) ->", afd_png_path.resolve())

    # AFN (ítems LR(1) con ε para clausura)
    items, edges = build_lr1_items_afn(g, fs)
    afn_png_path = out_dir / "lr1_afn.png"
    afn_to_png(items, edges, str(out_dir / "lr1_afn"))
    print("  AFN (ítems LR(1)) ->", afn_png_path.resolve(), "\n")

    print("[4] Tabla LR(1)...")
    table = LR1ParseTable.build_lr1_parse_table(g, aut)
    print(table, "\n")
    if not table.is_lr1():
        print("⚠️  La gramática NO es LR(1), hay conflictos arriba.\n")
    else:
        print("✅ Sin conflictos (LR(1)).\n")

    print("[4.b] Exportando tabla a CSV/HTML...")
    csv_path = out_dir / "lr1_table.csv"
    html_path = out_dir / "lr1_table.html"
    save_table_csv(table, str(csv_path))
    save_table_html(table, str(html_path), title="LR(1) Parse Table – Demo")
    print("  CSV  ->", csv_path.resolve())
    print("  HTML ->", html_path.resolve(), "\n")

    print("[5] Escaneando input...")
    scanner = Scanner(INPUT, g)
    toks = scanner.tokenize_all()
    print("  Tokens:", [(t.symbol, t.lexeme) for t in toks], "\n")

    print("[6] Parseando...")
    driver = ParserDriver(table)
    result = driver.parse(toks, max_steps=2000)
    print("  ACCEPTED:", result.accepted)
    if not result.accepted:
        print("  ERROR:", result.error_message)
    print("\n-- STEPS --")
    for st in result.steps[:50]:
        print(f"{st.step:02d} | states={st.stack_states} symbols={st.stack_symbols} "
              f"lookahead={st.lookahead} act={st.action_str} "
              f"reduced={st.reduced_prod} input='{st.input_window}'")
    if len(result.steps) > 50:
        print(f"... ({len(result.steps)-50} pasos más)")


if __name__ == "__main__":
    # Tips de ejecución:
    #   python3 -u run_all.py
    # -u = unbuffered (los prints salen al instante)
    main()
