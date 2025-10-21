import sys, json

from grammar_spec import Grammar
from first_sets import FirstSets
from lr1_items import build_canonical_collection
from parse_table import LR1ParseTable

# NUEVO: precedencia y análisis de ambigüedad
from precedence import PrecedenceConfig
from ambiguity_analyzer import analyze_conflicts
from precedence_preview import make_expression_preview  # ⬅️ PREVIEW


# utilidades de orden

def terminals_in_grammar_order(g: Grammar):
    """$ primero y luego terminales en orden de aparición en las producciones."""
    seen = set(["$"])
    order = ["$"]
    for p in g.productions:
        for sym in p.right:
            if sym in g.terminals and sym not in seen:
                seen.add(sym)
                order.append(sym)
    for t in g.terminals:
        if t not in seen:
            order.append(t)
    return order


def nonterminals_in_grammar_order(g: Grammar):
    seen = set([g.augmented_start])
    order = []
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


def _grammar_meta_to_json(grammar: Grammar):
    """Solo metadatos de gramática (sin estados/tabla). Útil cuando bloqueamos por conflictos."""
    terms = sorted(list(grammar.terminals | {"$"}))
    nonterms = sorted([A for A in grammar.nonterminals if A != grammar.augmented_start])
    productions = []
    for i, p in enumerate(grammar.productions):
        rhs = " ".join(p.right) if p.right else "ε"
        productions.append(f"{i}: {p.left} -> {rhs}")
    return {
        "terminals": terms,
        "non_terminals": nonterms,
        "productions": productions,
        "states": []  # intencionalmente vacío
    }


def _table_to_json(grammar: Grammar, table, automaton):
    terminals = terminals_in_grammar_order(grammar)
    non_terminals = nonterminals_in_grammar_order(grammar)
    productions = []
    for i, p in enumerate(grammar.productions):
        rhs = " ".join(p.right) if p.right else "ε"
        productions.append(f"{i}: {p.left} -> {rhs}")

    states_sorted = sorted(automaton.states, key=lambda st: st.id)

    states_json = []
    for st in states_sorted:
        items_sorted = sorted(
            st.items,
            key=lambda x: (x.left, " ".join(x.alpha), " ".join(x.beta), x.lookahead),
        )
        row = {
            "state": st.id,
            "items": [str(it) for it in items_sorted],
        }

        arow = table.action.get(st.id, {})
        for t in terminals:
            act = arow.get(t)
            if act:
                row[t] = str(act)

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


# NUEVO: sugerencia de precedencia en base a los terminales disponibles
def _suggest_precedence(grammar: Grammar):
    ops = ["+", "-", "*", "/", "%", "^"]
    have = [op for op in ops if op in grammar.terminals]
    levels = []

    # nivel típico 0: +,-
    lvl0 = [op for op in ["+", "-"] if op in have]
    if lvl0:
        levels.append({"assoc": "left", "tokens": lvl0})

    # nivel típico 1: *,/,%
    lvl1 = [op for op in ["*", "/", "%"] if op in have]
    if lvl1:
        levels.append({"assoc": "left", "tokens": lvl1})

    # nivel típico 2: ^ (derecha)
    if "^" in have:
        levels.append({"assoc": "right", "tokens": ["^"]})

    return levels


def _normalize_arrows(txt: str) -> str:
    return (txt or "").replace("⇒", "->").replace("→", "->").replace("—>", "->").replace("–>", "->")


def cmd_build(payload):
    # normaliza flechas unicode en el backend por robustez
    grammar_text = _normalize_arrows(payload.get("grammar") or "")
    precedence_levels = payload.get("precedence")  # lista opcional de niveles

    g = Grammar.from_text(grammar_text)
    first = FirstSets.compute_first_sets(g)
    automaton = build_canonical_collection(g, first)

    prec_cfg = PrecedenceConfig.from_payload(g, precedence_levels or [])

    # la tabla acepta precedencia para resolver shift/reduce
    table = LR1ParseTable.build_lr1_parse_table(g, automaton, precedence=prec_cfg)

    # análisis de conflictos / hints
    ambi = analyze_conflicts(g, table)

    # PREVIEW desambiguada (sólo informativa)
    preview = make_expression_preview(g, prec_cfg)

    # Si hay conflictos, BLOQUEAMOS la tabla y devolvemos opciones
    if ambi["has_conflicts"]:
        return {
            "success": True,
            "blocked": True,
            "message": "Se detectaron conflictos LR(1). Aplica una estrategia de desambiguación y vuelve a construir.",
            "table_data": _grammar_meta_to_json(g),  # solo metadatos (sin estados)
            "ambiguity": {
                "is_lr1": False,
                "has_conflicts": True,
                "conflicts": ambi["conflicts"],
                "hints": ambi["hints"],
                "resolved_with_precedence": False
            },
            "suggested_precedence": _suggest_precedence(g),  # presets calculados
            "desugared_preview": preview
        }

    # Sin conflictos → devolvemos tabla completa
    base = _table_to_json(g, table, automaton)
    base["ambiguity"] = {
        "is_lr1": True,
        "has_conflicts": False,
        "conflicts": [],
        "hints": [],
        "resolved_with_precedence": bool(precedence_levels)
    }
    base["blocked"] = False
    base["desugared_preview"] = preview
    return base


def cmd_parse(payload):
    # Reconstruimos la tabla para el parse con la MISMA precedencia (si se envía)
    grammar_text = _normalize_arrows(payload.get("grammar") or "")
    input_text   = payload.get("input", "")
    precedence_levels = payload.get("precedence") or []

    g = Grammar.from_text(grammar_text)
    first = FirstSets.compute_first_sets(g)
    automaton = build_canonical_collection(g, first)
    prec_cfg = PrecedenceConfig.from_payload(g, precedence_levels)
    table = LR1ParseTable.build_lr1_parse_table(g, automaton, precedence=prec_cfg)

    # Scanner + driver tal cual
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
