#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys, json
from typing import Dict, List, Tuple, Optional

# Importa tus módulos reales
from grammar_spec import Grammar
from first_sets import FirstSets
from lr1_items import build_canonical_collection, LR1Item

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

def _grammar_text_from_productions(prods: List[Dict]) -> str:
    """
    Acepta [{left:"A", right:["a","B"]}, ...] y arma texto:
      A -> a B
      B -> ...
    Usa como símbolo inicial el primer LHS.
    """
    if not prods:
        return ""
    lines = []
    start = prods[0].get("left", "").strip()
    if start:
        # opcional; Grammar.from_text toma el primero como start si no se pone
        lines.append(f"Start: {start}")
    for p in prods:
        left = (p.get("left") or "").strip()
        right = " ".join((p.get("right") or []))
        lines.append(f"{left} -> {right}")
    return "\n".join(lines)

def _build_lr1_automaton(grammar_text: str):
    """
    Compila gramática, calcula FIRST, construye colección canónica LR(1).
    """
    g = Grammar.from_text(grammar_text)
    fs = FirstSets.compute_first_sets(g)
    automaton = build_canonical_collection(g, fs)
    return g, automaton

def _is_accepting_state(items, augmented_start: str) -> bool:
    """
    Un estado es de aceptación si contiene el ítem:
        S' → S · , $
    """
    for it in items:
        # it: LR1Item(left, alpha, beta, lookahead)
        if it.left == augmented_start and len(it.beta) == 0 and it.lookahead == "$":
            return True
    return False

def _lr1_to_visual_automata(grammar: Grammar, automaton) -> Dict:
    """
    Convierte la estructura del automata LR(1) a JSON para el canvas:
      {
        "states": { "I0": {"name":"I0","is_final":bool,"transitions":{"X":["I1"]}} , ...},
        "start_state": "I0",
        "alphabet": [... símbolos (terminales y no terminales) ...]
      }
    """
    states: Dict[str, Dict] = {}
    # alfabeto: todos los símbolos que pueden rotular transiciones
    alphabet = sorted(list(grammar.terminals | grammar.nonterminals))

    for st in automaton.states:
        sid = f"I{st.id}"
        states[sid] = {
            "name": sid,
            "is_final": _is_accepting_state(st.items, grammar.augmented_start or ""),
            # transitions: símbolo → [destinos]
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

# ------------------------------------------------------------
# Command
# ------------------------------------------------------------

def cmd_build_both(payload: Dict) -> Dict:
    """
    Entrada esperada desde el frontend (acepta dos formatos):
      A) {"grammar": "S -> ..."}
      B) {"productions": [{"left":"S","right":["A","+","B"]}, ...]}
    Devuelve:
      { success, nfa, dfa }
    """
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

        # El autómata de ítems LR(1) es determinista → podemos usarlo
        # tanto como "NFA" (misma estructura) y "DFA".
        nfa = vis
        dfa = vis

        return {"success": True, "nfa": nfa, "dfa": dfa}
    except Exception as e:
        return {"success": False, "error": f"Fallo construyendo AFN/DFA desde gramática: {e}"}

# ------------------------------------------------------------
# CLI
# ------------------------------------------------------------

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
