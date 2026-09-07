struct Token {
	pub:
		typ TokenType
		lexeme string
		literal string
		line int
}

pub fn (t Token) to_string() string {
	return '${t.typ} ${t.lexeme} ${t.literal}'
}
