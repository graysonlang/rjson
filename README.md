# Relaxed JSON

`@graysonlang/rjson` parses Relaxed JSON: standard JSON values with comments and trailing commas accepted before native `JSON.parse` validation.

It is intentionally not JSON5. Object keys still need double quotes, strings still need double quotes, numbers are still JSON numbers, and values are still `true`, `false`, and `null`.

## Install

```sh
npm install @graysonlang/rjson
```

## Usage

```js
import { parse, toJson } from '@graysonlang/rjson';

const data = parse(`
{
  // Comments are allowed.
  "name": "lamp",
  "words": ["lamp", "lantern",],
}
`);

console.log(data.name);
console.log(toJson('{ "ok": true, }'));
```

## Comments

Both JavaScript comment styles are accepted anywhere a token boundary is legal.

```js
parse(`{
  // A line comment on its own line.
  "name": "demo",

  /* A block comment. */
  "enabled": true, // Or at the end of a line.

  /*
    A block comment can span
    as many lines as you like.
  */
  "items": ["red", "blue"],

  "value": /* even between a key and its value */ 42
}`);
```

### Mixing the two styles

Whichever comment opens first runs to its own terminator. The other style's markers inside it are just text.

```js
// A // inside a block comment does not close it early.
parse('{ /* contains // marker */ "a": 1 }');           // -> { a: 1 }

// A /* or */ inside a line comment opens and closes nothing.
parse('{ // contains /* and */ markers\n"a": 1 }');     // -> { a: 1 }

// So a line comment still ends at the newline, not at some later */.
parse('{ "a": 1 // /* never opened\n, "b": 2 }');       // -> { a: 1, b: 2 }
```

Block comments of the *same* style do not nest. The first `*/` closes the comment, and whatever follows has to be valid JSON on its own:

```js
parse('{ /* outer /* inner */ "a": 1 }');   // -> { a: 1 }
parse('{ /* outer /* inner */ */ "a": 1 }'); // SyntaxError: the stray */ is not JSON
```

### Comments and strings

Comment markers inside a string are data. Strings are tracked through the scan, including escapes, so nothing inside quotes is ever treated as a comment.

```js
parse('{ "a": "// not a comment" }');            // -> { a: '// not a comment' }
parse('{ "a": "/* also not */" }');              // -> { a: '/* also not */' }

// An escaped quote does not end the string.
parse('{ "a": "esc \\" // still string" }');     // -> { a: 'esc " // still string' }

// An escaped backslash does end it, so the next quote is real.
parse('{ "a": "back \\\\", "b": 1 }');           // -> { a: 'back \\', b: 1 }

// Escape forms that spell comment markers stay inside the string.
parse('{ "a": "\\/\\/ escaped solidus" }');      // -> { a: '// escaped solidus' }
parse('{ "a": "\\u002f\\u002f unicode" }');      // -> { a: '// unicode' }
```

The reverse holds too: a quote inside a comment cannot open a string.

```js
parse('{ /* "quoted */ "a": 1 }');               // -> { a: 1 }
parse('{ "a": 1 // "unclosed\n, "b": 2 }');      // -> { a: 1, b: 2 }
```

## Trailing commas

A comma directly before `}` or `]` is dropped, including when a comment sits between them.

```js
parse('[1, 2, 3,]');                  // -> [1, 2, 3]
parse('{ "a": 1, }');                 // -> { a: 1 }
parse('{ "a": 1, /* between */ }');   // -> { a: 1 }
parse('{ "a": 1, // between\n}');     // -> { a: 1 }
```

A comma only ever *trails a value*, so these stay errors:

```js
parse('[,]');      // SyntaxError
parse('{,}');      // SyntaxError
parse('[1,,]');    // SyntaxError
parse('[1,,2]');   // SyntaxError
```

## Output

`toJson` returns clean strict JSON. Comments and trailing commas are deleted, whitespace they orphan at the end of a line is trimmed, and a line that held nothing but a comment is dropped. Lines no removal touched are passed through byte for byte, so your formatting survives.

```js
toJson('{\n  // comment only\n  "a": 1,\n}');
// '{\n  "a": 1\n}'
```

Pass `preserveOffsets` when you would rather keep character positions than get tidy text. Every removed character becomes a space, so the result has the same length as the input and each remaining character keeps its original offset. That makes native `JSON.parse` diagnostics point at the right place in the original source.

```js
toJson('{ "a": 1, /* c */ }', { preserveOffsets: true });
// '{ "a": 1          }'   <- same length as the input
```

`parse` uses `preserveOffsets` internally for exactly that reason. Comments are not preserved for round-trip editing in either mode.

## Still rejected

- unquoted object keys
- single-quoted strings
- `undefined`, `NaN`, and `Infinity`
- hex numbers
- JavaScript expressions
- nested block comments of the same style
- leading or doubled commas
- macros, imports, and include directives

## Relation to JSONC and JSON5

JSONC is JSON with comments, the dialect VS Code uses for `settings.json` and TypeScript uses for `tsconfig.json`. It has no formal specification; the reference implementation is [`jsonc-parser`](https://www.npmjs.com/package/jsonc-parser).

rjson accepts the same language as JSONC with trailing commas enabled. Across 78 inputs covering both comment styles, comments interacting with strings and escapes, trailing and stray commas, number and string forms, and malformed input, no difference in accept or reject, or in the parsed value, was found against `jsonc-parser` 3.3.1 run with `allowTrailingComma: true`.

The differences are in behaviour rather than in what is accepted:

- Trailing commas are always accepted here. In `jsonc-parser` they are opt-in through `allowTrailingComma`, which is off by default, so its out-of-the-box behaviour rejects `{ "a": 1, }`.
- Invalid input throws here. `jsonc-parser` is error-tolerant and returns a best-effort value alongside a list of errors, so `{ key: 1, "b": 2 }` yields `{ "b": 2 }` and three errors. Code that does not inspect that list silently loses the malformed member.
- `jsonc-parser` is the larger tool, with a scanner, a syntax tree, and edit and format operations. rjson is a dependency-free parser plus the source-to-source `toJson`, including its offset-preserving mode.

JSON5 is a much wider dialect, and rjson is intentionally not it. On top of the comments and trailing commas allowed here, JSON5 also accepts unquoted object keys, single-quoted strings, strings continued across lines with a trailing backslash, hex numbers, numbers with a leading or trailing decimal point, numbers with an explicit plus sign, and `NaN` and `Infinity`. All of those are rejected here.

Not everything under [Still rejected](#still-rejected) is a point of difference with JSON5, though: `undefined`, JavaScript expressions, nested block comments of the same style, and leading or doubled commas are rejected by JSON5 as well.

## API

```ts
parse(source, reviver?) -> unknown
toJson(source, options?) -> string
stripComments(source, options?) -> string
stripTrailingCommas(source, options?) -> string

RELAXED_JSON_VERSION -> string   // dialect tag, currently 'relaxed-json.v0'
```

`options` is `{ preserveOffsets?: boolean }`, defaulting to `false`.

`stripTrailingCommas` is deliberately conservative when used on its own: it will not look past a comment to find a closing brace, because it has no idea the comment is there. Use `toJson` to get both relaxations applied in the right order.

## Structure

- [src/rjson.js](src/rjson.js) - dependency-free parser and source transformer.
- [src/rjson.d.ts](src/rjson.d.ts) - hand-written TypeScript declarations.
- [demo/](demo/) - tiny browser demo bundled with esbuild through ESP.
- [scripts/](scripts/) - build, smoke test, and pack-test scripts.

Changes are tracked in [CHANGELOG.md](CHANGELOG.md), and the publish steps are in [RELEASING.md](RELEASING.md).

## License

MIT - see [LICENSE.md](LICENSE.md).
