from __future__ import annotations
from typing import Dict, Set, Iterable, List, Tuple, Optional
from grammar_spec import Grammar, Production

EPSILON = "ε"

class FirstSets:
    def __init__(self, grammar: Grammar, first_map: Dict[str, Set[str]]) -> None:
        self.grammar = grammar
        self.first_map: Dict[str, Set[str]] = first_map
    
    def first_of_symbol(self, symbol: str) -> Set[str]:
        if symbol == "$":
            return {"$"}
        if symbol not in self.first_map:
            return {symbol}
        return set(self.first_map[symbol])
    
    def first_of_sequence(self, seq: Iterable[str]) -> Set[str]:
        seq_list = list(seq)
        if not seq_list:
            return {EPSILON}
        
        result: Set[str] = set()

        for i, sym in enumerate(seq_list):
            s_first = self.first_of_symbol(sym)
            result.update(x for x in s_first if x != EPSILON)

            if EPSILON not in s_first:
                break

        else:
            result.add(EPSILON)
        
        return result
    

    def is_nullable_symbol(self, symbol: str) -> bool:
        return EPSILON in self.first_of_symbol(symbol)
    
    def is_nullable_sequence(self, seq: Iterable[str]) -> bool:
        return EPSILON in self.first_of_sequence(seq)
    

    @staticmethod
    def compute_first_sets(grammar: Grammar) -> "FirstSets":
        first: Dict[str, Set[str]] = {}
        for t in grammar.terminals:
            first[t] = {t}
        for A in grammar.nonterminals:
            first.setdefault(A, set())

        changed = True
        while changed:
            changed = False
            for prod in grammar.productions:
                A = prod.left
                alpha = list(prod.right)
                if not alpha:
                    if EPSILON not in first[A]:
                        first[A].add(EPSILON)
                        changed = True
                    continue

                all_nullable = True
                for i, X in enumerate(alpha):
                    fX = FirstSets._first_of_symbol_current(grammar, first, X)
                    added = FirstSets._union_excluding_epsilon(first[A], fX)
                    if added:
                        changed = True
                    
                    if EPSILON not in fX:
                        all_nullable = False
                        break

                if all_nullable:
                    if EPSILON not in first[A]:
                        first[A].add(EPSILON)
                        changed = True
        return FirstSets(grammar, first) 
    

    @staticmethod
    def _first_of_symbol_current(grammar: Grammar, first: Dict[str, Set[str]], symbol: str) -> Set[str]:    
        if symbol == "$":
            return {"$"}
        if grammar.is_terminal(symbol):
            return {symbol}
        if grammar.is_nonterminal(symbol):
            return first.setdefault(symbol, set())
        
        return {symbol}
    
    @staticmethod
    def _union_excluding_epsilon(target: Set[str], source: Set[str]) -> bool:
        before = len(target)
        if EPSILON in source:
            target.update(x for x in source if x != EPSILON)
        else:
            target.update(source)
        return len(target) != before
    