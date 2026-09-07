module main

import os

//> lox-class
@[heap]
struct Lox {
mut:
	//> had-error
	had_error bool
	//< had-error
}

fn main() {
	mut lox := Lox{}
	if os.args.len > 2 {
		println('Usage: vlox [script]')
		exit(64)
	} else if os.args.len == 2 {
		lox.run_file(os.args[1])
	} else {
		lox.run_prompt()
	}
}

//< lox-class

//> run-file
fn (mut l Lox) run_file(path string) {
	content := os.read_file(path) or { panic(err) }
	l.run(content)
	//> exit-code

	// Indicate an error in the exit code.
	if l.had_error {
		exit(65)
	}
	//< exit-code
}

//< run-file

//> prompt
fn (mut l Lox) run_prompt() {
	for {
		line := os.input_opt('> ') or { break }
		l.run(line)
		//> reset-had-error
		l.had_error = false
		//< reset-had-error
	}
}

//< prompt

//> run
fn (mut l Lox) run(source string) {
	mut scanner := Scanner{
		source: source
		lox:    &l
	}
	tokens := scanner.scan_tokens()

	// For now, just print the tokens.
	for token in tokens {
		println(token)
	}
}

//< run

//> lox-error
fn (mut l Lox) error(line int, message string) {
	l.report(line, '', message)
}

fn (mut l Lox) report(line int, where string, message string) {
	eprintln('[line ${line}] Error${where}: ${message}')
	l.had_error = true
}

//< lox-error
