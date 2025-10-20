from enum import Enum
class TokenType(Enum):

    ID =1  
    NUM =2
    STRING =3

    COMMA =4
    SEMICOLON =5
    LPAREN =6
    RPAREN =7
    PLUS =8
    MINUS =9
    MUL =10
    DIV =11
    ASSIGN =12

    INT =13
    FLOAT =14

    EPS =15
    END =16
    ERR =17


class Token:
    def __init__(self, ttype, lexeme, line=1, col=1):
        self.ttype = ttype
        self.lexeme = lexeme
        self.line = line
        self.col = col
    def __repr__(self):
        return f"<{self.type.name}:{self.lexeme}>"
