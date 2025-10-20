from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Set, Tuple, Iterable, List, FrozenSet, Optional

from grammar_spec import Grammar, Production
from first_sets import FirstSets, EPSILON

@dataclass(frozen=True, eq=True)
class LR1Item:
    left: str
    alpha: Tuple[str, ...] 
    beta: Tuple[str, ...]
    lookahead: str

    def __str__(self) -> str:
        alpha = " ".join(self.alpha)
        beta = " ".join(self.beta)
        dot = "·"
        left = self.left
        if alpha and beta:
            rhs = f"{alpha} {dot} {beta}"
        elif alpha and not beta:
            rhs = f"{alpha} {dot}"
        elif not alpha and beta:
            rhs = f"{dot} {beta}"
        else:
            rhs = f"{dot}"
        return f"{left} → {rhs} , {self.lookahead}"
    
    def is_complete(self) -> bool:
        return len(self.beta) == 0
    
    def next_symbol(self) -> Optional[str]:
        return self.beta[0] if self.beta else None
    
    def advance_dot(self) -> "LR1Item":
        assert self.beta, "No se puede avanzar el punto en un ítem completo."
        X = self.beta[0]
        new_alpha = self.alpha + (X,)
        new_beta = self.beta[1:]
        return LR1Item(self.left, new_alpha, new_beta, self.lookahead)
    
    @staticmethod
    def closure(items: Iterable["LR1Item"], grammar: Grammar, first_sets: FirstSets) -> FrozenSet["LR1Item"]:
        result: Set[LR1Item] = set(items)
        changed = True
        prod_cache: Dict[str, List[Production]] = {A: list(grammar.productions_of(A)) for A in grammar.nonterminals}

        while changed:
            changed = False
            for item in list(result):
                X = item.next_symbol()
                if X is None or not grammar.is_nonterminal(X):
                    continue

                gamma = item.beta[1:]
                look_seq = list(gamma) + [item.lookahead]
                lookaheads = first_sets.first_of_sequence(look_seq)

                for p in prod_cache[X]:
                    delta = p.right
                    for b in lookaheads:
                        if b == EPSILON:
                            continue
                        new_item = LR1Item(X, tuple(), tuple(delta), b)
                        if new_item not in result:
                            result.add(new_item)
                            changed = True
        return frozenset(result)
def goto(items: Iterable[LR1Item], symbol: str, grammar: Grammar, first_sets: FirstSets) -> FrozenSet[LR1Item]:
    moved: List[LR1Item] = []
    for item in items:
        X = item.next_symbol()
        if X == symbol:
            moved.append(item.advance_dot())
    if not moved:
        return frozenset()
    return LR1Item.closure(moved, grammar, first_sets)

@dataclass
class LR1State:
    id: int
    items: FrozenSet[LR1Item]
    def __str__(self) -> str:
        lines = [f"I{self.id}:"]
        for it in sorted(self.items, key=item_sort_key):
            lines.append(f"  {it}")
        return "\n".join(lines)

@dataclass
class LR1Automaton:
    states: List[LR1State]
    transitions: Dict[int, Dict[str, int]]
    def to_dot(self, show_items: bool = False) -> str:
        def esc(s: str) -> str:
            return s.replace('"', r'\"')
        lines = ['digraph LR1 {', '  rankdir=LR;', '  node [shape=record];']
        for st in self.states:
            if show_items:
                body = "\\l".join(esc(str(it)) for it in sorted(st.items, key=item_sort_key)) + "\\l"
                lines.append(f'  S{st.id} [label="{{I{st.id}|{body}}}"];')
            else:
                lines.append(f'  S{st.id} [label="I{st.id}"];')
        for src, edges in self.transitions.items():
            for sym, dst in edges.items():
                lines.append(f'  S{src} -> S{dst} [label="{esc(sym)}"];')

        lines.append('}')
        return "\n".join(lines)
    def __str__(self) -> str:
        lines = []
        for st in self.states:
            lines.append(str(st))
            if st.id in self.transitions:
                for sym, dst in sorted(self.transitions[st.id].items()):
                    lines.append(f"    -- {sym} --> I{dst}")
        return "\n".join(lines)
    
def build_canonical_collection(grammar: Grammar, first_sets: FirstSets) -> LR1Automaton:
    assert grammar.augmented_start is not None and grammar.start_symbol is not None

    start_item = LR1Item(
        left=grammar.augmented_start,
        alpha=tuple(),
        beta=(grammar.start_symbol,),
        lookahead="$",
    )
    I0 = LR1Item.closure([start_item], grammar, first_sets)

    states: List[LR1State] = []
    transitions: Dict[int, Dict[str, int]] = {}
    state_index: Dict[FrozenSet[LR1Item], int] = {}

    def get_or_add_state(items: FrozenSet[LR1Item]) -> Tuple[int, bool]:
        """Devuelve (id_estado, es_nuevo)."""
        sid = state_index.get(items)
        if sid is not None:
            return sid, False
        sid = len(states)
        states.append(LR1State(sid, items))
        state_index[items] = sid
        return sid, True

    s0, _ = get_or_add_state(I0)
    worklist: List[FrozenSet[LR1Item]] = [I0]

    symbols = sorted(grammar.all_symbols(), key=symbol_sort_key)

    while worklist:
        I = worklist.pop(0)
        sid = state_index[I]

        for X in symbols:
            J = goto(I, X, grammar, first_sets)
            if not J:
                continue

            tid, is_new = get_or_add_state(J)
            transitions.setdefault(sid, {})[X] = tid
            if is_new:
                worklist.append(J)

    return LR1Automaton(states, transitions)


def item_sort_key(it: LR1Item):
    return (it.left, " ".join(it.alpha), " ".join(it.beta), it.lookahead)

def symbol_sort_key(sym: str) -> Tuple[int, str]:
    return (0, sym)