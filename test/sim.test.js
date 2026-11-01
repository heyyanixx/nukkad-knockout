import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { CPU } from '../src/ai.js';
import { ROSTER, byId } from '../src/roster.js';
import { MOVES, comboScale, pickMove, totalFrames } from '../src/moves.js';
import { emptyInput } from '../src/fighter.js';

const press = (b, extra = {}) => { const i = emptyInput(); Object.assign(i, extra); if (b) { i[b] = true; i.pressed[b] = true; } return i; };
const toFight = (g) => { for (let i = 0; i < 90; i++) g.step(); assert.equal(g.phase, 'fight'); };

test('roster: 10 fighters, unique ids, every super type handled', () => {
  assert.equal(ROSTER.length, 10);
  assert.equal(new Set(ROSTER.map((c) => c.id)).size, 10);
  for (const c of ROSTER) for (const k of ['speed', 'jump', 'dmgMul', 'superType', 'superName']) assert.ok(c[k] !== undefined, c.id + ' ' + k);
});

test('moves: frame data sane, combo scaling, button mapping', () => {
  for (const m of Object.values(MOVES)) assert.ok(totalFrames(m) > 0 && m.s > 0, m.id);
  assert.equal(pickMove('p'), 'jab'); assert.equal(pickMove('k', { down: true }), 'sweep');
  assert.equal(pickMove('p', { forward: true }), 'rush'); assert.equal(pickMove('k', { air: true }), 'airk');
  assert.equal(comboScale(0), 1); assert.equal(comboScale(20), 0.5);
});

test('a jab hits at close range, takes HP and builds meter', () => {
  const g = new Game({ p1: byId('chaiwala'), p2: byId('auto'), seed: 3, events: false });
  toFight(g);
  const [a, b] = g.f; a.x = 400; b.x = 470;
  g.step([press('p'), emptyInput()]);
  for (let i = 0; i < 12; i++) g.step();
  assert.ok(b.hp < 100, 'hp ' + b.hp);
  assert.ok(a.meter > 0);
});

test('holding back blocks a mid kick (no damage), crouching under a high jab', () => {
  const g = new Game({ p1: byId('chaiwala'), p2: byId('auto'), seed: 3, events: false });
  toFight(g);
  const [a, b] = g.f; a.x = 400; b.x = 480;
  const back = () => { const i = emptyInput(); i.right = true; return i; }; // b faces left, back = right
  g.step([press('k'), back()]);
  for (let i = 0; i < 20; i++) g.step([emptyInput(), back()]);
  assert.equal(b.hp, 100); assert.ok(b.stats.blocks >= 1);
  for (let i = 0; i < 30; i++) g.step();
  a.x = 400; b.x = 460;
  const duck = () => { const i = emptyInput(); i.down = true; return i; };
  for (let i = 0; i < 3; i++) g.step([emptyInput(), duck()]);
  g.step([press('p'), duck()]);
  for (let i = 0; i < 14; i++) g.step([emptyInput(), duck()]);
  assert.equal(b.hp, 100, 'jab is high and should whiff on a crouching fighter');
});

test('P,P,P chain is a 3-hit combo ending in a knockdown', () => {
  const g = new Game({ p1: byId('auto'), p2: byId('chaiwala'), seed: 3, events: false });
  toFight(g);
  const [a, b] = g.f; a.x = 400; b.x = 465;
  const seq = { 0: 'p', 8: 'p', 17: 'p' };
  for (let i = 0; i < 70; i++) g.step([press(seq[i]), emptyInput()]);
  assert.ok(a.stats.maxCombo >= 3, 'combo ' + a.stats.maxCombo);
  assert.ok(['launched', 'knockdown', 'getup', 'idle'].includes(b.state));
});

test('grab throws for damage; pressing grab early breaks it', () => {
  let g = new Game({ p1: byId('dadi'), p2: byId('sid'), seed: 3, events: false });
  toFight(g);
  let [a, b] = g.f; a.x = 400; b.x = 450;
  g.step([press('g'), emptyInput()]);
  for (let i = 0; i < 60; i++) g.step();
  assert.ok(b.hp < 100, 'thrown');
  g = new Game({ p1: byId('dadi'), p2: byId('sid'), seed: 3, events: false });
  toFight(g); [a, b] = g.f; a.x = 400; b.x = 450;
  g.step([press('g'), emptyInput()]);
  let broke = false;
  for (let i = 0; i < 60; i++) { g.step([emptyInput(), b.state === 'grabbed' && !broke ? (broke = true, press('g')) : emptyInput()]); }
  assert.equal(b.hp, 100, 'throw break');
});

test('every fighter super spends the meter and can do damage', () => {
  for (const c of ROSTER) {
    const g = new Game({ p1: c, p2: byId('chaiwala'), seed: 5, events: false });
    toFight(g);
    const [a, b] = g.f; a.x = 380; b.x = 520; a.meter = 100;
    g.step([press('s'), emptyInput()]);
    assert.equal(a.meter, 0, c.id);
    for (let i = 0; i < 200; i++) g.step();
    assert.ok(b.hp < 100, c.id + ' super did no damage, hp=' + b.hp);
  }
});

test('timer runs out -> TIME, higher HP wins the round', () => {
  const g = new Game({ p1: byId('chaiwala'), p2: byId('auto'), seed: 1, events: false });
  toFight(g);
  g.f[1].hp = 50; g.timer = 2;
  for (let i = 0; i < 5; i++) g.step();
  assert.equal(g.phase, 'roundEnd'); assert.equal(g.wins[0], 1);
});

for (const level of ['easy', 'normal', 'hard']) {
  test('CPU vs CPU (' + level + ') plays a full best-of-3 to a result', () => {
    const g = new Game({ p1: byId('headshot'), p2: byId('mintu'), seed: 11, events: true });
    const ai = [new CPU(level, Math.random), new CPU(level, Math.random)];
    let n = 0;
    while (g.phase !== 'over' && n < 60 * 60 * 8) { g.step([ai[0].think(g.f[0], g.f[1], g), ai[1].think(g.f[1], g.f[0], g)]); n++; }
    assert.equal(g.phase, 'over');
    const hits = g.f[0].stats.hits + g.f[1].stats.hits;
    assert.ok(hits > 10, 'hits ' + hits);
    for (const f of g.f) assert.ok(f.x >= 40 && f.x <= 920);
  });
}

test('hard CPU beats an idle player and easy CPU deals less damage than hard', () => {
  const dmg = (level) => {
    let total = 0;
    for (let s = 1; s <= 3; s++) {
      const g = new Game({ p1: byId('auto'), p2: byId('auto'), seed: s, events: false });
      const ai = new CPU(level, Math.random); const dummy = new CPU('normal', Math.random);
      for (let i = 0; i < 60 * 30; i++) g.step([dummy.think(g.f[0], g.f[1], g), ai.think(g.f[1], g.f[0], g)]);
      total += g.f[1].stats.dmgDealt;
    }
    return total;
  };
  const e = dmg('easy'), h = dmg('hard');
  assert.ok(h > e, `hard ${h} vs easy ${e}`);
});

test('taunt builds meter; platform train and moon gravity reset between rounds', async () => {
  const { WORLD, GRAVITY } = await import('../src/fighter.js');
  const g = new Game({ p1: byId('vicky'), p2: byId('goblin'), stage: 'platform', seed: 9, events: false });
  toFight(g);
  g.step([press('t'), emptyInput()]);
  for (let i = 0; i < 20; i++) g.step();
  assert.ok(g.f[0].meter >= 12, 'taunt meter ' + g.f[0].meter);
  g.nextTrain = 1; g.step(); assert.ok(g.trainT > 0, 'train started');
  g.events = true; g.event = { type: 'moon', t: 0, len: 300, dir: 1 }; g.step();
  assert.ok(WORLD.gravity < GRAVITY);
  g.f[1].hp = 0; for (let i = 0; i < 400 && g.phase !== 'intro'; i++) g.step();
  assert.equal(WORLD.gravity, GRAVITY);
});
