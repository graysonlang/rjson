import index from './index.html';
import { parse, toJson } from '../src/rjson.js';

export function getFilePaths() {
  return { index };
}

const sample = `{
  // A line comment. It can hold /* and */ harmlessly.
  "name": "demo",

  /* A block comment. */
  "enabled": true, // ...or sit at the end of a line.

  /*
    A block comment can span lines, and a // inside it
    is just text - the comment runs until its own close.
  */
  "items": [
    "red",
    "blue", // Trailing commas are fine.
  ],

  "markers": "// these stay put /* because they are in a string */",
}`;

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

const source = document.querySelector('#source');
const strictOutput = document.querySelector('#strict-output');
const valueOutput = document.querySelector('#value-output');
const status = document.querySelector('#status');
const preserveOffsetsToggle = document.querySelector('#preserve-offsets');

source.value = sample;
// Every edit re-renders, so there is nothing for a parse button to do.
source.addEventListener('input', render);
preserveOffsetsToggle.addEventListener('change', render);
render();

function render() {
  const text = source.value;

  // toJson and parse are reported separately, so source that rewrites cleanly
  // but is not valid JSON still shows what the rewrite produced.
  let strict;
  try {
    strict = toJson(text, { preserveOffsets: preserveOffsetsToggle.checked });
  } catch (error) {
    write(strictOutput, describe(error));
    write(valueOutput, '');
    setStatus('Error', 'bad');
    return;
  }

  write(strictOutput, strict, true);

  try {
    // parse rewrites with preserveOffsets internally, so any position in this
    // error refers to the original source rather than the rewritten text.
    write(valueOutput, JSON.stringify(parse(text), null, 2));
    setStatus('Parsed', 'ok');
  } catch (error) {
    write(valueOutput, describe(error));
    setStatus('Invalid JSON', 'bad');
  }
}

// Whitespace runs keep their real characters and are only wrapped so CSS can
// paint a mark over them. Nothing decorative enters the text, so copying the
// pane gives back exactly what toJson returned. Wrapping means emitting markup,
// hence the escape. Error text and the parsed value go through textContent.
function write(element, text, markWhitespace = false) {
  if (!markWhitespace) {
    element.textContent = text;
    return;
  }
  // Spaces are one cell each, so a run of them tiles. Tabs are not: each one
  // advances to the next tab stop, so consecutive tabs can differ in width and
  // a run of them cannot tile. Each tab therefore gets its own span to draw in.
  element.innerHTML = escapeHtml(text).replace(
    / +|\t/gu,
    run => `<span class="${run === '\t' ? 'ws-tab' : 'ws-space'}">${run}</span>`,
  );
}

function escapeHtml(text) {
  return text.replace(/[&<>]/gu, ch => HTML_ESCAPES[ch]);
}


function setStatus(label, tone) {
  status.textContent = label;
  status.className = `status ${tone}`;
}

function describe(error) {
  return error instanceof Error ? error.message : String(error);
}
