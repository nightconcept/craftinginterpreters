module main

import os

fn main() {
	mut lox := Lox{}
	if os.args.len > 1 {
		println('Usage: vlox [script]')
		exit(int(EX.usage))
		return
	} else if os.args.len == 1{
		lox.run_file(os.args[1])
	} else {
		lox.run_prompt()
	}

}

struct Lox {
	mut:
		had_error bool
}

fn (mut l Lox) run_file(path string) bool {
	if !os.exists(path) {
		println('File not found: $path')
		return false
	}

	content := os.read_file(path) or {
		eprintln('Failed to read file: $path')
		return false
	}

	run(content)
	if l.had_error {
	}
	return true
}

fn (mut l Lox) run(content string) {
	mut had_error := false
  mut scanner := Scanner{
		source: content
		on_error: fn [mut had_error] (line int, message string) {
			had_error = true
			eprintln('[line ${line}] Error: ${message}')
		}
	}
	tokens := scanner.scan_tokens()
	if had_error {
		return
	}
	for token in tokens {
		println(token)
	}
}

fn (mut l Lox) run_prompt() {
	println('Lox REPL (Ctrl+C to exit)')
	for {
		print('> ')
		os.flush()
		line := os.get_line()
		if line == '' {
			break
		}
		run(line)
		l.had_error = false
	}
}

pub fn (mut l Lox) error(line int, message string) {
	l.report(line, '' , message)
}

fn (mut l Lox) report(line int, where string, message string) {
	eprintln('[line ${line}] Error${where}: ${message}')
}
