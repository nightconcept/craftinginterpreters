module main

//> keyword-map
const keywords = {
	'and':    TokenType.and
	'class':  TokenType.class
	'else':   TokenType.else
	'false':  TokenType.false
	'for':    TokenType.for
	'fun':    TokenType.fun
	'if':     TokenType.if
	'nil':    TokenType.nil
	'or':     TokenType.or
	'print':  TokenType.print
	'return': TokenType.return
	'super':  TokenType.super
	'this':   TokenType.this
	'true':   TokenType.true
	'var':    TokenType.var
	'while':  TokenType.while
}
//< keyword-map

//> scanner-class
struct Scanner {
	source string
mut:
	tokens []Token
	//< scanner-class
	lox &Lox
	//> scan-state
	start   int
	current int
	line    int = 1
	//< scan-state
}

//> scan-tokens
fn (mut s Scanner) scan_tokens() []Token {
	for !s.is_at_end() {
		// We are at the beginning of the next lexeme.
		s.start = s.current
		s.scan_token()
	}

	s.tokens << Token{
		typ:     .eof
		lexeme:  ''
		literal: none
		line:    s.line
	}
	return s.tokens
}

//< scan-tokens

//> scan-token
fn (mut s Scanner) scan_token() {
	c := s.advance()
	match c {
		`(` {
			s.add_token(.left_paren)
		}
		`)` {
			s.add_token(.right_paren)
		}
		`{` {
			s.add_token(.left_brace)
		}
		`}` {
			s.add_token(.right_brace)
		}
		`,` {
			s.add_token(.comma)
		}
		`.` {
			s.add_token(.dot)
		}
		`-` {
			s.add_token(.minus)
		}
		`+` {
			s.add_token(.plus)
		}
		`;` {
			s.add_token(.semicolon)
		}
		`*` {
			s.add_token(.star)
		}
		//> two-char-tokens
		`!` {
			s.add_token(if s.match_char(`=`) { TokenType.bang_equal } else { TokenType.bang })
		}
		`=` {
			s.add_token(if s.match_char(`=`) { TokenType.equal_equal } else { TokenType.equal })
		}
		`<` {
			s.add_token(if s.match_char(`=`) { TokenType.less_equal } else { TokenType.less })
		}
		`>` {
			s.add_token(if s.match_char(`=`) { TokenType.greater_equal } else { TokenType.greater })
		}
		//< two-char-tokens
		//> slash
		`/` {
			if s.match_char(`/`) {
				// A comment goes until the end of the line.
				for s.peek() != `\n` && !s.is_at_end() {
					s.advance()
				}
			} else {
				s.add_token(.slash)
			}
		}
		//< slash
		//> whitespace
		` `, `\r`, `\t` {
			// Ignore whitespace.
		}
		`\n` {
			s.line++
		}
		//< whitespace
		//> string-start
		`"` {
			s.string()
		}
		//< string-start
		//> char-error
		else {
			//> digit-start
			if is_digit(c) {
				s.number()
				//> identifier-start
			} else if is_alpha(c) {
				s.identifier()
				//< identifier-start
			} else {
				s.lox.error(s.line, 'Unexpected character.')
			}
			//< digit-start
		}
		//< char-error
	}
}

//< scan-token

//> identifier
fn (mut s Scanner) identifier() {
	for is_alpha_numeric(s.peek()) {
		s.advance()
	}

	//> keyword-type
	text := s.source[s.start..s.current]
	typ := keywords[text] or { TokenType.identifier }
	s.add_token(typ)
	//< keyword-type
}

//< identifier

//> number
fn (mut s Scanner) number() {
	for is_digit(s.peek()) {
		s.advance()
	}

	// Look for a fractional part.
	if s.peek() == `.` && is_digit(s.peek_next()) {
		// Consume the "."
		s.advance()

		for is_digit(s.peek()) {
			s.advance()
		}
	}

	s.add_token_literal(.number, s.source[s.start..s.current].f64())
}

//< number

//> string
fn (mut s Scanner) string() {
	for s.peek() != `"` && !s.is_at_end() {
		if s.peek() == `\n` {
			s.line++
		}
		s.advance()
	}

	if s.is_at_end() {
		s.lox.error(s.line, 'Unterminated string.')
		return
	}

	// The closing ".
	s.advance()

	// Trim the surrounding quotes.
	value := s.source[s.start + 1..s.current - 1]
	s.add_token_literal(.string, value)
}

//< string

//> match
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

//< match

//> peek
fn (mut s Scanner) peek() u8 {
	if s.is_at_end() {
		return `\0`
	}
	return s.source[s.current]
}

//< peek

//> peek-next
fn (s Scanner) peek_next() u8 {
	if s.current + 1 >= s.source.len {
		return `\0`
	}
	return s.source[s.current + 1]
}

//< peek-next

//> is-alpha
fn is_alpha(c u8) bool {
	return (c >= `a` && c <= `z`) || (c >= `A` && c <= `Z`) || c == `_`
}

fn is_alpha_numeric(c u8) bool {
	return is_alpha(c) || is_digit(c)
}

//< is-alpha

//> is-digit
fn is_digit(c u8) bool {
	return c >= `0` && c <= `9`
}

//< is-digit

//> is-at-end
fn (s Scanner) is_at_end() bool {
	return s.current >= s.source.len
}

//< is-at-end

//> advance-and-add-token
fn (mut s Scanner) advance() u8 {
	c := s.source[s.current]
	s.current++
	return c
}

fn (mut s Scanner) add_token(typ TokenType) {
	s.add_token_none(typ)
}

fn (mut s Scanner) add_token_none(typ TokenType) {
	text := s.source[s.start..s.current]
	s.tokens << Token{
		typ:     typ
		lexeme:  text
		literal: none
		line:    s.line
	}
}

fn (mut s Scanner) add_token_literal(typ TokenType, literal Literal) {
	text := s.source[s.start..s.current]
	s.tokens << Token{
		typ:     typ
		lexeme:  text
		literal: literal
		line:    s.line
	}
}

//< advance-and-add-token
