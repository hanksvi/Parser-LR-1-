from __future__ import annotations
from dataclasses import dataclass
from enum import Enum, auto
from typing import Dict, List, Optional, Tuple

from grammar_spec import Grammar, Production
from lr1_items import LR1Automaton

class ActionKind(Enum):
    SHIFT = auto()
    REDUCE = auto()
    ACCEPT = auto()

@dataclass(frozen=True)
class Action:
    kind: ActionKind
    target: Optional[int] = None
    production: Optional[Production] = None
    def __str__(self) -> str:
        if self.kind == ActionKind.SHIFT:
            return f"d{self.target}"
        if self.kind == ActionKind.REDUCE:
            rhs = " ".join(self.production.right) if self.production and self.production.right else "ε"
            return f"r[{self.production.left}→{rhs}]"
        if self.kind == ActionKind.ACCEPT and self.production is not None:
            rhs = " ".join(self.production.right) if self.production.right else "ε"
            return f"r[{self.production.left}→{rhs}]"
        return "acc"

@dataclass
class Conflict:
    state_id: int
    symbol: str
    existing: Action
    incoming: Action
    def kind(self) -> str:
        kinds = {self.existing.kind, self.incoming.kind}
        if kinds == {ActionKind.SHIFT, ActionKind.REDUCE}:
            return "shift/reduce"
        if kinds == {ActionKind.REDUCE}:
            return "reduce/reduce"
        return f"{self.existing.kind.name.lower()}/{self.incoming.kind.name.lower()}"
    def __str__(self) -> str:
        return (f"[I{self.state_id}, sym='{self.symbol}'] "
                f"{self.kind()} conflict: existing={self.existing} vs incoming={self.incoming}")

@dataclass
class LR1ParseTable:
    action: Dict[int, Dict[str, Action]]
    goto: Dict[int, Dict[str, int]]
    conflicts: List[Conflict]
    terminals: List[str]
    nonterminals: List[str]

    def is_lr1(self) -> bool:
        return len(self.conflicts) == 0

    def __str__(self) -> str:
        lines: List[str] = []
        term_hdr = "  ".join(self.terminals)
        nterm_hdr = "  ".join(self.nonterminals)
        lines.append("ACTION:")
        lines.append(f"      |  {term_hdr}")
        lines.append("-" * (8 + 3 * max(1, len(self.terminals))))

        max_state = max(self.action.keys() | self.goto.keys()) if (self.action or self.goto) else -1

        for sid in range(max_state + 1):
            row = [f"I{sid:<3} |"]
            arow = self.action.get(sid, {})
            for t in self.terminals:
                cell = arow.get(t)
                row.append(f"{str(cell) if cell else '.':<8}")
            lines.append("  ".join(row))

        lines.append("")
        lines.append("GOTO:")
        lines.append(f"      |  {nterm_hdr}")
        lines.append("-" * (8 + 3 * max(1, len(self.nonterminals))))

        for sid in range(max_state + 1):
            row = [f"I{sid:<3} |"]
            grow = self.goto.get(sid, {})
            for A in self.nonterminals:
                val = grow.get(A)
                row.append(f"{(val if val is not None else '.'):>8}")
            lines.append("  ".join(row))

        if self.conflicts:
            lines.append("\nConflicts:")
            for c in self.conflicts:
                lines.append(f"  - {c}")

        return "\n".join(lines)

    @staticmethod
    def build_lr1_parse_table(grammar: Grammar, automaton: LR1Automaton) -> "LR1ParseTable":
        action: Dict[int, Dict[str, Action]] = {}
        goto_tbl: Dict[int, Dict[str, int]] = {}
        conflicts: List[Conflict] = []

        terminals: List[str] = sorted(grammar.terminals | {"$"})
        nonterminals: List[str] = sorted({A for A in grammar.nonterminals if A != grammar.augmented_start})

        # 1) SHIFT y GOTO desde transiciones
        for state in automaton.states:
            sid = state.id
            for sym, dst in automaton.transitions.get(sid, {}).items():
                if sym in grammar.terminals:
                    _set_action_with_conflict_check(
                        action, conflicts, sid, sym,
                        Action(ActionKind.SHIFT, target=dst),
                    )
                elif sym in grammar.nonterminals:
                    goto_tbl.setdefault(sid, {})[sym] = dst

        # 2) REDUCE y ACCEPT desde ítems completos
        prod_index: Dict[Tuple[str, Tuple[str, ...]], Production] = {
            (p.left, tuple(p.right)): p for p in grammar.productions
        }

        for state in automaton.states:
            sid = state.id
            for it in state.items:
                if not it.is_complete():
                    continue
                A = it.left
                a = it.lookahead
                if A == grammar.augmented_start and a == "$":
                    aug_prod = Production(grammar.augmented_start, (grammar.start_symbol,))
                    _set_action_with_conflict_check(
                        action, conflicts, sid, "$",
                        Action(ActionKind.ACCEPT, production=aug_prod)
                    )
                    continue
                p = prod_index.get((A, tuple(it.alpha))) or Production(A, tuple(it.alpha))
                _set_action_with_conflict_check(
                    action, conflicts, sid, a, Action(ActionKind.REDUCE, production=p)
                )

        return LR1ParseTable(
            action=action,
            goto=goto_tbl,
            conflicts=conflicts,
            terminals=terminals,
            nonterminals=nonterminals,
        )

def _set_action_with_conflict_check(
    action: Dict[int, Dict[str, Action]],
    conflicts: List[Conflict],
    state_id: int,
    symbol: str,
    incoming: Action,
) -> None:
    row = action.setdefault(state_id, {})
    existing = row.get(symbol)

    if existing is None:
        row[symbol] = incoming
        return

    if existing == incoming:
        return

    conflicts.append(Conflict(state_id, symbol, existing, incoming))
