# ambiguity_analyzer.py
from __future__ import annotations
from typing import List, Dict, Any
from parse_table import LR1ParseTable, ActionKind, Conflict
from grammar_spec import Grammar

def analyze_conflicts(grammar: Grammar, table: LR1ParseTable) -> Dict[str, Any]:
    hints: List[str] = []
    cfgs: List[str] = [str(c) for c in table.conflicts]

    # patrones simples:
    # 1) Expresiones aritméticas (tokens + - * / ^ ...)
    expr_ops = {"+", "-", "*", "/", "%", "^"}
    grammar_ops = grammar.terminals & expr_ops
    if grammar_ops and any("shift/reduce" in c for c in cfgs):
        hints.append(
            "Conflictos tipo expresiones: define precedencia y asociatividad para operadores "
            f"{sorted(grammar_ops)} (ej.: left ['+','-'], left ['*','/'], right ['^'])."
        )

    # 2) Dangling else (if/else)
    if ("if" in grammar.terminals and "else" in grammar.terminals and 
        any("shift/reduce" in c for c in cfgs)):
        hints.append(
            "Posible 'dangling else': haz que 'else' se asocie al 'if' más cercano mediante precedencia "
            "o separa producciones IF_WITH_ELSE / IF_NO_ELSE."
        )

    # 3) ε-producciones con solape FIRST/FOLLOW
    if any("→ ε" in h or "→ε" in h for h in cfgs):
        hints.append(
            "Hay reducciones con ε: revisa FIRST/FOLLOW para evitar solapes (left factoring o introducir símbolos auxiliares)."
        )

    # 4) Listas separadas por comas
    if ("," in grammar.terminals) and any("shift/reduce" in c for c in cfgs):
        hints.append(
            "Listas separadas por comas: usa forma canónica LEFT-RECURSIVE (Lista → Lista ',' Elem | Elem) "
            "o RIGHT-RECURSIVE, evitando ε alternativo ambiguo."
        )

    # Fallback genérico
    if not hints and table.conflicts:
        hints.append("Conflictos LR(1) detectados: intenta left factoring, eliminar recursión a izquierda inmediata, "
                     "o añade precedencia/asociatividad.")

    return {
        "has_conflicts": bool(table.conflicts),
        "conflicts": cfgs,
        "hints": hints
    }
