//> scanner-class
struct Scanner {
	source string
	on_error ErrorFn
	mut:
	tokens  []Token
	start int
	current int
	line int = 1
}

//< scanner-class

type ErrorFn = fn (line int, message string)

//> scan-tokens
fn (mut s Scanner) scan_tokens() []Token {
	for !s.is_at_end() {
		s.start = s.current
		s.scan_token()
	}
	s.tokens << Token{
		typ: .eof
		lexeme: ''
		literal: ''
		line: s.line
	}
	return s.tokens
}
//< scan-tokens

//> is-at-end
fn (mut s Scanner) is_at_end() bool {
	return s.current >= s.source.len
}
//< is-at-end

//> scan-token
fn (mut s Scanner) scan_token() {
	c := s.advance()

	match c {
		`(` { s.add_token(.left_paren) }
		`)` { s.add_token(.right_paren) }
		`{` { s.add_token(.left_brace) }
		`}` { s.add_token(.right_brace) }
		`,` { s.add_token(.comma) }
		`.` { s.add_token(.dot) }
		`-` { s.add_token(.minus) }
		`+` { s.add_token(.plus) }
		`;` { s.add_token(.semicolon) }
		`*` { s.add_token(.star) }
		`!` { s.add_token(.bang) }
		`=` { s.add_token(.equal) }
		`<` { s.add_token(.less) }
		`>` { s.add_token(.greater) }
		else {
			s.on_error(s.line, 'Unexpected character.')

		}
	}
}

fn (mut s Scanner) match_char(expected u8) bool {
	if s.is_at_end() {
		return false
	}
	if s.source[s.current] != expected {
		return false
	}
	s.current++
	return true
}

//< scan-token

//> advance-and-add-token
fn (mut s Scanner) add_token(typ TokenType) {
	s.add_token_literal(typ, '')
}

fn (mut s Scanner) add_token_literal(typ TokenType, literal string) {
	text := s.source[s.start..s.current]
	s.tokens << Token{
		typ: typ
		lexeme: text
		literal: literal
		line: s.line
	}
}

fn (mut s Scanner) advance() u8 {
	ch := s.source[s.current]
	s.current++
	return ch
}
//< advance-and-add-token
