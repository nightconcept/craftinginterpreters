module main

//> Representing Code call-define-ast
type Expr = BinaryExpr | GroupingExpr | LiteralExpr | UnaryExpr

struct BinaryExpr {
	left     Expr
	operator Token
	right    Expr
}

struct GroupingExpr {
	expression Expr
}

struct LiteralExpr {
	value ?Literal
}

struct UnaryExpr {
	operator Token
	right    Expr
}

//< Representing Code call-define-ast

//> Representing Code call-define-visitor
interface ExprVisitor[R] {
mut:
	//> Representing Code define-visitor
	visit_binary_expr(e BinaryExpr) !R
	visit_grouping_expr(e GroupingExpr) !R
	visit_literal_expr(e LiteralExpr) !R
	visit_unary_expr(e UnaryExpr) !R
	//< Representing Code define-visitor
}

//< Representing Code call-define-visitor

//> Representing Code base-accept-method
fn walk_expr[R](e Expr, mut visitor ExprVisitor[R]) !R {
	return match e {
		//> Representing Code accept-method
		BinaryExpr { visitor.visit_binary_expr(e)! }
		GroupingExpr { visitor.visit_grouping_expr(e)! }
		LiteralExpr { visitor.visit_literal_expr(e)! }
		UnaryExpr { visitor.visit_unary_expr(e)! }
		//< Representing Code accept-method
	}
}

//< Representing Code base-accept-method
