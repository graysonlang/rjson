import assert from 'node:assert/strict';

import {
  RELAXED_JSON_VERSION,
  parse,
  stripComments,
  stripTrailingCommas,
  toJson,
} from '../src/rjson.js';

const source = `{
  // line comment with "quotes" and /* markers */
  "name": "Relaxed JSON",
  "markers": "// not a comment /* also not */",
  "items": [
    "red",
    "blue", // trailing comma follows
  ],
  "nested": {
    "ok": true,
  },
}`;

assert.equal(RELAXED_JSON_VERSION, 'relaxed-json.v0');

assert.deepEqual(parse(source), {
  name: 'Relaxed JSON',
  markers: '// not a comment /* also not */',
  items: ['red', 'blue'],
  nested: { ok: true },
});

// --- comment forms ---------------------------------------------------------

// Block comments, anywhere a token boundary is legal.
assert.deepEqual(parse('/* leading */ { "a": 1 } /* trailing */'), { a: 1 });
assert.deepEqual(parse('{ "a" /* key */ : /* value */ 1 }'), { a: 1 });
assert.deepEqual(parse('[ /* only */ ]'), []);
assert.deepEqual(parse('{/*a*//*b*/"x":1}'), { x: 1 });

// End-of-line comments, including one that ends at EOF without a newline.
assert.deepEqual(parse('{ "a": 1 // trailing\n}'), { a: 1 });
assert.deepEqual(parse('{ "a": 1 }\n// end of file'), { a: 1 });
assert.deepEqual(parse('{\r\n// crlf comment\r\n"a": 1,\r\n}'), { a: 1 });

// Multiline block comments.
assert.deepEqual(parse('{\n/* line one\n   line two\n   line three */\n"a": 1\n}'), { a: 1 });

// Mixing the two styles: whichever comment opens first runs to its own
// terminator, and the other style's markers inside it are just text.

// A line comment inside a block comment.
assert.deepEqual(parse('{ /* contains // marker */ "a": 1 }'), { a: 1 });
assert.deepEqual(parse('{\n/* block\n   // line marker inside\n   still block */\n"a": 1\n}'), { a: 1 });

// A block comment inside a line comment. The */ does not terminate anything,
// and the /* does not open anything, so the newline still ends the comment.
assert.deepEqual(parse('{ // contains /* marker\n"a": 1 }'), { a: 1 });
assert.deepEqual(parse('{ // contains */ marker\n"a": 1 }'), { a: 1 });
assert.deepEqual(parse('{ // a whole /* block */ inline\n"a": 1 }'), { a: 1 });

// A // that opens inside a block comment does not swallow the block's close.
assert.deepEqual(parse('{ /* // */ "a": 1 }'), { a: 1 });
// A /* that opens inside a line comment does not swallow later lines.
assert.deepEqual(parse('{ "a": 1 // /* never opened\n, "b": 2 }'), { a: 1, b: 2 });

// Same-style block comments do not nest: the first */ closes the comment, and
// whatever follows has to be valid JSON on its own.
assert.throws(() => parse('{ /* outer /* inner */ */ "a": 1 }'), SyntaxError);
assert.deepEqual(parse('{ /* outer /* inner */ "a": 1 }'), { a: 1 });
assert.throws(() => stripComments('{ /* unfinished'), /Unterminated block comment/u);

// --- strings and escapes --------------------------------------------------

// Comment markers inside strings are data, not comments.
assert.deepEqual(parse('{ "a": "// not a comment" }'), { a: '// not a comment' });
assert.deepEqual(parse('{ "a": "/* also not */" }'), { a: '/* also not */' });
assert.deepEqual(parse('{ "a": "unclosed /* block" }'), { a: 'unclosed /* block' });

// An escaped quote does not end the string, so markers after it stay data.
assert.deepEqual(parse(String.raw`{ "a": "esc \" // still string" }`), { a: 'esc " // still string' });
assert.deepEqual(parse(String.raw`{ "a": "esc \" /* still */ string" }`), { a: 'esc " /* still */ string' });

// An escaped backslash does end the string - the quote after it is real.
assert.deepEqual(parse(String.raw`{ "a": "back \\", "b": 1 }`), { a: 'back \\', b: 1 });
assert.deepEqual(parse(String.raw`["x\\",]`), ['x\\']);
assert.deepEqual(parse(String.raw`{ "a": "z\\" /* c */, "b": 2, }`), { a: 'z\\', b: 2 });

// JSON escape forms that spell comment markers stay inside the string.
assert.deepEqual(parse(String.raw`{ "a": "\/\/ escaped solidus" }`), { a: '// escaped solidus' });
assert.deepEqual(parse(String.raw`{ "a": "\/* not a comment */" }`), { a: '/* not a comment */' });
// Unicode escapes spelling / and " are six source characters, so the scanner
// must step over the \u without treating 002f or 0022 as structure.
const uSlash = '\\u002f';
const uQuote = '\\u0022';
assert.deepEqual(parse(`{ "a": "${uSlash}${uSlash} unicode" }`), { a: '// unicode' });
assert.deepEqual(parse(`{ "a": "${uQuote} not a terminator" }`), { a: '" not a terminator' });
assert.deepEqual(parse(`{ "a": "${uSlash}* not a comment *${uSlash}" }`), { a: '/* not a comment */' });
assert.deepEqual(parse(String.raw`{ "a\/b": 1 }`), { 'a/b': 1 });

// Quotes inside comments are text, and cannot open a string.
assert.deepEqual(parse('{ /* "quoted */ "a": 1 }'), { a: 1 });
assert.deepEqual(parse('{ // "quoted\n"a": 1 }'), { a: 1 });
assert.deepEqual(parse('{ "a": 1 // "unclosed\n, "b": 2 }'), { a: 1, b: 2 });
assert.deepEqual(parse('{ /* it\'s fine */ "a": 1 }'), { a: 1 });

// Escapes survive both output modes intact.
const escaped = String.raw`{"a": "esc \" // x", /* c */ "b": "y\\",}`;
assert.equal(toJson(escaped, { preserveOffsets: true }).length, escaped.length);
assert.deepEqual(JSON.parse(toJson(escaped)), { a: 'esc " // x', b: 'y\\' });

// --- trailing commas -------------------------------------------------------

assert.deepEqual(parse('[1, 2, 3,]'), [1, 2, 3]);
assert.deepEqual(parse('{ "a": 1, }'), { a: 1 });
assert.deepEqual(parse('[[1,],[2,],]'), [[1], [2]]);
assert.deepEqual(parse('{ "a": 1, /* between */ }'), { a: 1 });
assert.deepEqual(parse('{ "a": 1, // between\n}'), { a: 1 });
assert.deepEqual(parse('{ "a": "}", "b": 1, }'), { a: '}', b: 1 });

// A comma only ever trails a value.
assert.throws(() => parse('[,]'), SyntaxError);
assert.throws(() => parse('{,}'), SyntaxError);
assert.throws(() => parse('[ , ]'), SyntaxError);
assert.throws(() => parse('[1,,]'), SyntaxError);
assert.throws(() => parse('[1,,2]'), SyntaxError);

// --- output shape ----------------------------------------------------------

// Default output is clean: no whitespace is left where a comment used to be.
const clean = toJson(source);
assert.doesNotMatch(clean, /[ \t]+$/mu, 'clean output must not have trailing whitespace');
assert.doesNotMatch(clean, /line comment/u);
assert.deepEqual(JSON.parse(clean), parse(source));
assert.equal(
  toJson('{\n  // comment only\n  "a": 1,\n}'),
  '{\n  "a": 1\n}',
  'a comment-only line is dropped entirely',
);
assert.equal(toJson('{\r\n  // comment only\r\n  "a": 1\r\n}'), '{\r\n  "a": 1\r\n}');

// Lines that no removal touched are passed through byte for byte, including
// their own trailing whitespace. Nothing here is a trailing comma.
const untouched = '{\n  "a":   1  ,\n  "b": 2   \n}';
assert.equal(toJson(untouched), untouched);

// preserveOffsets keeps native JSON.parse diagnostics aligned with the source.
const padded = toJson(source, { preserveOffsets: true });
assert.equal(padded.length, source.length);
assert.match(padded, /"markers": "\/\/ not a comment \/\* also not \*\/"/u);
assert.doesNotMatch(padded, /line comment/u);
assert.deepEqual(JSON.parse(padded), parse(source));

const commented = '["//", /* keep newline\ncomment */ true]';
assert.equal(stripComments(commented, { preserveOffsets: true }).length, commented.length);
assert.deepEqual(JSON.parse(toJson(commented)), ['//', true]);

// Both strippers honor the same option. Interior whitespace around a removed
// comment is left alone - only whitespace orphaned at a line end is trimmed.
assert.equal(stripComments('{ /* c */ "a": 1 }'), '{  "a": 1 }');
assert.equal(stripComments('{ /* c */ "a": 1 }', { preserveOffsets: true }), '{         "a": 1 }');
assert.equal(stripTrailingCommas('{ "a": 1, }'), '{ "a": 1 }');
assert.equal(stripTrailingCommas('{ "a": 1, }', { preserveOffsets: true }), '{ "a": 1  }');

// stripTrailingCommas alone is conservative: it will not look past a comment.
assert.equal(stripTrailingCommas('{ "a": 1, /* c */ }'), '{ "a": 1, /* c */ }');

// --- rejections ------------------------------------------------------------

assert.throws(() => parse('{ key: 1 }'), SyntaxError);
assert.throws(() => parse('{ \'key\': 1 }'), SyntaxError);
assert.throws(() => parse('{ "value": NaN }'), SyntaxError);
assert.throws(() => parse('{ "x": 0x10 }'), SyntaxError);
assert.throws(() => parse('{ "a": undefined }'), SyntaxError);
assert.throws(() => parse('{ "a": 1 + 2 }'), SyntaxError);
assert.throws(() => parse('{ "a": "unterminated'), SyntaxError);

for (const bad of [null, undefined, 1, {}, []]) {
  assert.throws(() => toJson(bad), TypeError);
  assert.throws(() => stripComments(bad), TypeError);
  assert.throws(() => stripTrailingCommas(bad), TypeError);
}

// --- misc ------------------------------------------------------------------

assert.equal(parse('{ "n": 1 }', (key, value) => key === 'n' ? 2 : value).n, 2);
assert.deepEqual(parse('1'), 1);
assert.deepEqual(parse('"s"'), 's');
assert.deepEqual(parse('null'), null);
assert.equal(parse('['.repeat(200) + ']'.repeat(200)).length, 1);

console.log('rjson smoke tests passed');
