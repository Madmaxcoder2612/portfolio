// Checks the static site without any dependencies:
//  - every local href/src points at a file that exists
//  - every #anchor points at an id on the page
//  - ids are unique, images have alt text, external links use rel="noopener"
//  - the page has a title, description and lang, and no leftover placeholder text
// Run with: node scripts/check.mjs
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const problems = [];
const fail = (msg) => problems.push(msg);

// ids
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) fail(`duplicate ids: ${[...new Set(dupes)].join(", ")}`);

// links and sources
for (const m of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
  const [, attr, url] = m;
  if (url.startsWith("#")) {
    if (url.length > 1 && !ids.includes(url.slice(1))) fail(`${attr}="${url}" has no matching id`);
  } else if (/^https?:\/\//.test(url)) {
    if (!url.startsWith("https://")) fail(`insecure link: ${url}`);
  } else if (url && !/^(mailto:|data:)/.test(url)) {
    if (!existsSync(join(root, url))) fail(`${attr}="${url}" does not exist`);
  }
}

// external anchors need rel="noopener"
for (const m of html.matchAll(/<a\s[^>]*href="https:\/\/[^"]*"[^>]*>/g)) {
  if (!/rel="[^"]*noopener/.test(m[0]) && !/fonts\.g/.test(m[0])) fail(`external link without rel="noopener": ${m[0].slice(0, 80)}`);
}

// images need alt text
for (const m of html.matchAll(/<img\s[^>]*>/g)) if (!/\salt="/.test(m[0])) fail(`image without alt: ${m[0].slice(0, 80)}`);

// basics
if (!/<html[^>]*\slang="/.test(html)) fail("missing lang on <html>");
if (!/<title>[^<]{5,}<\/title>/.test(html)) fail("missing or empty <title>");
if (!/<meta name="description" content="[^"]{20,}"/.test(html)) fail("missing meta description");
if ((html.match(/<h1[\s>]/g) || []).length !== 1) fail("page must have exactly one <h1>");

// leftover placeholders
for (const word of ["lorem ipsum", "TODO", "FIXME", "your-name", "example.com"]) {
  if (html.toLowerCase().includes(word.toLowerCase())) fail(`placeholder text found: ${word}`);
}

// legal name must be complete wherever it appears in the footer
if (!html.includes("© 2026 Abhishek Vijay Potekar")) fail("footer must carry the full legal name");

if (problems.length) {
  console.error(`FAILED (${problems.length})`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log(`OK: ${ids.length} ids, all links and anchors resolve.`);
