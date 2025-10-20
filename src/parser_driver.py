from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict

from grammar_spec import Grammar, Production
from first_sets import FirstSets
from lr1_items import build_canonical_collection
from parse_table import LR1ParseTable, ActionKind, Action
from scanner import Scanner, ScanToken

@dataclass
class ParseStep:
    step: int
    stack_states: List[int]          
    stack_symbols: List[str]         
    lookahead: str                   
    action_str: str
    reduced_prod: Optional[str]
    input_window: str

@dataclass
class ParseResult:
    accepted: bool
    steps: List[ParseStep]
    error_message: Optional[str] = None
    error_state: Optional[int] = None
    error_symbol: Optional[str] = None

class ParseError(Exception):
    pass

class ParserDriver:
    def __init__(self, table: LR1ParseTable) -> None:
        self.table = table

    def parse(self, tokens: List[ScanToken], max_steps: int = 10000) -> ParseResult:
        states: List[int] = [0]
        symbols: List[str] = []
        i = 0
        steps: List[ParseStep] = []

        def action_to_str(a: Action) -> str:
            if a.kind == ActionKind.SHIFT:
                return f"d{a.target}"
            if a.kind == ActionKind.REDUCE:
                rhs = " ".join(a.production.right) if a.production and a.production.right else "ε"
                return f"r[{a.production.left}→{rhs}]"
            if a.kind == ActionKind.ACCEPT and a.production is not None:
                rhs = " ".join(a.production.right) if a.production.right else "ε"
                return f"r[{a.production.left}→{rhs}]"
            return "acc"

        def make_input_window(idx: int) -> str:
            frag = []
            for j in range(idx, min(len(tokens), idx + 7)):
                frag.append(tokens[j].lexeme)
            return " ".join(frag)

        step = 0
        while True:
            step += 1
            if step > max_steps:
                return ParseResult(
                    accepted=False,
                    steps=steps,
                    error_message="Se superó el máximo de pasos (posible bucle).",
                )

            lookahead_tok = tokens[i] if i < len(tokens) else ScanToken("$", "$", -1, -1)
            a_sym = lookahead_tok.symbol

            s = states[-1]
            act = self.table.action.get(s, {}).get(a_sym)

            if act is None:
                err_msg = (
                    f"ERROR de sintaxis: en estado I{s}, con lookahead '{a_sym}' "
                    f"(lexema='{lookahead_tok.lexeme}' @ {lookahead_tok.line}:{lookahead_tok.col})."
                )
                steps.append(ParseStep(
                    step=step,
                    stack_states=list(states),
                    stack_symbols=list(symbols),
                    lookahead=a_sym,
                    action_str="·",
                    reduced_prod=None,
                    input_window=make_input_window(i),
                ))
                return ParseResult(
                    accepted=False,
                    steps=steps,
                    error_message=err_msg,
                    error_state=s,
                    error_symbol=a_sym,
                )

            # ------ SHIFT ------
            if act.kind == ActionKind.SHIFT:
                states.append(act.target)
                symbols.append(a_sym)
                i += 1
                steps.append(ParseStep(
                    step=step,
                    stack_states=list(states),
                    stack_symbols=list(symbols),
                    lookahead=a_sym,
                    action_str=action_to_str(act),
                    reduced_prod=None,
                    input_window=make_input_window(i),
                ))
                continue

            # ------ REDUCE ------
            if act.kind == ActionKind.REDUCE:
                prod: Production = act.production
                k = len(prod.right)
                if k > 0:
                    del symbols[-k:]
                    del states[-k:]

                t = states[-1]
                A = prod.left
                goto_tA = self.table.goto.get(t, {}).get(A)
                if goto_tA is None:
                    err_msg = (
                        f"ERROR interno: GOTO(I{t}, {A}) indefinido tras reducir "
                        f"{A}→{' '.join(prod.right) if prod.right else 'ε'}."
                    )
                    steps.append(ParseStep(
                        step=step,
                        stack_states=list(states),
                        stack_symbols=list(symbols),
                        lookahead=a_sym,
                        action_str=action_to_str(act),
                        reduced_prod=f"{A}→{' '.join(prod.right) if prod.right else 'ε'}",
                        input_window=make_input_window(i),
                    ))
                    return ParseResult(
                        accepted=False,
                        steps=steps,
                        error_message=err_msg,
                        error_state=t,
                        error_symbol=A,
                    )

                # Apilar A y el estado goto
                symbols.append(A)
                states.append(goto_tA)
                steps.append(ParseStep(
                    step=step,
                    stack_states=list(states),
                    stack_symbols=list(symbols),
                    lookahead=a_sym,
                    action_str=action_to_str(act),
                    reduced_prod=f"{A}→{' '.join(prod.right) if prod.right else 'ε'}",
                    input_window=make_input_window(i),
                ))
                continue

            # ------ ACCEPT ------
            if act.kind == ActionKind.ACCEPT:
                steps.append(ParseStep(
                    step=step,
                    stack_states=list(states),
                    stack_symbols=list(symbols),
                    lookahead=a_sym,
                    action_str="acc",
                    reduced_prod=None,
                    input_window=make_input_window(i),
                ))
                return ParseResult(accepted=True, steps=steps)

def compile_and_parse(grammar_text: str, input_text: str) -> Tuple[LR1ParseTable, ParseResult]:
    grammar = Grammar.from_text(grammar_text)
    first = FirstSets.compute_first_sets(grammar)
    automaton = build_canonical_collection(grammar, first)
    table = LR1ParseTable.build_lr1_parse_table(grammar, automaton)

    scanner = Scanner(input_text, grammar)
    tokens = scanner.tokenize_all()

    driver = ParserDriver(table)
    result = driver.parse(tokens)

    return table, result    