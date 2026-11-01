// Balance check: every fighter vs every fighter, NORMAL CPU vs NORMAL CPU. Run: node tools/balance.mjs

import { Game } from '../src/game.js'; import { CPU } from '../src/ai.js'; import { ROSTER } from '../src/roster.js';
const wins = {}; ROSTER.forEach(c => wins[c.id] = [0, 0]); let secs = 0, games = 0;
for (const a of ROSTER) for (const b of ROSTER) { if (a === b) continue;
  for (let s = 1; s <= 6; s++) {
  const g = new Game({ p1: a, p2: b, seed: s * 31 + a.id.length, stage: ['tapri','terrace','platform'][s % 3] });
  const ai = [new CPU('normal'), new CPU('normal')]; let n = 0;
  while (g.phase !== 'over' && n < 60 * 60 * 8) { g.step([ai[0].think(g.f[0], g.f[1], g), ai[1].think(g.f[1], g.f[0], g)]); n++; }
  secs += n / 60; games++;
  const w = g.winner; if (w === 0) wins[a.id][0]++; else if (w === 1) wins[b.id][0]++;
  wins[a.id][1]++; wins[b.id][1]++;
}}
for (const [k, [w, n]] of Object.entries(wins)) console.log(k.padEnd(10), (100 * w / n).toFixed(0) + '%');
console.log('avg match sec', (secs / games).toFixed(0));
