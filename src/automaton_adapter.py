# automaton_adapter.py
from __future__ import annotations
import sys, json
from typing import Dict, List, Tuple, Set

from grammar_spec import Grammar
from first_sets import FirstSets
from lr1_items import LR1Item, build_canonical_collection

EPS = "ε"


def _grammar_text_from_productions(prods: List[Dict]) -> str:
    """Convierte una lista de {left, right[]} en el texto de gramática esperado por Grammar.from_text."""
    if not prods:
        return ""
    lines: List[str] = []

    # Tomamos el primer 'left' como Start si no viene 'Start:' explícito
    start = (prods[0].get("left") or "").strip()
    if start:
        lines.append(f"Start: {start}")

    for p in prods:
        left = (p.get("left") or "").strip()
        right_syms = p.get("right") or []
        # asegurar que sea lista de str
        right = " ".join(str(s) for s in right_syms)
        lines.append(f"{left} -> {right}")

    return "\n".join(lines)


def _build_grammar_and_first(grammar_text: str):
    """Construye Grammar y FirstSets desde texto."""
    g = Grammar.from_text(grammar_text)
    fs = FirstSets.compute_first_sets(g)
    return g, fs


def _closure_afn(seed: List[LR1Item], g: Grammar, fs: FirstSets):

    items: List[LR1Item] = []
    idx: Dict[LR1Item, int] = {}
    edges: Dict[int, List[Tuple[str, int]]] = {}

    def get_id(it: LR1Item) -> int:
        if it not in idx:
            idx[it] = len(items)
            items.append(it)
        return idx[it]

    from collections import deque
    q = deque()
    seen: Set[LR1Item] = set()

    for it in seed:
        get_id(it)
        q.append(it)

    while q:
        it = q.popleft()
        if it in seen:
            continue
        seen.add(it)

        u = idx[it]
        edges.setdefault(u, [])

        X = it.next_symbol()
        if X is None:

            continue


        nxt = it.advance_dot()
        v = get_id(nxt)
        edges[u].append((X, v))
        if nxt not in seen:
            q.append(nxt)

        if g.is_nonterminal(X):
            gamma = it.beta[1:]
            la_set = fs.first_of_sequence(list(gamma) + [it.lookahead])
            for p in g.productions_of(X):
                delta = p.right
                for b in la_set:
                    if b == EPS:
                        continue
                    new_item = LR1Item(X, tuple(), tuple(delta), b)
                    w = get_id(new_item)
                    edges[u].append((EPS, w))
                    if new_item not in seen:
                        q.append(new_item)

    return items, edges


def _lr1_items_afn_to_visual(items: List[LR1Item], edges: Dict[int, List[Tuple[str, int]]]) -> Dict:

    states: Dict[str, Dict] = {}
    for i, it in enumerate(items):
        nid = f"N{i}"
        states[nid] = {
            "name": nid,
            "is_final": (len(it.beta) == 0 and it.lookahead == "$"),
            "shape": "oval",
            "label": str(it),
            "transitions": {}
        }

    for u, outs in edges.items():
        su = f"N{u}"
        for lab, v in outs:
            sv = f"N{v}"
            states[su]["transitions"].setdefault(lab, []).append(sv)

    alphabet = sorted({lab for lst in edges.values() for lab, _ in lst}) if edges else []
    return {"states": states, "start_state": "N0", "alphabet": alphabet}


def _is_accept_state(items, augmented_start: str) -> bool:
    for it in items:
        if it.left == augmented_start and len(it.beta) == 0 and it.lookahead == "$":
            return True
    return False


def _lr1_dfa_to_visual(g: Grammar, automaton) -> Dict:

    states: Dict[str, Dict] = {}

    def _item_sort_key(x: LR1Item):
        return (x.left, " ".join(x.alpha), " ".join(x.beta), x.lookahead)

    for st in automaton.states:
        sid = f"I{st.id}"
        label = "\\n".join(str(it) for it in sorted(st.items, key=_item_sort_key))
        states[sid] = {
            "name": sid,
            "is_final": _is_accept_state(st.items, g.augmented_start or ""),
            "shape": "rect",
            "label": label,
            "transitions": {}
        }

    for src, outs in automaton.transitions.items():
        s = f"I{src}"
        for sym, dst in outs.items():
            t = f"I{dst}"
            states[s]["transitions"].setdefault(sym, []).append(t)

    alphabet = sorted(list(g.terminals | g.nonterminals))
    return {"states": states, "start_state": "I0", "alphabet": alphabet}



def cmd_build_both(payload: Dict) -> Dict:

    grammar_text = (payload.get("grammar") or "").strip()
    if not grammar_text:
        prods = payload.get("productions") or []
        if isinstance(prods, list) and prods and isinstance(prods[0], dict):
            grammar_text = _grammar_text_from_productions(prods)

    if not grammar_text:
        return {"success": False, "error": "No se recibió gramática ni producciones."}

    try:
        g, fs = _build_grammar_and_first(grammar_text)

        start_item = LR1Item(g.augmented_start, tuple(), (g.start_symbol,), "$")
        items, edges = _closure_afn([start_item], g, fs)
        nfa = _lr1_items_afn_to_visual(items, edges)

        dfa_struct = build_canonical_collection(g, fs)
        dfa = _lr1_dfa_to_visual(g, dfa_struct)

        return {"success": True, "nfa": nfa, "dfa": dfa}
    except Exception as e:
        return {"success": False, "error": f"Fallo construyendo AFN/DFA: {e}"}


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