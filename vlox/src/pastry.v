module main

// Dead example code from §5.3, illustrating the Visitor pattern on pastries
// before it's applied to Expr. Nystrom's GenerateAst.java keeps this outside
// the lox package for the same reason: it's teaching material, never called.

//> Representing Code pastries
type Pastry = Beignet | Cruller

struct Beignet {}

struct Cruller {}

//< Representing Code pastries

//> Representing Code pastry-visitor
interface PastryVisitor {
	visit_beignet(b Beignet)
	visit_cruller(c Cruller)
}

//< Representing Code pastry-visitor

//> Representing Code pastry-accept
@[markused]
fn walk_pastry(p Pastry, mut visitor PastryVisitor) {
	match p {
		//> Representing Code beignet-accept
		Beignet { visitor.visit_beignet(p) }
		//< Representing Code beignet-accept
		//> Representing Code cruller-accept
		Cruller { visitor.visit_cruller(p) }
		//< Representing Code cruller-accept
	}
}

//< Representing Code pastry-accept
