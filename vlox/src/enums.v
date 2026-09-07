module main

enum TokenType {
	left_paren
	right_paren
	left_brace
	right_brace
	comma
	dot
	minus
	plus
	semicolon
	star

	// One or two character tokens.
	bang
	equal
	equal_equal
	greater
	greater_equal
	less
	less_equal

	// Literals.
	identifier
	string
	number

	// Keywords.
	and
	class
	else
	false
	fun
	for
	if
	nil
	or
	print
	return
	super
	this
	true
	var
	while

	eof
}

enum EX {
	usage = 64
	dataerr = 65
	ioerr = 74
}
