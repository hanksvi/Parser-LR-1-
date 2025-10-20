from __future__ import annotations
from dataclasses import dataclass
from typing import Iterable, List, Optional, Set, Tuple
import re

from grammar_spec import Grammar

@dataclass(frozen=True)
class ScanToken:
    symbol: str
    lexeme: str
    line: int
    col: int
    def __repr__(self) -> str:
        return f"<{self.symbol}:{self.lexeme}@{self.line}:{self.col}>"

class Scanner:
    _re_ident = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
    _re_number = re.compile(r"\d+(?:\.\d+)?")

    def __init__(self, text: str, grammar: Grammar) -> None:
        self.text = text
        self.n = len(text)
        self.i = 0
        self.line = 1
        self.col = 1

        declared_terminals: Set[str] = set(grammar.terminals)
        self._has_id = "id" in declared_terminals
        self._has_num = "num" in declared_terminals

        self.literals: List[str] = sorted(
            [t for t in declared_terminals if t not in ("id", "num")],
            key=lambda s: (-len(s), s)
        )

    def tokenize_all(self) -> List[ScanToken]:
        out: List[ScanToken] = []
        while True:
            tok = self.next_token()
            out.append(tok)
            if tok.symbol == "$":
                break
        return out

    def next_token(self) -> ScanToken:
        self._skip_space()
        if self.i >= self.n:
            return ScanToken("$", "$", self.line, self.col)

        lit = self._match_any_literal()
        if lit is not None:
            start_col = self.col
            lex = self._advance(len(lit))
            return ScanToken(lit, lex, self.line, start_col)


        m = self._re_ident.match(self.text, self.i)
        if m:
            lex = m.group(0)
            start_col = self.col
            self._advance(len(lex))

            if lex in self.literals:
                return ScanToken(lex, lex, self.line, start_col)

            if self._has_id:
                return ScanToken("id", lex, self.line, start_col)

            return ScanToken("ERR", lex, self.line, start_col)

        m = self._re_number.match(self.text, self.i)
        if m:
            lex = m.group(0)
            start_col = self.col
            self._advance(len(lex))
            if self._has_num:
                return ScanToken("num", lex, self.line, start_col)
            return ScanToken("ERR", lex, self.line, start_col)

        bad = self._advance(1)
        return ScanToken("ERR", bad, self.line, self.col - len(bad))
    def _skip_space(self) -> None:
        while self.i < self.n:
            c = self.text[self.i]
            if c in (" ", "\t", "\r"):
                self._advance(1)
                continue
            if c == "\n":
                self._advance_line()
                continue
            break

    def _advance(self, k: int) -> str:
        frag = self.text[self.i : self.i + k]
        newlines = frag.count("\n")
        if newlines == 0:
            self.i += k
            self.col += k
        else:
            last_nl = frag.rfind("\n")
            self.i += k
            self.line += newlines
            self.col = k - last_nl
        return frag

    def _advance_line(self) -> None:
        self.i += 1
        self.line += 1
        self.col = 1

    def _match_any_literal(self) -> Optional[str]:
        if not self.literals:
            return None
        s = self.text
        i = self.i
        n = self.n

        for lit in self.literals:
            L = len(lit)
            if L == 0 or i + L > n:
                continue
            if not s.startswith(lit, i):
                continue
            if lit[0].isalnum():
                if i > 0 and (s[i-1].isalnum() or s[i-1] == "_"):
                    continue
                if i + L < n and (s[i+L].isalnum() or s[i+L] == "_"):
                    continue

            return lit

        return None
