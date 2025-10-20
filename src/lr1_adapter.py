#!/usr/bin/env python3
import sys, json

from grammar_spec import Grammar
from first_sets import FirstSets
from lr1_items import build_canonical_collection
from parse_table import LR1ParseTable

# ========= utilidades de orden =========

def terminals_in_grammar_order(g: Grammar):
    """$ primero y luego terminales en orden de aparición en las producciones."""
    seen = set(["$"])
    order = ["$"]
    # aparición en RHS
    for p in g.productions:
        for sym in p.right:
            if sym in g.terminals and sym not in seen:
                seen.add(sym)
                order.append(sym)
    # si queda alguno afuera, apéndalo de forma estable
    for t in g.terminals:
        if t not in seen:
            order.append(t)
    return order

def nonterminals_in_grammar_order(g: Grammar):
    """No terminales en orden de aparición en LHS/RHS, excluyendo el aumentado."""
    seen = set([g.augmented_start])
    order = []
    # primero, LHS
    for p in g.productions:
        A = p.left
        if A not in seen:
            seen.add(A)
            order.append(A)
    # si hay NT que nunca fueron LHS (raro), agrégalos
    for A in g.nonterminals:
        if A not in seen:
            order.append(A)
    # excluir el aumentado por si acaso
    return [A for A in order if A != g.augmented_start]

# ========= adaptación a JSON =========

def _table_to_json(grammar: Grammar, table: LR1ParseTable, automaton):
    # columnas: orden estable según la gramática
    terminals = terminals_in_grammar_order(grammar)
    non_terminals = nonterminals_in_grammar_order(grammar)

    # producciones en el orden de la gramática (0 será la aumentada)
    productions = []
    for i, p in enumerate(grammar.productions):
        rhs = " ".join(p.right) if p.right else "ε"
        productions.append(f"{i}: {p.left} -> {rhs}")

    # filas/estados (ordenadas por id)
    states_sorted = sorted(automaton.states, key=lambda st: st.id)

    states_json = []
    for st in states_sorted:
        # Ítems con orden estable (por legibilidad)
        items_sorted = sorted(
            st.items,
            key=lambda x: (x.left, " ".join(x.alpha), " ".join(x.beta), x.lookahead),
        )
        row = {
            "state": st.id,
            "items": [str(it) for it in items_sorted],
        }

        # ACTION: sK / r[A→…] / acc
        arow = table.action.get(st.id, {})
        for t in terminals:
            act = arow.get(t)
            if act:
                row[t] = str(act)

        # GOTO: solo número
        grow = table.goto.get(st.id, {})
        for A in non_terminals:
            gdst = grow.get(A)
            if gdst is not None:
                row[A] = gdst

        states_json.append(row)

    return {
        "success": True,
        "table_data": {
            "terminals": terminals,
            "non_terminals": non_terminals,
            "productions": productions,
            "states": states_json,
        },
    }

def cmd_build(payload):
    grammar_text = payload.get("grammar", "")
    g = Grammar.from_text(grammar_text)
    first = FirstSets.compute_first_sets(g)
    automaton = build_canonical_collection(g, first)
    table = LR1ParseTable.build_lr1_parse_table(g, automaton)
    return _table_to_json(g, table, automaton)

def cmd_parse(payload):
    grammar_text = payload.get("grammar", "")
    input_text   = payload.get("input", "")
    g = Grammar.from_text(grammar_text)
    first = FirstSets.compute_first_sets(g)
    automaton = build_canonical_collection(g, first)
    table = LR1ParseTable.build_lr1_parse_table(g, automaton)

    # Scanner + driver tal cual (no cambia nada para la tabla)
    from parser_driver import ParserDriver, Scanner
    scanner = Scanner(input_text, g)
    tokens = scanner.tokenize_all()
    driver = ParserDriver(table)
    res = driver.parse(tokens)

    steps = []
    for s in res.steps:
        steps.append({
            "step": s.step,
            "stack": s.stack_states,
            "symbols": s.stack_symbols,
            "input": s.input_window.split() if s.input_window else [],
            "action": s.action_str,
        })

    out = {"success": res.accepted, "steps": steps}
    if not res.accepted:
        out["error"] = res.error_message or "Cadena rechazada"
    else:
        out["message"] = "Cadena aceptada"
    return out

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Uso: lr1_adapter.py <build|parse> <json>"}))
        return
    cmd = sys.argv[1]
    try:
        payload = json.loads(sys.argv[2])
    except Exception as e:
        print(json.dumps({"success": False, "error": f"JSON inválido: {e}"})); return

    if cmd == "build":
        print(json.dumps(cmd_build(payload)))
    elif cmd == "parse":
        print(json.dumps(cmd_parse(payload)))
    else:
        print(json.dumps({"success": False, "error": f"Comando desconocido: {cmd}"}))

if __name__ == "__main__":
    main()
