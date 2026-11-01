import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SITE = new URL('../site/', import.meta.url).pathname;

test('built site: title, viewport, manifest, icons, local assets only, no placeholders', () => {
  assert.ok(existsSync(join(SITE, 'index.html')), 'run npm run build first');
  const html = readFileSync(join(SITE, 'index.html'), 'utf8');
  assert.match(html, /<title>Nukkad Knockout/);
  assert.match(html, /name="viewport" content="width=device-width/);
  assert.match(html, /rel="manifest" href="manifest.webmanifest"/);
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = m[1];
    if (/^https?:/.test(ref)) assert.fail('remote asset: ' + ref);
    const p = join(SITE, ref.replace(/^\.\//, ''));
    assert.ok(existsSync(p), 'missing local asset ' + ref);
  }
  assert.doesNotMatch(html, /lorem ipsum|TODO|PLACEHOLDER/i);
  for (const id of ['game', 'title', 'select', 'pause', 'result', 'touch', 'rotate']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /fictional parodies; not affiliated with any real person/);
  const man = JSON.parse(readFileSync(join(SITE, 'manifest.webmanifest'), 'utf8'));
  assert.equal(man.orientation, 'landscape');
  for (const ic of man.icons) assert.ok(existsSync(join(SITE, ic.src)));
  assert.ok(existsSync(join(SITE, 'sw.js')));
  const js = readdirSync(join(SITE, 'assets')).filter((f) => f.endsWith('.js'));
  assert.equal(js.length, 1);
  const code = readFileSync(join(SITE, 'assets', js[0]), 'utf8');
  for (const name of ['CHAIWALA CHHOTU', 'HEYY ANISH', 'CARRY MINTU', 'CHAPPAL BOOMERANG', 'NUKKAD JN']) assert.ok(code.includes(name), name);
  assert.doesNotMatch(code, /\.mp3|\.ogg|googletagmanager|fonts\.googleapis/);
});
