const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
test('leather-map revision keeps familiar cards, stamp and filters while darkening the paper',()=>{
  const css=['style.css','leather.css'].map(f=>fs.readFileSync(path.join(root,'src/assets',f),'utf8')).join('\n');
  const render=fs.readFileSync(path.join(root,'lib/render.js'),'utf8');
  assert.match(css,/--leather:\s*#[0-9a-fA-F]{6}/);
  assert.match(css,/\.masthead\s*\{[^}]*var\(--leather\)/);
  assert.match(css,/\.page-shell\s*\{[^}]*background:/);
  assert.match(css,/\.event-card\s*\{[^}]*background:/);
  assert.match(css,/\.card-art img\s*\{[^}]*sepia\(/);
  assert.match(css,/\.detail-art img\s*\{[^}]*filter:\s*none/);
  assert.match(render,/class="date-stamp"/);
  assert.match(render,/data-time-filter=/);
});
