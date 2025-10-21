# precedence.py
from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional, Set
from grammar_spec import Production

@dataclass(frozen=True)
class PrecLevel:
    assoc: str               # 'left' | 'right' | 'nonassoc'
    tokens: Tuple[str, ...]  # p.ej. ('+', '-')

@dataclass
class PrecedenceConfig:
    # niveles de menor a mayor (como Yacc/Bison)
    levels: List[PrecLevel]
    # precedencia por token
    tok_prec: Dict[str, int]         # token -> nivel (0..N-1)
    tok_assoc: Dict[str, str]        # token -> 'left'/'right'/'nonassoc'
    # precedencia por producción (calculada del RHS)
    prod_prec: Dict[Production, int] # prod -> nivel

    @staticmethod
    def from_payload(grammar, payload_levels) -> "PrecedenceConfig":
        # payload_levels = [{"assoc":"left","tokens":["+","-"]}, {"assoc":"left","tokens":["*","/"]}, ...]
        levels: List[PrecLevel] = []
        tok_prec: Dict[str,int] = {}
        tok_assoc: Dict[str,str] = {}
        for i, lvl in enumerate(payload_levels or []):
            assoc = (lvl.get("assoc") or "left").lower()
            toks  = tuple(lvl.get("tokens") or [])
            levels.append(PrecLevel(assoc=assoc, tokens=toks))
            for t in toks:
                tok_prec[t] = i
                tok_assoc[t]= assoc

        # Regla práctica: precedencia de una producción = mayor precedencia
        # del último terminal en su RHS (estilo Yacc). Si no hay terminales, sin precedencia.
        prod_prec: Dict[Production,int] = {}
        terminals = grammar.terminals
        for p in grammar.productions:
            prec = None
            for sym in reversed(p.right):
                if sym in terminals and sym in tok_prec:
                    prec = tok_prec[sym]
                    break
            if prec is not None:
                prod_prec[p] = prec

        return PrecedenceConfig(levels=levels, tok_prec=tok_prec, tok_assoc=tok_assoc, prod_prec=prod_prec)

    def compare(self, token: str, production: Production) -> Optional[int]:
        """Devuelve: +1 => SHIFT gana; -1 => REDUCE gana; None => indeterminado (no se resuelve)."""
        tp = self.tok_prec.get(token)
        pp = self.prod_prec.get(production)
        if tp is None and pp is None:
            return None
        if tp is None:
            return -1
        if pp is None:
            return +1
        if tp > pp:
            return +1
        if tp < pp:
            return -1
        # empate: usar asociatividad
        assoc = self.tok_assoc.get(token, "left")
        if assoc == "left":
            return -1     # reduce en empate (izq)
        if assoc == "right":
            return +1     # shift en empate (der)
        # nonassoc: prohíbe reducir/shift → lo tratamos como indeterminado
        return None
