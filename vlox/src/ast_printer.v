module main

import strings

// Java's `AstPrinter.main()` builds `Expr.Literal(123)` from an `int`, whose
// `toString()` is "123". `vlox` has only `f64`, which prints as "123.0", so
// the printed tree would not match the one the chapter shows. Trimming the
// trailing ".0" is the same thing Nystrom's `stringify()` does in Evaluating
// Expressions; it arrives here two chapters early and stays outside the
// markers until his prose introduces it.
fn literal_repr(l Literal) string {
	text := literal_str(l)
	return if text.ends_with('.0') { text#[..-2] } else { text }
}

//> Representing Code ast-printer
struct AstPrinter {}

fn (mut p AstPrinter) print(e Expr) !string {
	return walk_expr[string](e, mut p)!
}

//< Representing Code ast-printer

//> Representing Code visit-methods
fn (mut p AstPrinter) visit_binary_expr(e BinaryExpr) !string {
	return p.parenthesize(e.operator.lexeme, e.left, e.right)!
}

fn (mut p AstPrinter) visit_grouping_expr(e GroupingExpr) !string {
	return p.parenthesize('group', e.expression)!
}

fn (mut p AstPrinter) visit_literal_expr(e LiteralExpr) !string {
	value := e.value or { return 'nil' }
	return literal_repr(value)
}

fn (mut p AstPrinter) visit_unary_expr(e UnaryExpr) !string {
	return p.parenthesize(e.operator.lexeme, e.right)!
}

//< Representing Code visit-methods

//> Representing Code print-utilities
fn (mut p AstPrinter) parenthesize(name string, exprs ...Expr) !string {
	mut sb := strings.new_builder(64)
	sb.write_string('(')
	sb.write_string(name)
	for expr in exprs {
		sb.write_string(' ')
		sb.write_string(walk_expr[string](expr, mut p)!)
	}
	sb.write_string(')')
	return sb.str()
}

//< Representing Code print-utilities

//> Representing Code printer-main
@[markused]
fn ast_printer_main() {
	expression := BinaryExpr{
		left:     UnaryExpr{
			operator: Token{
				typ:     .minus
				lexeme:  '-'
				literal: none
				line:    1
			}
			right:    LiteralExpr{
				value: f64(123)
			}
		}
		operator: Token{
			typ:     .star
			lexeme:  '*'
			literal: none
			line:    1
		}
		right:    GroupingExpr{
			expression: LiteralExpr{
				value: f64(45.67)
			}
		}
	}

	mut printer := AstPrinter{}
	println(printer.print(expression) or { panic(err) })
}

//< Representing Code printer-main
