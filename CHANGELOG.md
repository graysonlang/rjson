# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-24

First release.

### Added

- `parse(source, reviver?)` - Relaxed JSON parsing on top of native `JSON.parse`.
- `toJson(source, options?)` - Relaxed JSON source rewritten as strict JSON text.
- `stripComments(source, options?)` and `stripTrailingCommas(source, options?)` for applying a single relaxation on its own.
- `RELAXED_JSON_VERSION` dialect tag, currently `relaxed-json.v0`.
- Hand-written TypeScript declarations, verified against strict `tsc` as an installed package by `npm run deploy-test`.

### Relaxations

- Line comments, block comments, and multiline block comments, accepted anywhere a token boundary is legal.
- Trailing commas before `}` and `]`, including when a comment separates the comma from its closer.

Comment markers inside strings are data, quotes inside comments cannot open a string, and escape sequences - `\"`, `\\`, `\/`, `\uXXXX` - are tracked so nothing inside quotes is ever mistaken for a comment. Block comments of the same style do not nest: the first `*/` closes the comment, matching C, JavaScript, and JSON5.

### Notes

- `toJson` returns clean output by default. Comments and trailing commas are deleted, whitespace they orphan at the end of a line is trimmed, and a line holding nothing but a comment is dropped. Lines untouched by a removal are passed through byte for byte.
- `toJson(source, { preserveOffsets: true })` pads instead of deleting, so the result matches the input length and every remaining character keeps its original offset. `parse` uses this internally to keep native `JSON.parse` diagnostics aligned with the caller's source.
- A comma is only removed when it actually trails a value, so `[,]`, `{,}`, `[1,,]`, and `[1,,2]` remain syntax errors.

[Unreleased]: https://github.com/graysonlang/rjson/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/graysonlang/rjson/releases/tag/v1.0.0
