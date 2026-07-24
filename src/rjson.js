export const RELAXED_JSON_VERSION = 'relaxed-json.v0';

export function parse(source, reviver) {
  // preserveOffsets keeps native JSON.parse diagnostics aligned with the
  // positions the caller sees in their original source.
  return JSON.parse(toJson(source, { preserveOffsets: true }), reviver);
}

export function toJson(source, options) {
  const text = requireString(source, 'source');
  const comments = findComments(text);
  // Trailing commas are located against comment-free text so that a comma
  // separated from its closer by a comment is still recognized.
  const commas = findTrailingCommas(render(text, comments, true));
  return render(text, comments.concat(commas), preserveOffsets(options));
}

export function stripComments(source, options) {
  const text = requireString(source, 'source');
  return render(text, findComments(text), preserveOffsets(options));
}

export function stripTrailingCommas(source, options) {
  const text = requireString(source, 'source');
  return render(text, findTrailingCommas(text), preserveOffsets(options));
}

function findComments(text) {
  const ranges = [];
  let state = 'normal';
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (state === 'string') {
      if (ch === '\\') {
        i++;
      } else if (ch === '"') {
        state = 'normal';
      }
      continue;
    }

    if (state === 'line-comment') {
      if (isLineTerminator(ch)) {
        ranges.push({ start, end: i });
        state = 'normal';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        ranges.push({ start, end: i + 2 });
        state = 'normal';
        i++;
      }
      continue;
    }

    if (ch === '"') {
      state = 'string';
    } else if (ch === '/' && next === '/') {
      start = i;
      state = 'line-comment';
      i++;
    } else if (ch === '/' && next === '*') {
      start = i;
      state = 'block-comment';
      i++;
    }
  }

  if (state === 'block-comment') {
    throw new SyntaxError('Unterminated block comment in Relaxed JSON source');
  }
  if (state === 'line-comment') {
    ranges.push({ start, end: text.length });
  }

  return ranges;
}

function findTrailingCommas(text) {
  const ranges = [];
  let state = 'normal';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (state === 'string') {
      if (ch === '\\') {
        i++;
      } else if (ch === '"') {
        state = 'normal';
      }
      continue;
    }

    if (ch === '"') {
      state = 'string';
    } else if (ch === ',' && hasPrecedingValue(text, i) && isFollowedByClose(text, i + 1)) {
      ranges.push({ start: i, end: i + 1 });
    }
  }

  return ranges;
}

/**
 * Rewrite source with the given ranges removed. Line terminators inside a
 * removed range always survive, so output lines map one-to-one onto input
 * lines and removals never join two lines together.
 *
 * When keepOffsets is true every removed character becomes a space, so the
 * result matches the input length. Otherwise removed characters disappear,
 * and any line a removal touched is right-trimmed - dropped entirely if
 * nothing but whitespace is left. Lines no removal touched are untouched.
 */
function render(text, ranges, keepOffsets) {
  const removed = new Uint8Array(text.length);
  for (const range of ranges) removed.fill(1, range.start, range.end);

  let out = '';
  let line = '';
  let touched = false;

  for (let i = 0; i <= text.length; i++) {
    const ch = i < text.length ? text[i] : undefined;

    if (ch !== undefined && !isLineTerminator(ch)) {
      if (removed[i]) {
        touched = true;
        if (keepOffsets) line += ' ';
      } else {
        line += ch;
      }
      continue;
    }

    if (touched && !keepOffsets) {
      const trimmed = trimLineEnd(line);
      if (trimmed === '') {
        // The line held nothing but the removed text and its indentation.
        if (ch === '\r' && text[i + 1] === '\n') i++;
        line = '';
        touched = false;
        continue;
      }
      line = trimmed;
    }

    out += line;
    if (ch !== undefined) out += ch;
    line = '';
    touched = false;
  }

  return out;
}

function hasPrecedingValue(text, end) {
  for (let i = end - 1; i >= 0; i--) {
    const ch = text[i];
    if (isJsonWhitespace(ch)) continue;
    // A comma only ever trails a value, so `[,]` and `{,}` stay invalid.
    return ch !== '[' && ch !== '{' && ch !== ',';
  }
  return false;
}

function isFollowedByClose(text, start) {
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (isJsonWhitespace(ch)) continue;
    return ch === '}' || ch === ']';
  }
  return false;
}

function trimLineEnd(line) {
  let end = line.length;
  while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t')) end--;
  return line.slice(0, end);
}

function isJsonWhitespace(ch) {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
}

function isLineTerminator(ch) {
  return ch === '\n' || ch === '\r';
}

function preserveOffsets(options) {
  return options !== undefined && options !== null && options.preserveOffsets === true;
}

function requireString(value, name) {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string`);
  }
  return value;
}
