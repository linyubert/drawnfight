import {
  GRID_N,
  PAD_PX,
  CELL_PX,
  STAFF_LINES,
  DRAW_MAX_ROW,
  NOTE_PROMPTS,
  PROMPT_MAP,
  drawReferenceSymbol,
} from './constants.js';
import { evaluateDrawing, computeWeaponStats } from './noteClassifier.js';
import { OPPONENTS, getOpponentWeaponGrid } from './opponents.js';
import { sound } from './sound.js';
import { DojoArena3D, renderWeaponThumbnail } from './arena3d.js';

// Safe storage helpers (never throw inside sandboxed iframes!)
function safeGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : fallback;
  } catch (_) {
    return fallback;
  }
}

function safeSet(key, val) {
  try {
    localStorage.setItem(key, String(val));
  } catch (_) {}
}

// ---- Application State ----
const state = {
  uiScreen: 'draw', // 'draw' | 'prep' | 'fight'
  gameMode: 'gauntlet', // 'gauntlet' | '2p'
  twoPPhase: 1, // 1 = P1 drawing, 2 = P2 drawing
  stageIndex: 0, // 0..7 for the 8 opponents, >=8 for endless
  winStreak: 0,
  bestStreak: Number(safeGet('nk_best_streak', '0')) || 0,

  enabledPromptIds: new Set(NOTE_PROMPTS.map((p) => p.id)),
  deck: [],
  currentPromptId: 'quarter_note',
  usedHint: false,
  showGhostTrace: false,

  // Drawing Pad State
  grid: new Uint8Array(GRID_N * GRID_N),
  undoStack: [],
  tool: 'thin', // 'thin' | 'thick' | 'eraser'
  isDrawing: false,
  lastCell: null,

  // Forged Weapon Configurations
  p1Build: {
    grid: null,
    promptId: 'quarter_note',
    name: '',
    score: 90,
    grade: 'A',
    usedHint: false,
    stats: null,
    move: 'overhead',
    plan: 'balanced',
    sizeMult: 1.0,
    manual: false,
  },
  p2Build: null,
};

// ---- Smart Non-Repeating 6-Symbol Deck ----
function drawNextPromptId() {
  const active = NOTE_PROMPTS.map((p) => p.id).filter((id) => state.enabledPromptIds.has(id));
  if (active.length === 0) {
    state.enabledPromptIds = new Set(NOTE_PROMPTS.map((p) => p.id));
    return drawNextPromptId();
  }
  state.deck = state.deck.filter((id) => state.enabledPromptIds.has(id));
  if (state.deck.length === 0) {
    // Fisher-Yates shuffle of all active symbols
    const arr = [...active];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // Avoid immediate repeat across reshuffle boundary when >1 active
    if (arr.length > 1 && arr[0] === state.currentPromptId) {
      [arr[0], arr[arr.length - 1]] = [arr[arr.length - 1], arr[0]];
    }
    state.deck = arr;
  }
  const next = state.deck.shift();
  state.currentPromptId = next;
  state.usedHint = false;
  state.showGhostTrace = false;
  return next;
}

function getCurrentOpponent() {
  if (state.stageIndex < OPPONENTS.length) {
    return OPPONENTS[state.stageIndex];
  }
  // Endless gauntlet scaling beyond Stage 8!
  const base = OPPONENTS[state.stageIndex % OPPONENTS.length];
  const loop = Math.floor(state.stageIndex / OPPONENTS.length);
  const mult = 1 + loop * 0.22;
  return {
    ...base,
    stage: state.stageIndex + 1,
    title: `無限道場 第 ${state.stageIndex + 1} 戰`,
    hp: Math.round(base.hp * mult),
    atk: Math.min(130, Math.round(base.atk * mult)),
  };
}

// ---- DOM Elements ----
const el = (id) => document.getElementById(id);

let arena = null;
let padCtx = null;

function init() {
  padCtx = el('pad').getContext('2d');

  arena = new DojoArena3D(el('c'), el('ov'), {
    onHudUpdate: updateFightHud,
    onBattleEnd: handleBattleEnd,
    onJustParry: () => {
      const jf = el('jflash');
      jf.classList.remove('on');
      void jf.offsetWidth;
      jf.classList.add('on');
    },
  });

  bindDrawingEvents();
  bindTopAndQuizEvents();
  bindPrepEvents();
  bindManualControls();
  bindModalEvents();

  drawNextPromptId();
  refreshDrawScreenUI();
  syncBackdropPreview();
}

function syncBackdropPreview() {
  const opp = getCurrentOpponent();
  const oppGrid = getOpponentWeaponGrid(opp);
  const hasInk = state.grid.some((v) => v === 1);
  arena.setupPreviewFighters(hasInk ? state.grid : null, opp, oppGrid);
}

// ---- Drawing Pad Logic & Rendering ----
function pushUndo() {
  state.undoStack.push(new Uint8Array(state.grid));
  if (state.undoStack.length > 25) state.undoStack.shift();
}

function stampGrid(gx, gy) {
  const isErase = state.tool === 'eraser';
  const r = state.tool === 'thick' ? 2.45 : isErase ? 2.8 : 1.15;
  const r2 = r * r;
  let changed = false;

  const y0 = Math.max(0, Math.floor(gy - r));
  const y1 = Math.min(DRAW_MAX_ROW, Math.ceil(gy + r));
  const x0 = Math.max(0, Math.floor(gx - r));
  const x1 = Math.min(GRID_N - 1, Math.ceil(gx + r));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if ((x - gx) * (x - gx) + (y - gy) * (y - gy) <= r2) {
        const idx = y * GRID_N + x;
        const nv = isErase ? 0 : 1;
        if (state.grid[idx] !== nv) {
          state.grid[idx] = nv;
          changed = true;
        }
      }
    }
  }
  if (changed) {
    sound.playBrushRow(gy, isErase);
  }
}

function strokeCells(x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist * 2.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    stampGrid(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
  }
}

function pointerToGrid(ev) {
  const rect = el('pad').getBoundingClientRect();
  const px = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * PAD_PX;
  const py = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * PAD_PX;
  return [
    Math.max(0, Math.min(GRID_N - 1, px / CELL_PX)),
    Math.max(0, Math.min(GRID_N - 1, py / CELL_PX)),
  ];
}

function bindDrawingEvents() {
  const pad = el('pad');

  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const [gx, gy] = pointerToGrid(e);
    if (gy > DRAW_MAX_ROW + 1) return;
    pad.setPointerCapture(e.pointerId);
    pushUndo();
    state.isDrawing = true;
    state.lastCell = [gx, gy];
    stampGrid(gx, gy);
    renderPad();
    updateLiveSpecBar();
  });

  pad.addEventListener('pointermove', (e) => {
    if (!state.isDrawing) return;
    e.preventDefault();
    const [gx, gy] = pointerToGrid(e);
    const clampedY = Math.min(DRAW_MAX_ROW, gy);
    if (state.lastCell) {
      strokeCells(state.lastCell[0], state.lastCell[1], gx, clampedY);
    } else {
      stampGrid(gx, clampedY);
    }
    state.lastCell = [gx, clampedY];
    renderPad();
    updateLiveSpecBar();
  });

  const endStroke = () => {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    state.lastCell = null;
    renderPad();
    updateLiveSpecBar();
    syncBackdropPreview();
  };

  pad.addEventListener('pointerup', endStroke);
  pad.addEventListener('pointercancel', endStroke);

  // Tool Buttons
  const setTool = (t) => {
    state.tool = t;
    sound.playClick();
    el('toolThin').classList.toggle('on', t === 'thin');
    el('toolThick').classList.toggle('on', t === 'thick');
    el('toolEraser').classList.toggle('on', t === 'eraser');
  };

  el('toolThin').addEventListener('click', () => setTool('thin'));
  el('toolThick').addEventListener('click', () => setTool('thick'));
  el('toolEraser').addEventListener('click', () => setTool('eraser'));

  el('toolUndo').addEventListener('click', () => {
    if (state.undoStack.length === 0) return;
    sound.playClick();
    state.grid = state.undoStack.pop();
    renderPad();
    updateLiveSpecBar();
    syncBackdropPreview();
  });

  el('toolClear').addEventListener('click', () => {
    if (!state.grid.some((v) => v === 1)) return;
    sound.playClick();
    pushUndo();
    state.grid.fill(0);
    renderPad();
    updateLiveSpecBar();
    syncBackdropPreview();
  });
}

function renderPad() {
  const ctx = padCtx;
  ctx.clearRect(0, 0, PAD_PX, PAD_PX);

  // 1. Squared Graph Paper Background
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, PAD_PX, PAD_PX);

  ctx.strokeStyle = 'rgba(210, 198, 178, 0.35)';
  ctx.lineWidth = 1;
  const step = CELL_PX * 4;
  for (let p = step; p < PAD_PX; p += step) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, (DRAW_MAX_ROW + 1) * CELL_PX);
    ctx.stroke();

    if (p < (DRAW_MAX_ROW + 1) * CELL_PX) {
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(PAD_PX, p);
      ctx.stroke();
    }
  }

  // 2. 5-Line Musical Staff (Lines 1..5 clearly numbered bottom-to-top!)
  for (let line = 1; line <= 5; line++) {
    const row = STAFF_LINES[line];
    const y = (row + 0.5) * CELL_PX;
    const isKeyLine = line === 3 || line === 4;

    ctx.strokeStyle = isKeyLine ? '#8c6d46' : '#b39f84';
    ctx.lineWidth = isKeyLine ? 2.4 : 1.8;
    ctx.beginPath();
    ctx.moveTo(46, y);
    ctx.lineTo(PAD_PX - 46, y);
    ctx.stroke();

    // Left line labels
    ctx.fillStyle = isKeyLine ? '#7c2d12' : '#78716c';
    ctx.font = '900 13px "PingFang TC", "Noto Sans TC", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(line === 3 ? '3線(中)' : `${line}線`, 6, y);
  }

  // Right-side Rakugaki Kengo cm scale ticks
  ctx.fillStyle = '#a8a29e';
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  const ticks = [
    { cm: '150cm', row: 14 },
    { cm: '100cm', row: 36 },
    { cm: '50cm', row: 56 },
  ];
  for (const tk of ticks) {
    const ty = tk.row * CELL_PX;
    ctx.fillText(`— ${tk.cm}`, PAD_PX - 6, ty);
  }

  // 3. Optional Ghost Reference Trace (ONLY when player toggled it inside Hint!)
  if (state.showGhostTrace) {
    drawReferenceSymbol(ctx, state.currentPromptId, PAD_PX, { ghost: true });
  }

  // 4. Hilt Base Zone (rows 67..79)
  const guardTopY = (DRAW_MAX_ROW + 1) * CELL_PX;
  ctx.fillStyle = 'rgba(235, 226, 208, 0.55)';
  ctx.fillRect(0, guardTopY, PAD_PX, PAD_PX - guardTopY);

  const cx = PAD_PX * 0.5;
  // Handle (tsuka)
  const handleW = 26;
  const handleTop = guardTopY + 15;
  ctx.fillStyle = '#4a3525';
  ctx.strokeStyle = '#1b1b22';
  ctx.lineWidth = 3.5;
  ctx.fillRect(cx - handleW / 2, handleTop, handleW, PAD_PX - handleTop + 4);
  ctx.strokeRect(cx - handleW / 2, handleTop, handleW, PAD_PX - handleTop + 4);

  // Diamond tsuka-ito wraps
  ctx.fillStyle = '#eab308';
  for (let wy = handleTop + 8; wy < PAD_PX - 6; wy += 18) {
    ctx.beginPath();
    ctx.moveTo(cx, wy);
    ctx.lineTo(cx + 8, wy + 6);
    ctx.lineTo(cx, wy + 12);
    ctx.lineTo(cx - 8, wy + 6);
    ctx.closePath();
    ctx.fill();
  }

  // Golden Tsuba (Guard)
  const guardW = 84;
  const guardH = 15;
  ctx.fillStyle = '#facc15';
  ctx.fillRect(cx - guardW / 2, guardTopY, guardW, guardH);
  ctx.strokeRect(cx - guardW / 2, guardTopY, guardW, guardH);

  // 5. Drawn Pixel-Blade Silhouette + Steel Fill (Rakugaki Kengo style!)
  let ink = 0;
  let sumX = 0;
  let sumY = 0;

  // Outer dark outline
  ctx.fillStyle = '#1b1b22';
  const outlinePad = 2.4;
  for (let y = 0; y <= DRAW_MAX_ROW; y++) {
    for (let x = 0; x < GRID_N; x++) {
      if (!state.grid[y * GRID_N + x]) continue;
      ink++;
      sumX += x;
      sumY += y;
      ctx.fillRect(
        x * CELL_PX - outlinePad,
        y * CELL_PX - outlinePad,
        CELL_PX + outlinePad * 2,
        CELL_PX + outlinePad * 2
      );
    }
  }

  // Crisp metallic pixel interior
  ctx.fillStyle = state.isDrawing ? '#fca5a5' : '#dfe7f2';
  for (let y = 0; y <= DRAW_MAX_ROW; y++) {
    for (let x = 0; x < GRID_N; x++) {
      if (!state.grid[y * GRID_N + x]) continue;
      ctx.fillRect(x * CELL_PX, y * CELL_PX, Math.ceil(CELL_PX), Math.ceil(CELL_PX));
    }
  }

  // Center-of-gravity red balance dot (just like Rakugaki Kengo!)
  if (ink > 8) {
    const comPxX = ((sumX / ink) + 0.5) * CELL_PX;
    const comPxY = ((sumY / ink) + 0.5) * CELL_PX;
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(comPxX, comPxY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function updateLiveSpecBar() {
  const ws = computeWeaponStats(state.grid, state.currentPromptId, 85, state.usedHint);
  const fb = el('feedbackBar');
  fb.classList.remove('fail', 'pass');

  if (ws.empty) {
    el('goBtn').disabled = true;
    fb.innerHTML = '請在五線譜上畫出題目指定的符號，及格即可鑄造成 <b>3D 音符神劍</b> 出戰！';
    return;
  }

  el('goBtn').disabled = false;
  const tyClass = `ty ty-${ws.archetype}`;
  fb.innerHTML = `預估劍身：長 <b>${ws.lengthCm}cm</b>・重 <b>${ws.weightKg}kg</b>・流派 <span class="${tyClass}">${ws.archetypeLabel}</span>（畫完請按「批改鑄劍！」）`;
}

function refreshDrawScreenUI() {
  const prompt = PROMPT_MAP[state.currentPromptId];
  el('quizPromptName').textContent = prompt.name;
  el('quizBeats').textContent = `（${prompt.beats}）`;
  el('hintText').textContent = `💡 畫法口訣：${prompt.verbalHint}`;
  el('hintDrawer').classList.toggle('open', state.usedHint);
  el('ghostToggleBtn').classList.toggle('on', state.showGhostTrace);
  el('ghostToggleBtn').textContent = state.showGhostTrace ? '🙈 隱藏虛線描紅' : '👁️ 顯示虛線描紅輔助';

  // Stage / Mode Badge
  if (state.gameMode === '2p') {
    el('stageBadge').textContent = `⚔️ 雙人對戰：請 ${state.twoPPhase}P 畫音符`;
    el('mode2pBtn').classList.add('activeMode');
    el('mode2pBtn').textContent = '退出雙人';
  } else {
    const opp = getCurrentOpponent();
    el('stageBadge').textContent = `🏯 第 ${opp.stage}/8 戰：${opp.name}${state.bestStreak > 0 ? `（最高 ${state.bestStreak} 勝）` : ''}`;
    el('mode2pBtn').classList.remove('activeMode');
    el('mode2pBtn').textContent = '雙人對戰';
  }

  renderPad();
  updateLiveSpecBar();
}

// ---- Top Buttons, Hint & Submit Quiz ----
function bindTopAndQuizEvents() {
  el('muteBtn').addEventListener('click', () => {
    const muted = sound.toggleMute();
    el('muteBtn').textContent = muted ? '🔇 靜音' : '🔊 音效';
  });

  el('hintBtn').addEventListener('click', () => {
    sound.playClick();
    state.usedHint = true;
    el('hintDrawer').classList.toggle('open');
  });

  el('ghostToggleBtn').addEventListener('click', () => {
    sound.playClick();
    state.usedHint = true;
    state.showGhostTrace = !state.showGhostTrace;
    el('ghostToggleBtn').classList.toggle('on', state.showGhostTrace);
    el('ghostToggleBtn').textContent = state.showGhostTrace ? '🙈 隱藏虛線描紅' : '👁️ 顯示虛線描紅輔助';
    renderPad();
  });

  el('goBtn').addEventListener('click', onSubmitDrawing);

  // 2P Mode Toggle
  el('mode2pBtn').addEventListener('click', () => {
    sound.playClick();
    if (state.gameMode === '2p') {
      state.gameMode = 'gauntlet';
      state.twoPPhase = 1;
    } else {
      state.gameMode = '2p';
      state.twoPPhase = 1;
    }
    state.grid.fill(0);
    state.undoStack = [];
    drawNextPromptId();
    refreshDrawScreenUI();
    syncBackdropPreview();
  });

  // 3D Character Close-Up Showcase Mode!
  let showcaseIdx = 0;
  let showcaseFocus = 'both';

  const refreshShowcaseStage = () => {
    const opp = OPPONENTS[showcaseIdx % OPPONENTS.length];
    const hasInk = state.grid.some((v) => v === 1);
    arena.setupPreviewFighters(hasInk ? state.grid : null, opp, getOpponentWeaponGrid(opp));
    arena.setShowcaseView(true, showcaseFocus);
    el('showcaseLabel').textContent = `👀 3D 人物細節鑑賞：主角劍士 vs 第 ${opp.stage} 戰【${opp.name}】`;
    el('scFocusBoth').classList.toggle('on', showcaseFocus === 'both');
    el('scFocusPlayer').classList.toggle('on', showcaseFocus === 'player');
    el('scFocusOpp').classList.toggle('on', showcaseFocus === 'opponent');
  };

  el('showcaseBtn').addEventListener('click', () => {
    sound.playClick();
    showcaseIdx = state.stageIndex % OPPONENTS.length;
    showcaseFocus = 'both';
    el('drawScreen').classList.add('hide');
    el('showcaseDock').classList.remove('hide');
    refreshShowcaseStage();
  });

  el('scFocusBoth').addEventListener('click', () => {
    sound.playClick();
    showcaseFocus = 'both';
    refreshShowcaseStage();
  });

  el('scFocusPlayer').addEventListener('click', () => {
    sound.playClick();
    showcaseFocus = 'player';
    refreshShowcaseStage();
  });

  el('scFocusOpp').addEventListener('click', () => {
    sound.playClick();
    showcaseFocus = 'opponent';
    refreshShowcaseStage();
  });

  el('scPrevOpp').addEventListener('click', () => {
    sound.playClick();
    showcaseIdx = (showcaseIdx - 1 + OPPONENTS.length) % OPPONENTS.length;
    showcaseFocus = 'opponent';
    refreshShowcaseStage();
  });

  el('scNextOpp').addEventListener('click', () => {
    sound.playClick();
    showcaseIdx = (showcaseIdx + 1) % OPPONENTS.length;
    showcaseFocus = 'opponent';
    refreshShowcaseStage();
  });

  el('scClose').addEventListener('click', () => {
    sound.playClick();
    arena.setShowcaseView(false, 'both');
    el('showcaseDock').classList.add('hide');
    el('drawScreen').classList.remove('hide');
    syncBackdropPreview();
  });
}

function onSubmitDrawing() {
  const res = evaluateDrawing(state.grid, state.currentPromptId, state.usedHint);
  const fb = el('feedbackBar');

  if (!res.passed) {
    sound.playQuizFail();
    fb.classList.remove('pass');
    fb.classList.add('fail');
    fb.textContent = `❌ 尚未及格：${res.feedback}`;
    const wrap = el('padWrap');
    wrap.classList.remove('shake');
    void wrap.offsetWidth;
    wrap.classList.add('shake');
    return;
  }

  // Quiz Passed!
  sound.playQuizPass(state.currentPromptId);
  fb.classList.remove('fail');
  fb.classList.add('pass');
  fb.textContent = `✅ ${res.feedback}`;

  if (state.gameMode === '2p') {
    if (state.twoPPhase === 1) {
      // Save P1 weapon and switch to P2!
      state.p1Build = {
        ...state.p1Build,
        grid: new Uint8Array(res.cleanGrid),
        promptId: state.currentPromptId,
        name: `1P・${res.weapon.autoName}`,
        score: res.score,
        grade: res.grade,
        usedHint: state.usedHint,
        stats: res.weapon,
        move: 'overhead',
        plan: 'balanced',
        sizeMult: 1.0,
        manual: false,
      };
      state.twoPPhase = 2;
      state.grid.fill(0);
      state.undoStack = [];
      drawNextPromptId();
      refreshDrawScreenUI();
      const fb2 = el('feedbackBar');
      fb2.classList.add('pass');
      fb2.textContent = `🎉 1P 過關（${res.score}分）！現在請 2P 畫出上方題目的音符！`;
      return;
    } else {
      // Save P2 weapon and go directly to VS Screen!
      state.p2Build = {
        grid: new Uint8Array(res.cleanGrid),
        promptId: state.currentPromptId,
        name: `2P・${res.weapon.autoName}`,
        score: res.score,
        grade: res.grade,
        usedHint: state.usedHint,
        stats: res.weapon,
        move: 'sweep',
        plan: 'balanced',
        sizeMult: 1.0,
      };
      openVsModal();
      return;
    }
  }

  // 1P Gauntlet or Challenge Mode -> Open Prep Screen!
  state.p1Build = {
    ...state.p1Build,
    grid: new Uint8Array(res.cleanGrid),
    promptId: state.currentPromptId,
    name: res.weapon.autoName,
    score: res.score,
    grade: res.grade,
    usedHint: state.usedHint,
    stats: res.weapon,
  };

  openPrepScreen();
}

// ---- Prep / Weapon Stats Screen ----
function bindPrepEvents() {
  el('pBack').addEventListener('click', () => {
    sound.playClick();
    showScreen('draw');
    syncBackdropPreview();
  });

  el('pNameInput').addEventListener('input', (e) => {
    state.p1Build.name = e.target.value.slice(0, 16) || state.p1Build.stats.autoName;
  });

  const setupSeg = (containerId, options, key, onChange) => {
    const box = el(containerId);
    box.innerHTML = '';
    for (const opt of options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = opt.label;
      b.dataset.val = String(opt.val);
      b.addEventListener('click', () => {
        sound.playClick();
        state.p1Build[key] = opt.val;
        [...box.children].forEach((c) => c.classList.toggle('on', c === b));
        if (onChange) onChange(opt);
      });
      box.appendChild(b);
    }
  };

  setupSeg(
    'segMove',
    [
      { val: 'overhead', label: '下劈斬' },
      { val: 'sweep', label: '橫掃斬' },
      { val: 'thrust', label: '突刺音擊' },
    ],
    'move'
  );

  setupSeg(
    'segPlan',
    [
      { val: 'aggressive', label: '猛攻' },
      { val: 'balanced', label: '見招拆招' },
      { val: 'defensive', label: '穩守反擊' },
    ],
    'plan'
  );

  setupSeg(
    'segSize',
    [
      { val: 1.0, label: '標準 ×1.0' },
      { val: 1.3, label: '大太刀 ×1.3' },
      { val: 1.6, label: '特大 ×1.6' },
    ],
    'sizeMult'
  );

  setupSeg(
    'segCtl',
    [
      { val: false, label: '自動對戰（推薦）' },
      { val: true, label: '手動操作（搖桿/鍵盤）' },
    ],
    'manual',
    (opt) => {
      el('rowPlan').style.display = opt.val ? 'none' : 'block';
    }
  );

  el('pGo').addEventListener('click', () => {
    sound.playClick();
    openVsModal();
  });
}

function openPrepScreen() {
  const b = state.p1Build;
  const prompt = PROMPT_MAP[b.promptId];
  const ws = b.stats;

  el('passBanner').textContent = `🎉 判定合格！【${prompt.name}】 ${b.grade} 級 ${b.score} 分 ${
    !b.usedHint ? '🌟記憶加成' : ''
  }`;
  el('pNameInput').value = b.name;

  const tySpan = `<span class="ty ty-${ws.archetype}">${ws.archetypeLabel}</span>`;
  el('pTrait').innerHTML = `${tySpan} ・ 🎵 ${prompt.combatTraitName}（${prompt.combatTraitDesc}）`;

  renderWeaponThumbnail(el('pMini'), b.grid, {
    bladeColor: '#dfe7f2',
    glowColor: prompt.glowColor,
    showStaff: true,
  });

  const statRows = [
    ['攻擊', ws.atk],
    ['攻速', ws.spd],
    ['格擋', ws.guard],
    ['破防', ws.brk],
  ];
  el('pStats').innerHTML = statRows
    .map(
      ([k, v]) =>
        `<div class="st"><span class="k">${k}</span><span class="b"><i style="width:${v}%"></i></span><span class="v">${v}</span></div>`
    )
    .join('');

  // Matchup intel against upcoming opponent
  const opp = getCurrentOpponent();
  const oppArch = opp.archetype;
  const oppArchLabel = opp.archetypeLabel;
  const beats = { thin: 'heavy', heavy: 'wide', wide: 'thin' };
  const advText =
    beats[ws.archetype] === oppArch
      ? '🔥 流派大優勢（傷害 +18%）！'
      : beats[oppArch] === ws.archetype
      ? '⚠️ 流派被剋，建議善用「穩守反擊」或「手動格擋」！'
      : '⚖️ 流派勢均力敵！';
  el('pMatchupHint').textContent = `下一戰對手：${opp.name}【${oppArchLabel}】— ${advText}`;

  // Sync segmented active buttons
  const syncSeg = (id, curVal) => {
    [...el(id).children].forEach((btn) => btn.classList.toggle('on', btn.dataset.val === String(curVal)));
  };
  syncSeg('segMove', b.move);
  syncSeg('segPlan', b.plan);
  syncSeg('segSize', b.sizeMult);
  syncSeg('segCtl', b.manual);
  el('rowPlan').style.display = b.manual ? 'none' : 'block';

  arena.setupPreviewFighters(b.grid, opp, getOpponentWeaponGrid(opp));
  showScreen('prep');
}

// ---- VS Modal & Launching 3D Combat ----
function openVsModal() {
  const b1 = state.p1Build;
  const p1Prompt = PROMPT_MAP[b1.promptId];

  renderWeaponThumbnail(el('vsCanvasA'), b1.grid, {
    bladeColor: '#dfe7f2',
    glowColor: p1Prompt.glowColor,
    showStaff: false,
  });
  el('vsNameA').textContent = b1.name;
  el('vsSubA').textContent = `${p1Prompt.name}・${b1.stats.archetypeLabel}`;

  if (state.gameMode === '2p' && state.p2Build) {
    const b2 = state.p2Build;
    const p2Prompt = PROMPT_MAP[b2.promptId];
    el('vsTitle').textContent = '⚔️ 雙人音符劍對決！';
    renderWeaponThumbnail(el('vsCanvasB'), b2.grid, {
      bladeColor: '#fde68a',
      glowColor: p2Prompt.glowColor,
      showStaff: false,
    });
    el('vsNameB').textContent = b2.name;
    el('vsSubB').textContent = `${p2Prompt.name}・${b2.stats.archetypeLabel}`;
    el('vsQuote').textContent = '「兩把親手畫出的 3D 音符劍，誰才是真正的道場霸主！？」';
  } else {
    const opp = getCurrentOpponent();
    const oppGrid = getOpponentWeaponGrid(opp);
    el('vsTitle').textContent = opp.title;
    renderWeaponThumbnail(el('vsCanvasB'), oppGrid, {
      bladeColor: opp.colors.blade,
      glowColor: opp.colors.glow,
      showStaff: false,
    });
    el('vsNameB').textContent = opp.name;
    el('vsSubB').textContent = `${opp.weaponName}・${opp.archetypeLabel}`;
    el('vsQuote').textContent = opp.introQuote;
  }

  el('vsModal').classList.add('show');
}

function launch3DFight() {
  el('vsModal').classList.remove('show');
  el('winModal').classList.remove('show');
  el('resultModal').classList.remove('show');

  const b1 = state.p1Build;
  const p1Prompt = PROMPT_MAP[b1.promptId];

  const configA = {
    persona: 'player',
    name: state.gameMode === '2p' ? `1P (${b1.name})` : b1.name,
    grid: b1.grid,
    promptId: b1.promptId,
    archetype: b1.stats.archetype,
    hp: 125,
    atk: b1.stats.atk,
    spd: b1.stats.spd,
    guard: b1.stats.guard,
    brk: b1.stats.brk,
    reach: b1.stats.reach,
    move: b1.move,
    plan: b1.plan,
    sizeMult: b1.sizeMult,
    isManual: state.gameMode !== '2p' && b1.manual,
    colors: {
      top: '#ffffff',
      hakama: '#1e3a5f',
      band: '#ef4444',
      blade: '#e2e8f0',
      glow: p1Prompt.glowColor,
    },
  };

  let configB;
  if (state.gameMode === '2p' && state.p2Build) {
    const b2 = state.p2Build;
    const p2Prompt = PROMPT_MAP[b2.promptId];
    configB = {
      persona: 'player2',
      name: `2P (${b2.name})`,
      grid: b2.grid,
      promptId: b2.promptId,
      archetype: b2.stats.archetype,
      hp: 125,
      atk: b2.stats.atk,
      spd: b2.stats.spd,
      guard: b2.stats.guard,
      brk: b2.stats.brk,
      reach: b2.stats.reach,
      move: b2.move,
      plan: b2.plan,
      sizeMult: b2.sizeMult,
      colors: {
        top: '#fef08a',
        hakama: '#7c2d12',
        band: '#f97316',
        blade: '#fde68a',
        glow: p2Prompt.glowColor,
      },
    };
  } else {
    const opp = getCurrentOpponent();
    configB = {
      persona: opp.id,
      name: opp.name,
      grid: getOpponentWeaponGrid(opp),
      archetype: opp.archetype,
      hp: opp.hp,
      atk: opp.atk,
      spd: opp.spd,
      guard: opp.guard,
      brk: opp.brk,
      reach: opp.reach,
      scale: opp.scale,
      isBoss: opp.isBoss,
      move: opp.move,
      plan: opp.plan,
      colors: opp.colors,
    };
  }

  el('n0').textContent = configA.name;
  el('n1').textContent = configB.name;
  el('spdBtn').classList.remove('fast');
  el('spdBtn').textContent = '⏩ 1x 速度';
  el('spdBtn').style.display = configA.isManual ? 'none' : 'inline-block';

  showScreen('fight');
  el('ctl').classList.toggle('on', configA.isManual);

  // Start 3-track Battle BGM Carousel (rotates bgm1 -> bgm2 -> bgm3 -> bgm1 ...)
  sound.startBattleBgm();

  arena.startBattle(configA, configB, { manual: configA.isManual });
}

function updateFightHud(fA, fB, timer) {
  const pctA = Math.max(0, Math.min(100, (fA.hp / fA.maxHp) * 100));
  const pctB = Math.max(0, Math.min(100, (fB.hp / fB.maxHp) * 100));
  el('h0').style.width = `${pctA}%`;
  el('h1').style.width = `${pctB}%`;

  const label = state.gameMode === '2p' ? '雙人對決' : `第 ${getCurrentOpponent().stage} 戰`;
  el('round').textContent = `${label} ・ ⏱️ ${Math.ceil(timer)}s`;
}

function handleBattleEnd({ playerWon }) {
  sound.stopBattleBgm();
  el('ctl').classList.remove('on');

  if (state.gameMode === '2p') {
    openResultModal({
      title: playerWon ? '🏆 1P 音符劍獲勝！！' : '🏆 2P 音符劍獲勝！！',
      quote: playerWon
        ? `「1P 的【${state.p1Build.name}】技高一籌！」`
        : `「2P 的【${state.p2Build.name}】華麗制勝！」`,
      showNextStage: false,
      allowRematch: true,
    });
    return;
  }

  const opp = getCurrentOpponent();

  if (playerWon) {
    state.winStreak++;
    if (state.winStreak > state.bestStreak) {
      state.bestStreak = state.winStreak;
      safeSet('nk_best_streak', state.bestStreak);
    }

    // Did player just beat Stage 8 Giant Golden Buddha Boss?!
    if (state.stageIndex === OPPONENTS.length - 1) {
      openResultModal({
        title: '🎊 八人斬制霸！音符劍聖！',
        quote: opp.loseQuote,
        subInfo: `恭喜擊破最終魔王【${opp.name}】！目前連勝：${state.winStreak} 人斬！`,
        isGrandClear: true,
        allowRematch: false,
      });
      return;
    }

    // Normal Stage Clear -> Show Win + Textbook Symbol Review Card!
    const p = PROMPT_MAP[state.p1Build.promptId];
    el('winTitle').textContent = `🏆 第 ${opp.stage} 戰 勝利！！`;
    el('winQuote').textContent = opp.loseQuote;
    el('winStreakInfo').textContent = `目前連勝：${state.winStreak} 人抜き！下一戰對手：${
      OPPONENTS[(state.stageIndex + 1) % OPPONENTS.length].name
    }`;

    // Render textbook comparison diagram on win review canvas
    const revCv = el('winRefCanvas');
    const rCtx = revCv.getContext('2d');
    rCtx.clearRect(0, 0, revCv.width, revCv.height);
    rCtx.fillStyle = '#fffdf6';
    rCtx.fillRect(0, 0, revCv.width, revCv.height);
    drawReferenceSymbol(rCtx, p.id, revCv.width, { showStaff: true });

    el('winRefDesc').innerHTML = `<b>本戰複習：${p.name}（${p.beats}）</b><br><span style="font-size:12px;color:#57534e">${p.shortRule}</span>`;
    el('winModal').classList.add('show');
  } else {
    // Player lost -> Offer instant rematch OR redraw!
    const prevStreak = state.winStreak;
    state.winStreak = 0;
    openResultModal({
      title: `💥 敗北…（止步第 ${opp.stage} 戰）`,
      quote: opp.winQuote,
      subInfo: `本次連勝紀錄：${prevStreak} 人（歷史最高：${state.bestStreak} 人）｜💡 建議：${opp.tip}`,
      allowRematch: true,
      isGrandClear: false,
    });
  }
}

function openResultModal({ title, quote, subInfo = '', allowRematch = true, isGrandClear = false }) {
  el('resTitle').textContent = title;
  el('resQuote').textContent = quote;
  el('resSub').textContent = subInfo;

  renderWeaponThumbnail(el('resThumb'), state.p1Build.grid, {
    bladeColor: '#dfe7f2',
    glowColor: PROMPT_MAP[state.p1Build.promptId].glowColor,
    showStaff: false,
  });

  el('resRematchBtn').style.display = allowRematch ? 'block' : 'none';
  el('resEndlessBtn').style.display = isGrandClear ? 'block' : 'none';
  el('resRestartGauntletBtn').style.display = isGrandClear ? 'block' : 'none';

  el('resultModal').classList.add('show');
}

// ---- Manual Controls (Virtual Stick + Touch Buttons + Keyboard WASD / Arrows / J / K) ----
function bindManualControls() {
  const keys = new Set();
  const syncKeys = () => {
    let mx = 0;
    let my = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    arena.setManualInput({ moveX: mx, moveY: my });
  };

  window.addEventListener('keydown', (e) => {
    if (state.uiScreen !== 'fight') return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      keys.add(e.code);
      syncKeys();
    } else if (e.code === 'KeyJ' || e.code === 'Space') {
      e.preventDefault();
      el('cAtk').classList.add('dn');
      arena.triggerManualAttack();
    } else if (e.code === 'KeyK' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      el('cBlk').classList.add('dn');
      arena.setManualInput({ block: true });
    }
  });

  window.addEventListener('keyup', (e) => {
    if (keys.delete(e.code)) syncKeys();
    if (e.code === 'KeyJ' || e.code === 'Space') el('cAtk').classList.remove('dn');
    if (e.code === 'KeyK' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      el('cBlk').classList.remove('dn');
      arena.setManualInput({ block: false });
    }
  });

  // Virtual Joystick
  const stick = el('stick');
  const knob = el('knob');
  let stickId = null;

  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    updateStick(e);
  });

  const updateStick = (e) => {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const maxR = r.width * 0.38;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    arena.setManualInput({ moveX: dx / maxR, moveY: dy / maxR });
  };

  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) updateStick(e);
  });

  const resetStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    knob.style.transform = 'translate(0px, 0px)';
    arena.setManualInput({ moveX: 0, moveY: 0 });
  };
  stick.addEventListener('pointerup', resetStick);
  stick.addEventListener('pointercancel', resetStick);

  // Attack & Block Touch Buttons
  el('cAtk').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el('cAtk').classList.add('dn');
    arena.triggerManualAttack();
  });
  el('cAtk').addEventListener('pointerup', () => el('cAtk').classList.remove('dn'));
  el('cAtk').addEventListener('pointercancel', () => el('cAtk').classList.remove('dn'));

  el('cBlk').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el('cBlk').classList.add('dn');
    arena.setManualInput({ block: true });
  });
  const endBlk = () => {
    el('cBlk').classList.remove('dn');
    arena.setManualInput({ block: false });
  };
  el('cBlk').addEventListener('pointerup', endBlk);
  el('cBlk').addEventListener('pointercancel', endBlk);

  // Fight HUD Top Buttons
  el('spdBtn').addEventListener('click', () => {
    sound.playClick();
    const next = arena.speedMult > 1 ? 1 : 2;
    arena.setSpeedMultiplier(next);
    el('spdBtn').classList.toggle('fast', next === 2);
    el('spdBtn').textContent = next === 2 ? '⏩ 2x 快轉中' : '⏩ 1x 速度';
  });

  el('fightBackBtn').addEventListener('click', () => {
    sound.stopBattleBgm();
    sound.playClick();
    el('ctl').classList.remove('on');
    showScreen('draw');
    syncBackdropPreview();
  });
}

// ---- Modals (VS, Win, Result, Bank/Encyclopedia, Challenge Code) ----
function bindModalEvents() {
  el('vsGoBtn').addEventListener('click', () => {
    sound.playClick();
    launch3DFight();
  });

  el('vsBackBtn').addEventListener('click', () => {
    sound.playClick();
    el('vsModal').classList.remove('show');
    if (state.gameMode === '2p') {
      state.twoPPhase = 1;
      state.grid.fill(0);
      state.undoStack = [];
      drawNextPromptId();
      showScreen('draw');
      refreshDrawScreenUI();
    } else {
      showScreen('prep');
    }
  });

  // Next Stage Button on Win Modal
  el('winNextBtn').addEventListener('click', () => {
    sound.playClick();
    el('winModal').classList.remove('show');
    state.stageIndex++;
    state.grid.fill(0);
    state.undoStack = [];
    drawNextPromptId();
    showScreen('draw');
    refreshDrawScreenUI();
    syncBackdropPreview();
  });

  // Result Modal Buttons
  el('resRematchBtn').addEventListener('click', () => {
    sound.playClick();
    launch3DFight();
  });

  el('resRedrawBtn').addEventListener('click', () => {
    sound.playClick();
    el('resultModal').classList.remove('show');
    if (state.gameMode === '2p') {
      state.twoPPhase = 1;
      state.grid.fill(0);
      state.undoStack = [];
      drawNextPromptId();
    }
    showScreen('draw');
    refreshDrawScreenUI();
    syncBackdropPreview();
  });

  el('resEndlessBtn').addEventListener('click', () => {
    sound.playClick();
    el('resultModal').classList.remove('show');
    state.stageIndex++;
    state.grid.fill(0);
    state.undoStack = [];
    drawNextPromptId();
    showScreen('draw');
    refreshDrawScreenUI();
    syncBackdropPreview();
  });

  el('resRestartGauntletBtn').addEventListener('click', () => {
    sound.playClick();
    el('resultModal').classList.remove('show');
    state.stageIndex = 0;
    state.winStreak = 0;
    state.deck = [];
    state.grid.fill(0);
    state.undoStack = [];
    drawNextPromptId();
    showScreen('draw');
    refreshDrawScreenUI();
    syncBackdropPreview();
  });

  // Question Bank & Music Encyclopedia Modal (2 Tabs: No-Spoiler Bank vs Full Diagram Study)
  el('bankBtn').addEventListener('click', () => {
    sound.playClick();
    renderBankModal('settings');
    el('bankModal').classList.add('show');
  });

  el('bankCloseX').addEventListener('click', () => {
    sound.playClick();
    el('bankModal').classList.remove('show');
  });

  el('tabSettingsBtn').addEventListener('click', () => {
    sound.playClick();
    renderBankModal('settings');
  });

  el('tabGuideBtn').addEventListener('click', () => {
    sound.playClick();
    renderBankModal('guide');
  });
}

function renderBankModal(tab = 'settings') {
  el('tabSettingsBtn').classList.toggle('on', tab === 'settings');
  el('tabGuideBtn').classList.toggle('on', tab === 'guide');
  const container = el('bankContent');
  container.innerHTML = '';

  if (tab === 'settings') {
    // Tab 1: Pure text quiz bank selection (NO visual spoilers!)
    const info = document.createElement('div');
    info.style.cssText = 'font-size:12.5px;color:#57534e;margin:6px 0 8px;text-align:left;';
    info.textContent = '勾選要納入隨機抽考的符號（不顯示圖形防劇透！），或點「立即練習」直接切換目前題目：';
    container.appendChild(info);

    const grid = document.createElement('div');
    grid.className = 'bankGrid';

    for (const p of NOTE_PROMPTS) {
      const row = document.createElement('div');
      row.className = 'bankItem';
      const checked = state.enabledPromptIds.has(p.id);

      row.innerHTML = `
        <div class="bankMeta">
          <b>${p.name} <span style="font-weight:700;color:#78716c;font-size:12px;">(${p.beats})</span></b>
          <small>加成：${p.combatTraitName}</small>
          <div class="bankActions">
            <label style="font-size:12px;font-weight:800;display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="checkbox" ${checked ? 'checked' : ''} data-id="${p.id}"> 納入抽題
            </label>
            <button type="button" class="tinyBtn" data-pick="${p.id}">立即考這題</button>
          </div>
        </div>
      `;

      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
          state.enabledPromptIds.add(p.id);
        } else if (state.enabledPromptIds.size > 1) {
          state.enabledPromptIds.delete(p.id);
        } else {
          e.target.checked = true;
        }
      });

      row.querySelector('[data-pick]').addEventListener('click', () => {
        sound.playClick();
        state.currentPromptId = p.id;
        state.usedHint = false;
        state.showGhostTrace = false;
        state.grid.fill(0);
        state.undoStack = [];
        el('bankModal').classList.remove('show');
        showScreen('draw');
        refreshDrawScreenUI();
      });

      grid.appendChild(row);
    }
    container.appendChild(grid);
  } else {
    // Tab 2: Full visual reference textbook for all 6 symbols!
    const info = document.createElement('div');
    info.style.cssText = 'font-size:12.5px;color:#57534e;margin:6px 0 8px;text-align:left;';
    info.textContent = '五線譜由下往上數為「第 1 線 ～ 第 5 線」！特別注意「二分休止符」與「全休止符」的位置差異：';
    container.appendChild(info);

    const grid = document.createElement('div');
    grid.className = 'bankGrid';

    for (const p of NOTE_PROMPTS) {
      const card = document.createElement('div');
      card.className = 'bankItem';
      const cv = document.createElement('canvas');
      cv.width = 128;
      cv.height = 128;
      const c2 = cv.getContext('2d');
      c2.fillStyle = '#fffdf6';
      c2.fillRect(0, 0, 128, 128);
      drawReferenceSymbol(c2, p.id, 128, { showStaff: true });

      const meta = document.createElement('div');
      meta.className = 'bankMeta';
      meta.innerHTML = `
        <b>${p.name}（${p.beats}）</b>
        <small>${p.shortRule}</small>
        <div class="bankActions">
          <button type="button" class="tinyBtn">🔊 聽節奏音效</button>
        </div>
      `;
      meta.querySelector('button').addEventListener('click', () => {
        sound.playQuizPass(p.id);
      });

      card.append(cv, meta);
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }
}

function showScreen(sc) {
  state.uiScreen = sc;
  if (arena) arena.setShowcaseView(false, 'both');
  el('showcaseDock').classList.add('hide');
  el('drawScreen').classList.toggle('hide', sc !== 'draw');
  el('prepScreen').classList.toggle('hide', sc !== 'prep');
  el('hud').classList.toggle('hide', sc !== 'fight');
  el('fightTopBtns').classList.toggle('hide', sc !== 'fight');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
