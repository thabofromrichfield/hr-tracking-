import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

function countUnquotedBraces(css: string): { open: number; close: number } {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let open = 0;
  let close = 0;
  for (const ch of stripped) {
    if (ch === '{') open += 1;
    if (ch === '}') close += 1;
  }
  return { open, close };
}

test('styles.css and goodfood.css have balanced CSS braces and zero body min-width lock', () => {
  for (const file of ['src/styles.css', 'src/goodfood.css']) {
    const css = read(file);
    const { open, close } = countUnquotedBraces(css);
    assert.equal(open, close, `${file} has unbalanced braces (${open} vs ${close})`);
    assert.equal(
      /body\s*\{[^}]*min-width\s*:\s*360px/i.test(css),
      false,
      `${file} must not lock body min-width to 360px`
    );
  }
});

test('mobile CSS preserves all table columns and sort/period selectors instead of hiding them', () => {
  const styles = read('src/styles.css');
  const goodfood = read('src/goodfood.css');

  assert.equal(
    /\.employee-table\s+th:nth-child\(2\)[\s\S]*?display\s*:\s*none/i.test(styles),
    false
  );
  assert.equal(/\.sort-select\s*\{\s*display\s*:\s*none\s*\}/i.test(styles), false);
  assert.match(goodfood, /\.employee-table\s+th,\s*\.employee-table\s+td\{\s*display:table-cell!important/);
  assert.match(goodfood, /\.sort-select\{\s*display:flex!important/);
});

test('mobile viewport prevents iOS/Android input auto-zoom and keeps 2-row sticky topbar + drawer header', () => {
  const html = read('index.html');
  const appTsx = read('src/App.tsx');
  const goodfood = read('src/goodfood.css');

  assert.match(html, /viewport-fit=cover/);
  assert.match(appTsx, /sidebar-mobile-head/);
  assert.match(appTsx, /topbar-notify-wrap/);
  assert.match(appTsx, /topbar-user-wrap/);
  assert.match(goodfood, /@media\(max-width:768px\)[\s\S]*?font-size:16px!important/);
  assert.match(goodfood, /grid-template-columns:minmax\(0,1fr\)\s+auto\s+auto\s+auto/);
  assert.match(goodfood, /@media\(min-width:901px\)\{\s*html\{height:100%\}\s*body\{height:100%;padding:0;overflow:hidden/);
});
