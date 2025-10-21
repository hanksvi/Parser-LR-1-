from __future__ import annotations
from dataclasses import dataclass
from typing import List, Set, Dict, Tuple, Iterable, Optional

@dataclass(frozen=True)
class Production:
    left: str
    right: Tuple[str, ...]  

    def __str__(self) -> str:
        rhs = " ".join(self.right) if self.right else "ε"
        return f"{self.left} → {rhs}"


class Grammar:
    def __init__(self) -> None:
        self.nonterminals: Set[str] = set()
        self.terminals: Set[str] = set()
        self.productions: List[Production] = []
        self.start_symbol: Optional[str] = None
        self.augmented_start: Optional[str] = None


    #Construcción (DSL)

    @staticmethod
    def from_text(text: str) -> "Grammar":
        g = Grammar()
        raw_rules: List[Tuple[str, List[List[str]]]] = [] 

        lines = text.splitlines()
        for line_no, raw_line in enumerate(lines, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            if line.lower().startswith("start:"):
                start = line.split(":", 1)[1].strip()
                if not start:
                    raise ValueError(f"[L{line_no}] 'Start:' sin símbolo.")
                g.start_symbol = start
                continue

            if "->" not in line:
                raise ValueError(f"[L{line_no}] Falta '->' en: {line}")

            left, right = line.split("->", 1)
            left = left.strip()
            if not left:
                raise ValueError(f"[L{line_no}] LHS vacío antes de '->'.")

            # Separar alternativas por '|'
            alt_texts = [alt.strip() for alt in right.split("|")]
            rhs_lists: List[List[str]] = []

            for alt in alt_texts:
                # Alternativa epsilon
                if Grammar.is_epsilon_alternative(alt):
                    rhs_lists.append([])
                    continue

                tokens = alt.split()
                normalized: List[str] = []
                for tok in tokens:
                    lit = Grammar.strip_quotes_if_literal(tok)
                    if lit == "":
                        raise ValueError(
                            f"[L{line_no}] Literal vacío no permitido "
                            f"(usa '' o \"\" como ε solo si la alternativa es *solo* ε)."
                        )
                    normalized.append(lit)
                rhs_lists.append(normalized)

            raw_rules.append((left, rhs_lists))

        if not raw_rules:
            raise ValueError("Gramática vacía: no hay producciones")

        # Si no hubo Start:, tomar el primer LHS como símbolo inicial
        if g.start_symbol is None:
            g.start_symbol = raw_rules[0][0]

        g.nonterminals = {lhs for (lhs, _) in raw_rules}

        rhs_symbols: Set[str] = set()
        for lhs, rhs_lists in raw_rules:
            for rhs in rhs_lists:
                g.productions.append(Production(lhs, tuple(rhs)))
                rhs_symbols.update(rhs)

        g.terminals = {s for s in rhs_symbols if s not in g.nonterminals}

        # Aumentar gramática con S' → S (si aplica)
        g.augment_start()

        return g


    #  Utilidades DSL

    @staticmethod
    def is_epsilon_alternative(alt: str) -> bool:
        s = (alt or "").strip()
        return s in {"''", '""', "ε", "eps"}

    @staticmethod
    def strip_quotes_if_literal(token: str) -> str:
        t = token.strip()
        if len(t) >= 2 and ((t[0] == t[-1] == "'") or (t[0] == t[-1] == '"')):
            return t[1:-1]
        return t


    #  Aumento del start S'

    def augment_start(self) -> None:
        
        assert self.start_symbol is not None, "start_symbol no definido."

        base = self.start_symbol

        # Caso: el usuario ya eligió un símbolo que termina en '
        if base.endswith("'"):
            self.augmented_start = base
            return

        # Caso: ya existe una producción X' → base
        for p in self.productions:
            if p.left.endswith("'") and p.right == (base,):
                self.augmented_start = p.left
                return

        cand = base + "'"
        if cand in self.nonterminals:
            while cand in self.nonterminals:
                cand += "'"
        self.augmented_start = cand
        self.nonterminals.add(cand)
        # Insertar S' → S al inicio de las producciones
        self.productions.insert(0, Production(cand, (base,)))

    #   Consultas varias

    def is_nonterminal(self, symbol: str) -> bool:
        return symbol in self.nonterminals

    def is_terminal(self, symbol: str) -> bool:
        return (symbol in self.terminals) or (symbol == "$")

    def productions_of(self, lhs: str) -> Iterable[Production]:
        for p in self.productions:
            if p.left == lhs:
                yield p

    def all_symbols(self) -> Set[str]:
        return set(self.terminals) | set(self.nonterminals)

    def to_dict(self) -> Dict:
        return {
            "start": self.start_symbol,
            "augmented_start": self.augmented_start,
            "nonterminals": sorted(self.nonterminals),
            "terminals": sorted(self.terminals),
            "productions": [
                {"left": p.left, "right": list(p.right)} for p in self.productions
            ],
        }

    def __str__(self) -> str:
        lines = []
        lines.append(f"Start: {self.start_symbol}   (Augmented: {self.augmented_start})")
        lines.append(f"NonTerminals: {sorted(self.nonterminals)}")
        lines.append(f"Terminals   : {sorted(self.terminals)}")
        lines.append("Productions :")
        for p in self.productions:
            lines.append(f"  {p}")
        return "\n".join(lines)
