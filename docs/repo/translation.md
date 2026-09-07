# Translation Rules

This spoke governs every change to `book/`. Read it before you edit.

## The prime directive

Nystrom's words do not change. The Markdown in `book/` must stay
byte-identical to the upstream text. This applies to:

- prose, headings, and blockquotes
- asides and their `<span name="...">` anchors
- challenges and design notes
- the `^code` directives themselves, including their `(1 before, 2 after)`
  options

Do not fix his typos. Do not modernise his phrasing. Do not change "Java" to
"V" in the prose. The text describes a Java program and a C program. That is
correct, and it stays.

If a sentence becomes wrong for the V translation, you do not edit it. You
add a translator's note next to it.

## Translator's notes

A translator's note is the only addition this fork makes to `book/`. Use one
when the original text depends on a language feature that V does not share.

Format:

```html
<div class="translators-note">
<span class="translators-note-label">Translator's note</span>

Java's `Object` holds any value, so the book stores a token literal in one.
V has no universal base type. `vlox` uses a sum type instead. The set of
values is fixed at compile time, which is stricter but not weaker here.

</div>
```

Rules for a note:

1. Put the note directly after the paragraph that needs it.
2. Keep it short. Three sentences is usually enough.
3. Explain the difference. Do not repeat what Nystrom already said.
4. Never wrap his text inside the note.
5. One note per difference. Do not merge unrelated points.

## When to write a note

Write a note for these cases:

| Trigger | Example |
| --- | --- |
| Java class or interface hierarchy | The Visitor pattern in Representing Code |
| Java generics or boxing | `Object` literals, `List<Token>` |
| Java exceptions for control flow | `ParseError`, `Return` in Functions |
| Java static nested classes | The generated AST classes |
| C pointers and pointer arithmetic | The `ip` in A Virtual Machine |
| C manual allocation | `reallocate()` in Chunks of Bytecode |
| C macros | `BINARY_OP` in A Virtual Machine |
| C unions and tagged values | `Value` in Types of Values |
| A V feature that removes work | V's `match` covers his `switch` chains |
| A V feature that adds work | V's strict mutability rules |

Do not write a note for a plain syntax difference. A reader can see that
`fn` replaces `void`.

## Part III and manual memory

Part III builds a hash table, a dynamic array, and a mark-sweep collector by
hand in C. V has a `map`, an array type, and a garbage collector already.

This fork ports those chapters faithfully. The hand-written versions stay.
The point of those chapters is the mechanism, not the result. Each such
chapter gets one note at the top that says the same thing: V could supply
this, and the chapter builds it anyway on purpose.

See [Snippets](snippets.md) for how the code reaches the page, and
[the plan](../plan.md) for the chapter-by-chapter list.
