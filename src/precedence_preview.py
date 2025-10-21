# precedence_preview.py
from __future__ import annotations
from typing import List, Optional, Set
from grammar_spec import Grammar, Production
from precedence import PrecedenceConfig

"""
Genera una PREVIEW de gramática desambiguada para el caso clásico de expresiones
binarias con paréntesis e identificadores. No reescribe todo el lenguaje; sólo
muestra una gramática equivalente para encadenamiento de operadores según la
precedencia/asociatividad dada.
"""

def _guess_expr_symbol(g: Grammar, prec: PrecedenceConfig) -> Optional[str]:
    # Heurística: toma el start si tiene producciones con operadores tokenizados en precedence
    toks: Set[str] = set(prec.tok_prec.keys())
    cand = g.start_symbol
    if cand:
        prods = list(g.productions_of(cand))
        if any(any(sym in toks for sym in p.right) for p in prods):
            return cand
    # si no, busca el primer NT que use alguno de los operadores
    for A in g.nonterminals:
        if A == g.augmented_start:
            continue
        prods = list(g.productions_of(A))
        if any(any(sym in toks for sym in p.right) for p in prods):
            return A
    return None


def make_expression_preview(g: Grammar, prec: PrecedenceConfig) -> Optional[str]:
    if not prec.levels:
        return None

    E = _guess_expr_symbol(g, prec)
    if not E:
        return None

    # Detecta "primarios" simples del original para el último nivel:
    primaries: List[str] = []
    # Paréntesis:
    for p in g.productions_of(E):
        r = list(p.right)
        if len(r) == 3 and r[0] in g.terminals and r[1] == E and r[2] in g.terminals:
            # e.g. '(' E ')'
            primaries.append(f"'{r[0]}' {E} '{r[2]}'")
    # id / num / literals que no son operadores
    op_tokens = set(prec.tok_prec.keys())
    for p in g.productions_of(E):
        r = list(p.right)
        if len(r) == 1 and r[0] in g.terminals and r[0] not in op_tokens:
            primaries.append(rf"'{r[0]}'")

    if not primaries:
        # fallback genérico
        primaries = [E]

    # Construye niveles: L0 (más bajo) ... L{n} (más alto) -> Primary
    lines: List[str] = []
    lines.append(f"# Vista previa (no ejecutable): gramática desambiguada por precedencia para {E}")
    levels = prec.levels

    # nombres de niveles
    names = [f"{E}{i}" for i in range(len(levels) + 1)]
    # último nivel (más alto) = primarios
    lines.append(f"{names[-1]} -> " + " | ".join(primaries))

    # recorre de mayor a menor índice para armar Li según asociatividad
    # niveles en PrecedenceConfig vienen de menor a mayor precedencia
    for i in range(len(levels) - 1, -1, -1):
        lvl = levels[i]
        left = names[i]
        right = names[i + 1]
        toks = [f"'{t}'" for t in lvl.tokens if t in prec.tok_prec]  # sólo tokens válidos
        if not toks:
            # si un nivel está vacío, colapsa
            lines.append(f"{left} -> {right}")
            continue

        if lvl.assoc == "left":
            # Li -> Li op_i L_{i+1} | L_{i+1}
            alts = [f"{left} {tok} {right}" for tok in toks]
            alts.append(right)
            lines.append(f"{left} -> " + " | ".join(alts))
        elif lvl.assoc == "right":
            # Li -> L_{i+1} op_i Li | L_{i+1}
            alts = [f"{right} {tok} {left}" for tok in toks]
            alts.append(right)
            lines.append(f"{left} -> " + " | ".join(alts))
        else:
            # nonassoc: no permite encadenar: Li -> L_{i+1} | L_{i+1} op_i L_{i+1}
            alts = [right] + [f"{right} {tok} {right}" for tok in toks]
            lines.append(f"{left} -> " + " | ".join(alts))

    # símbolo inicial igual que el original, pero apuntando al nivel 0 si coincide
    if E == g.start_symbol:
        lines.insert(0, f"Start: {E}")
    return "\n".join(lines)
