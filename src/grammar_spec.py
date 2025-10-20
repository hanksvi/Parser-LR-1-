from __future__ import annotations
from dataclasses import dataclass
from typing import List, Set, Dict, Tuple, Iterable, Optional

# =========================
#   Representación básica
# =========================

@dataclass(frozen=True)
class Production:
    left: str
    right: Tuple[str, ...]  # Secuencia de símbolos (vacía = ε)

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

    # =========================
    #     Construcción (DSL)
    # =========================
    @staticmethod
    def from_text(text: str) -> "Grammar":
        """
        Formato soportado:
          - Líneas vacías o que empiezan con '#' se ignoran.
          - 'Start: S' (opcional). Si no aparece, se toma como start el LHS de la primera producción.
          - Producciones del tipo:
                A -> α | β | ε
            Donde:
                * ε puede escribirse como: ε, eps, '' o ""
                * Los literales terminales pueden ir entre '...' o "..."
                * Los símbolos se separan por espacio
        """
        g = Grammar()
        raw_rules: List[Tuple[str, List[List[str]]]] = []  # [(LHS, [[rhs1], [rhs2], ...]), ...]

        lines = text.splitlines()
        for line_no, raw_line in enumerate(lines, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            # Soporte para directiva Start:
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

                # Tokenizar por espacio y normalizar literales entre comillas
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

        # Conjunto de no terminales: todos los LHS
        g.nonterminals = {lhs for (lhs, _) in raw_rules}

        # Construir lista de producciones y recolectar símbolos RHS
        rhs_symbols: Set[str] = set()
        for lhs, rhs_lists in raw_rules:
            for rhs in rhs_lists:
                g.productions.append(Production(lhs, tuple(rhs)))
                rhs_symbols.update(rhs)

        # Terminales = símbolos que aparecen en RHS y no están en no terminales
        g.terminals = {s for s in rhs_symbols if s not in g.nonterminals}

        # Aumentar gramática con S' → S (si aplica)
        g.augment_start()

        return g

    # =========================
    #     Utilidades DSL
    # =========================
    @staticmethod
    def is_epsilon_alternative(alt: str) -> bool:
        """
        Devuelve True si la alternativa representa ε (vacío).
        Acepta: "", '', "ε", "eps"
        """
        s = (alt or "").strip()
        return s in {"''", '""', "ε", "eps"}

    @staticmethod
    def strip_quotes_if_literal(token: str) -> str:
        """
        Si el token viene entre comillas simples o dobles, quita las comillas para normalizarlo
        como literal terminal (p. ej. "'if'" -> "if").
        """
        t = token.strip()
        if len(t) >= 2 and ((t[0] == t[-1] == "'") or (t[0] == t[-1] == '"')):
            return t[1:-1]
        return t

    # =========================
    #   Aumento del start S'
    # =========================
    def augment_start(self) -> None:
        """
        Asegura una producción aumentada S' → S sin duplicar:
         - Si el start ya termina en ' (p. ej. S'), lo toma como aumentado.
         - Si ya existe A' → A (con A = start), usa ese A' como augmented_start.
         - Si no, crea un nombre libre (S', S'', S'''... o S_augN) y lo inserta al inicio.
        """
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

        # Crear un nombre aumentado disponible
        cand = base + "'"
        if cand in self.nonterminals:
            # Si existe, probar con más comillas, luego fallback _augN
            while cand in self.nonterminals:
                cand += "'"
            # (Si prefieres _augN, podrías implementar aquí otra estrategia)
        self.augmented_start = cand
        self.nonterminals.add(cand)
        # Insertar S' → S al inicio de las producciones
        self.productions.insert(0, Production(cand, (base,)))

    # =========================
    #     Consultas varias
    # =========================
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
