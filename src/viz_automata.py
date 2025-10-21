import sys, json
from typing import Dict, List, Tuple, Optional


from grammar_spec import Grammar
from first_sets import FirstSets
from lr1_items import build_canonical_collection, LR1Item


def _grammar_text_from_productions(prods: List[Dict]) -> str:
    if not prods:
        return ""
    lines = []
    start = prods[0].get("left", "").strip()
    if start:
        lines.append(f"Start: {start}")
    for p in prods:
        left = (p.get("left") or "").strip()
        right = " ".join((p.get("right") or []))
        lines.append(f"{left} -> {right}")
    return "\n".join(lines)

def _build_lr1_automaton(grammar_text: str):
    g = Grammar.from_text(grammar_text)
    fs = FirstSets.compute_first_sets(g)
    automaton = build_canonical_collection(g, fs)
    return g, automaton

def _is_accepting_state(items, augmented_start: str) -> bool:
    for it in items:
        if it.left == augmented_start and len(it.beta) == 0 and it.lookahead == "$":
            return True
    return False

def _lr1_to_visual_automata(grammar: Grammar, automaton) -> Dict:
    states: Dict[str, Dict] = {}
    alphabet = sorted(list(grammar.terminals | grammar.nonterminals))

    for st in automaton.states:
        sid = f"I{st.id}"
        states[sid] = {
            "name": sid,
            "is_final": _is_accepting_state(st.items, grammar.augmented_start or ""),
            "transitions": {}
        }

    for src, edges in automaton.transitions.items():
        src_id = f"I{src}"
        for sym, dst in edges.items():
            dst_id = f"I{dst}"
            states[src_id]["transitions"].setdefault(sym, []).append(dst_id)

    return {
        "states": states,
        "start_state": "I0",
        "alphabet": alphabet
    }


def cmd_build_both(payload: Dict) -> Dict:
    grammar_text = (payload.get("grammar") or "").strip()
    if not grammar_text:
        prods = payload.get("productions") or []
        if isinstance(prods, list) and prods and isinstance(prods[0], dict):
            grammar_text = _grammar_text_from_productions(prods)

    if not grammar_text.strip():
        return {"success": False, "error": "No se recibió gramática ni producciones."}

    try:
        g, lr1_automaton = _build_lr1_automaton(grammar_text)
        vis = _lr1_to_visual_automata(g, lr1_automaton)

        nfa = vis
        dfa = vis

        return {"success": True, "nfa": nfa, "dfa": dfa}
    except Exception as e:
        return {"success": False, "error": f"Fallo construyendo AFN/DFA desde gramática: {e}"}


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Uso: automaton_adapter.py build_both <json>"}))
        return

    cmd = sys.argv[1]
    try:
        payload = json.loads(sys.argv[2])
    except Exception as e:
        print(json.dumps({"success": False, "error": f"JSON inválido: {e}"}))
        return

    if cmd == "build_both":
        print(json.dumps(cmd_build_both(payload)))
    else:
        print(json.dumps({"success": False, "error": f"Comando desconocido: {cmd}"}))

if __name__ == "__main__":
    main()
