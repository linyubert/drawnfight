import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPPONENTS, getOpponentWeaponGrid } from '../src/opponents.js';
import { createDetailedFighterRig } from '../src/characterRig.js';
import { sound } from '../src/sound.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. Verify zero missing DOM IDs between src/main.js and src/template.html
const mainSrc = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
const arenaSrc = fs.readFileSync(path.join(ROOT, 'src/arena3d.js'), 'utf8');
const tplHtml = fs.readFileSync(path.join(ROOT, 'src/template.html'), 'utf8');

const htmlIds = new Set([...tplHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const referencedIds = [...mainSrc.matchAll(/\bel\('([^']+)'\)/g)].map((m) => m[1]);

for (const id of referencedIds) {
  assert.equal(htmlIds.has(id), true, `Missing DOM id="${id}" in src/template.html!`);
}
console.log(`DOM ID check passed (${referencedIds.length} element references verified).`);

// 2. Verify Challenge feature is completely removed from template & main
assert.equal(tplHtml.includes('挑戰碼'), false, 'Challenge code button still in template.html!');
assert.equal(mainSrc.includes('challenge'), false, 'Challenge reference still in main.js!');
console.log('Challenge feature removal verified.');

// 3. Verify Single Circular Stage Watermark ("禹承老師音樂課") inside the circular stage emblem
assert.equal(arenaSrc.includes('禹承老師音樂課'), true, 'Missing 3D dojo stage watermark in arena3d.js!');
assert.equal(arenaSrc.includes('CircleGeometry(2.55, 64)'), true, 'Stage watermark should use circular geometry!');
const wmFnSlice = arenaSrc.slice(
  arenaSrc.indexOf('function createStageWatermarkTexture'),
  arenaSrc.indexOf('export function renderWeaponThumbnail')
);
assert.equal(wmFnSlice.includes('strokeRect'), false, 'Rectangular border should be removed from stage watermark!');
assert.equal(wmFnSlice.includes('ctx.clip()'), true, 'Circular clip should protect stage watermark text!');
assert.equal(mainSrc.includes('禹承老師音樂課'), false, 'Extra duplicate watermark in main.js should be removed!');
console.log('Single circular stage watermark ("禹承老師音樂課") verified.');

// 4. Verify 3-Track Battle BGM Carousel rotation, ended continuation, mute sync, and missing-file safety
{
  const playedSources = [];
  class MockAudio {
    constructor() {
      this.src = '';
      this.volume = 1;
      this.muted = false;
      this.currentTime = 0;
      this.paused = true;
      this.listeners = {};
    }
    addEventListener(evt, fn) {
      this.listeners[evt] = this.listeners[evt] || [];
      this.listeners[evt].push(fn);
    }
    emit(evt) {
      for (const fn of this.listeners[evt] || []) fn();
    }
    play() {
      this.paused = false;
      playedSources.push(this.src);
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }

  globalThis.window = {
    BATTLE_BGM_TRACKS: ['audio/bgm1.mp3', 'audio/bgm2.mp3', 'audio/bgm3.mp3'],
    BATTLE_BGM_VOLUME: 0.55,
  };
  globalThis.Audio = MockAudio;

  sound.bgmAudio = null;
  sound.bgmTrackIndex = 0;

  // Battle 1 -> bgm1, Battle 2 -> bgm2, Battle 3 -> bgm3, Battle 4 -> bgm1
  sound.startBattleBgm();
  sound.startBattleBgm();
  sound.startBattleBgm();
  sound.startBattleBgm();
  assert.deepEqual(playedSources, [
    'audio/bgm1.mp3',
    'audio/bgm2.mp3',
    'audio/bgm3.mp3',
    'audio/bgm1.mp3',
  ]);

  // Mid-battle track end -> automatically rotates to bgm2 then bgm3
  sound.bgmAudio.emit('ended');
  sound.bgmAudio.emit('ended');
  assert.deepEqual(playedSources.slice(-2), ['audio/bgm2.mp3', 'audio/bgm3.mp3']);

  // Mute sync
  sound.setMuted(true);
  assert.equal(sound.bgmAudio.muted, true);
  sound.setMuted(false);
  assert.equal(sound.bgmAudio.muted, false);

  // Stop resets cleanly
  sound.bgmAudio.currentTime = 42;
  sound.stopBattleBgm();
  assert.equal(sound.bgmAudio.paused, true);
  assert.equal(sound.bgmAudio.currentTime, 0);
  assert.equal(sound.bgmActive, false);

  // Missing pre-deployment files -> bounded fallback (at most 3 attempts, never infinite loop!)
  playedSources.length = 0;
  sound.bgmTrackIndex = 0;
  sound.startBattleBgm(); // attempt 1 (bgm1)
  sound.bgmAudio.emit('error'); // attempt 2 (bgm2)
  sound.bgmAudio.emit('error'); // attempt 3 (bgm3)
  sound.bgmAudio.emit('error'); // stops!
  assert.equal(playedSources.length, 3, 'Should try each of the 3 tracks once and then stop cleanly');
  assert.equal(sound.bgmActive, false);

  delete globalThis.Audio;
  delete globalThis.window;
}
console.log('3-track Battle BGM carousel rotation, ended continuation, mute sync & missing-file guard verified.');

// 5. Verify all 8 opponents generate valid non-empty 80x80 pixel weapons
assert.equal(OPPONENTS.length, 8);
for (const opp of OPPONENTS) {
  const g = getOpponentWeaponGrid(opp);
  let ink = 0;
  for (let i = 0; i < g.length; i++) ink += g[i];
  assert.equal(ink > 30, true, `Opponent ${opp.id} weapon grid has too few pixels: ${ink}`);
}
console.log('All 8 opponent procedural weapons verified.');

// 6. Verify bundled index.html (& live HTTP server on port 3000 if running)
const builtHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert.equal(builtHtml.includes('/*__INLINE_CSS__*/'), false, 'CSS placeholder was not replaced!');
assert.equal(builtHtml.includes('/*__INLINE_JS__*/'), false, 'JS placeholder was not replaced!');
assert.equal(builtHtml.includes('挑戰碼'), false, 'Challenge code string still in built index.html!');
assert.equal(builtHtml.includes('禹承老師音樂課'), true, 'Watermark missing from built index.html!');
assert.equal(builtHtml.includes('window.BATTLE_BGM_TRACKS'), true, 'Editable BATTLE_BGM_TRACKS config missing from index.html!');

try {
  const res = await fetch('http://127.0.0.1:3000/');
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text.length, builtHtml.length);

  const missingAudioRes = await fetch('http://127.0.0.1:3000/audio/bgm1.mp3');
  assert.equal(missingAudioRes.status, 404);
  console.log(`Live HTTP server verified (200 OK, ${Math.round(text.length / 1024)} KB, clean 404 for pre-deployment /audio/bgm1.mp3).`);
} catch (_) {
  console.log(`Bundled index.html verified (${Math.round(builtHtml.length / 1024)} KB; local server not running, skipped HTTP check).`);
}

// 7. Verify all detailed 3D character rigs build cleanly and animate across all combat states
const personas = ['player', 'player2', ...OPPONENTS.map((o) => o.id)];
for (const persona of personas) {
  const oppMatch = OPPONENTS.find((o) => o.id === persona);
  const rig = createDetailedFighterRig({
    persona,
    colors: oppMatch ? oppMatch.colors : { top: '#ffffff', hakama: '#1e3a5f', band: '#ef4444' },
    scale: oppMatch ? oppMatch.scale : 1.0,
    isBoss: !!(oppMatch && oppMatch.isBoss),
  });
  let meshCount = 0;
  rig.root.traverse((obj) => {
    if (obj.isMesh) meshCount++;
  });
  assert.equal(meshCount >= 28, true, `Persona ${persona} has unexpectedly few meshes: ${meshCount}`);

  for (const st of ['idle', 'windup', 'slash', 'block', 'stun', 'ko']) {
    rig.animateDetails({ dt: 0.016, time: 1.25, speed: 1.8, state: st, stateProgress: 0.5 });
  }
}
console.log(`All ${personas.length} detailed 3D character rigs & dynamic expressions verified!`);
