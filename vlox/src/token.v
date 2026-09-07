module main

//> token-class
type Literal = f64 | string

fn literal_str(literal Literal) string {
	return match literal {
		f64 { '${literal}' }
		string { literal }
	}
}

struct Token {
	typ     TokenType
	lexeme  string
	literal ?Literal
	line    int
}

fn (t Token) str() string {
	lit := if literal := t.literal { literal_str(literal) } else { 'null' }
	return '${t.typ.str().to_upper()} ${t.lexeme} ${lit}'
}

//< token-class
