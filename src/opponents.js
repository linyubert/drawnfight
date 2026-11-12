import { GRID_N, DRAW_MAX_ROW } from './constants.js';

function createEmptyGrid() {
  return new Uint8Array(GRID_N * GRID_N);
}

function fillRect(g, x0, y0, x1, y1) {
  const ax0 = Math.max(0, Math.min(x0, x1));
  const ax1 = Math.min(GRID_N - 1, Math.max(x0, x1));
  const ay0 = Math.max(0, Math.min(y0, y1));
  const ay1 = Math.min(DRAW_MAX_ROW, Math.max(y0, y1));
  for (let y = ay0; y <= ay1; y++) {
    for (let x = ax0; x <= ax1; x++) {
      g[y * GRID_N + x] = 1;
    }
  }
}

function fillCircle(g, cx, cy, r, hollow = false) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= GRID_N || y < 0 || y > DRAW_MAX_ROW) continue;
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (hollow) {
        if (d2 <= r * r && d2 >= (r - 2.4) * (r - 2.4)) g[y * GRID_N + x] = 1;
      } else if (d2 <= r * r) {
        g[y * GRID_N + x] = 1;
      }
    }
  }
}

function drawLine(g, x0, y0, x1, y1, r = 1.5) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, false);
  }
}

/**
 * Procedural 80x80 pixel weapons for all 8 Music-Samurai Gauntlet rivals!
 */
function buildOpponentWeapon(kind) {
  const g = createEmptyGrid();
  if (kind === 'recorder') {
    // Soprano recorder sword with finger holes!
    fillRect(g, 37, 22, 43, 66);
    fillRect(g, 38, 16, 42, 22);
    // Punch finger holes along the recorder body
    for (const hy of [28, 35, 42, 49, 56]) {
      g[hy * GRID_N + 40] = 0;
      g[hy * GRID_N + 39] = 0;
      g[(hy + 1) * GRID_N + 40] = 0;
    }
  } else if (kind === 'metronome') {
    // Metronome pendulum blade with sliding weight trapezoid
    drawLine(g, 40, 66, 40, 14, 1.5);
    fillRect(g, 33, 30, 47, 38); // sliding pendulum weight
    fillRect(g, 36, 12, 44, 16);
  } else if (kind === 'taiko') {
    // Thick Taiko drumstick + mini taiko drum head at top!
    fillRect(g, 37, 36, 43, 66);
    fillCircle(g, 40, 25, 11, false);
    fillCircle(g, 40, 25, 6, true);
  } else if (kind === 'guitar') {
    // Jagged rock electric-guitar V-blade!
    fillRect(g, 38, 12, 42, 50); // guitar neck + headstock
    fillRect(g, 36, 8, 45, 13);
    drawLine(g, 40, 46, 27, 63, 3.2); // Flying-V left wing
    drawLine(g, 40, 46, 53, 63, 3.2); // Flying-V right wing
    fillRect(g, 35, 45, 45, 58);
  } else if (kind === 'tuning_fork') {
    // Giant U-shaped Tuning Fork / Blacksmith Hammer!
    fillRect(g, 38, 44, 42, 66);
    fillRect(g, 28, 40, 52, 45); // crossbar
    fillRect(g, 28, 12, 33, 42); // left prong
    fillRect(g, 47, 12, 52, 42); // right prong
  } else if (kind === 'violin_bow') {
    // Sasaki Kojiro style ultra-long razor-thin Violin Bow!
    drawLine(g, 38, 66, 39, 4, 1.2); // bow stick
    drawLine(g, 43, 64, 42, 7, 0.7); // horsehair string
    fillRect(g, 37, 61, 44, 65); // frog
    fillRect(g, 38, 4, 43, 7); // tip
  } else if (kind === 'beethoven') {
    // Grand Treble-Greatsword / Symphony Score Broadblade!
    drawLine(g, 40, 66, 40, 8, 2.2);
    drawLine(g, 40, 10, 50, 20, 2.2);
    drawLine(g, 50, 20, 31, 36, 2.4);
    drawLine(g, 31, 36, 49, 49, 2.5);
    drawLine(g, 49, 49, 36, 56, 2.2);
  } else if (kind === 'buddha') {
    // Giant Golden Temple Bell / Khakkhara Monk Staff (錫杖＋梵鐘)!
    fillRect(g, 37, 34, 43, 66);
    fillCircle(g, 40, 20, 12, true); // outer sacred ring
    fillCircle(g, 40, 20, 5, false); // inner golden core
    fillRect(g, 26, 30, 54, 34); // lotus guard bar
    fillRect(g, 38, 4, 42, 10); // spire finial
  }
  return g;
}

export const OPPONENTS = [
  {
    stage: 1,
    id: 'recorder_kid',
    name: '直笛小學生',
    title: '第 1 戰・音樂課值日生',
    weaponName: '塑膠高音直笛',
    weaponKind: 'recorder',
    archetype: 'thin',
    archetypeLabel: '速音細劍',
    hp: 85,
    atk: 48,
    spd: 62,
    guard: 38,
    brk: 35,
    reach: 1.18,
    scale: 0.9,
    plan: 'balanced',
    move: 'overhead',
    colors: { top: '#ffffff', hakama: '#1d4ed8', band: '#facc15', blade: '#fef3c7', glow: '#60a5fa' },
    introQuote: '「看我的破音高音直笛斬！嗶——！」',
    loseQuote: '「嗚嗚，我的直笛吹不出聲音了…」',
    winQuote: '「嘿嘿！音樂課我有認真上喔！」',
    tip: '暖身對手！把題目指定的音符或休止符畫正確就能輕鬆取勝！',
  },
  {
    stage: 2,
    id: 'metronome_sensei',
    name: '節拍器師範',
    title: '第 2 戰・道場規律狂',
    weaponName: '精準擺錘刀',
    weaponKind: 'metronome',
    archetype: 'wide',
    archetypeLabel: '和弦寬盾刀',
    hp: 100,
    atk: 55,
    spd: 64,
    guard: 65,
    brk: 45,
    reach: 1.25,
    scale: 1.0,
    plan: 'defensive',
    move: 'sweep',
    colors: { top: '#f5f5f4', hakama: '#292524', band: '#ef4444', blade: '#78350f', glow: '#fbbf24' },
    introQuote: '「滴、答、滴、答…你的拍子亂掉就輸了！」',
    loseQuote: '「什…什麼！？這精準的節奏感…！」',
    winQuote: '「拍子還不夠穩，再練一百遍！」',
    tip: '對手擅長格擋（寬盾型），畫大一點或偏重擊的武器更容易破防！',
  },
  {
    stage: 3,
    id: 'taiko_chef',
    name: '太鼓板前長',
    title: '第 3 戰・祭典重槌手',
    weaponName: '大祭典太鼓槌',
    weaponKind: 'taiko',
    archetype: 'heavy',
    archetypeLabel: '重低音巨刃',
    hp: 118,
    atk: 72,
    spd: 46,
    guard: 50,
    brk: 78,
    reach: 1.24,
    scale: 1.06,
    plan: 'aggressive',
    move: 'overhead',
    colors: { top: '#1e293b', hakama: '#7c2d12', band: '#f8fafc', blade: '#dc2626', glow: '#fb923c' },
    introQuote: '「咚咚鏘！！吃我一記重低音大鼓槌！」',
    loseQuote: '「好快的劍…我的大鼓槌還沒揮下去啊！」',
    winQuote: '「咚！！這就是重低音的魄力！」',
    tip: '對手揮擊沉重但偏慢（重擊型），用高攻速或長距離先發制人！',
  },
  {
    stage: 4,
    id: 'pirate_guitarist',
    name: '搖滾海盜船長',
    title: '第 4 戰・七海電音客',
    weaponName: '閃電V型電吉他',
    weaponKind: 'guitar',
    archetype: 'heavy',
    archetypeLabel: '重低音巨刃',
    hp: 128,
    atk: 76,
    spd: 58,
    guard: 52,
    brk: 75,
    reach: 1.3,
    scale: 1.05,
    plan: 'aggressive',
    move: 'sweep',
    colors: { top: '#7f1d1d', hakama: '#111827', band: '#fbbf24', blade: '#ef4444', glow: '#f43f5e' },
    introQuote: '「刷扣即斬擊！來場狂野的海上重金屬對決吧！」',
    loseQuote: '「弦斷啦——！好強的音符劍！」',
    winQuote: '「哈哈！搖滾是不會停下來的！」',
    tip: '猛攻型海盜！選擇「見招拆招」或拉長音符符幹搶先刺擊很有效！',
  },
  {
    stage: 5,
    id: 'blacksmith_tuner',
    name: '音叉鍛冶屋',
    title: '第 5 戰・絕對音感鐵匠',
    weaponName: '440Hz巨型音叉',
    weaponKind: 'tuning_fork',
    archetype: 'wide',
    archetypeLabel: '和弦寬盾刀',
    hp: 140,
    atk: 68,
    spd: 60,
    guard: 84,
    brk: 64,
    reach: 1.32,
    scale: 1.08,
    plan: 'defensive',
    move: 'thrust',
    colors: { top: '#44403c', hakama: '#1c1917', band: '#f97316', blade: '#94a3b8', glow: '#38bdf8' },
    introQuote: '「雙叉架住你的劍，連一絲雜音都別想穿過！」',
    loseQuote: '「竟然震碎了我的精鋼音叉…名不虛傳！」',
    winQuote: '「噹——！這把音叉可是千錘百鍊！」',
    tip: '雙叉防守極硬（寬盾型）！把筆畫塗厚一點或選「猛攻」砸開他的防禦！',
  },
  {
    stage: 6,
    id: 'paganini_ronin',
    name: '佐佐木帕格尼尼',
    title: '第 6 戰・魔鬼小提琴劍客',
    weaponName: '燕返長弓（物干弓）',
    weaponKind: 'violin_bow',
    archetype: 'thin',
    archetypeLabel: '速音細劍',
    hp: 145,
    atk: 74,
    spd: 88,
    guard: 54,
    brk: 52,
    reach: 1.62,
    scale: 1.04,
    plan: 'aggressive',
    move: 'thrust',
    colors: { top: '#312e81', hakama: '#0f172a', band: '#a855f7', blade: '#cbd5e1', glow: '#c084fc' },
    introQuote: '「比燕子還快的二十四隨想曲連刺，你看得見嗎？」',
    loseQuote: '「好穩的招架…連我的魔鬼弓法都被看穿了！」',
    winQuote: '「太慢了，連一拍都跟不上！」',
    tip: '超長超快的細劍型強敵！選「穩守反擊」或寬闊的音符擋住再反擊！',
  },
  {
    stage: 7,
    id: 'maestro_beethoven',
    name: '樂聖貝多芬師範',
    title: '第 7 戰・命運交響劍豪',
    weaponName: '高音譜號大太刀',
    weaponKind: 'beethoven',
    archetype: 'wide',
    archetypeLabel: '和弦寬盾刀',
    hp: 162,
    atk: 82,
    spd: 74,
    guard: 78,
    brk: 76,
    reach: 1.46,
    scale: 1.1,
    plan: 'balanced',
    move: 'overhead',
    colors: { top: '#1e1b4b', hakama: '#450a0a', band: '#fde047', blade: '#e2e8f0', glow: '#f59e0b' },
    introQuote: '「登登登登——！！命運正在敲響你的道場大門！」',
    loseQuote: '「壯哉！！這就是超越命運的新樂章！」',
    winQuote: '「命運交響曲，可沒這麼容易突破！」',
    tip: '攻守兼備的準決賽大師！拿高分通過測驗（不看提示有額外加成）全力迎戰！',
  },
  {
    stage: 8,
    id: 'golden_buddha',
    name: '金色大佛指揮家',
    title: '最終決戰・極樂梵音大佛',
    weaponName: '萬鈞梵鐘錫杖',
    weaponKind: 'buddha',
    archetype: 'heavy',
    archetypeLabel: '重低音巨刃',
    hp: 215,
    atk: 88,
    spd: 54,
    guard: 76,
    brk: 92,
    reach: 1.72,
    scale: 1.78,
    isBoss: true,
    plan: 'aggressive',
    move: 'overhead',
    colors: { top: '#eab308', hakama: '#ca8a04', band: '#fef08a', blade: '#facc15', glow: '#fef08a' },
    introQuote: '「阿彌陀佛…聽見這響徹雲霄的終極梵鐘休止符了嗎？」',
    loseQuote: '「善哉善哉…施主的音符神劍，已達天人合一之境！」',
    winQuote: '「咚——！！大佛的一拍，可是重如泰山啊！」',
    tip: '最終巨型魔王！動作大開大合但一擊較沉，高攻速搶攻或手動「完美格擋」超有效！',
  },
];

// Pre-build grids lazily and cache
const weaponGridCache = new Map();
export function getOpponentWeaponGrid(opponent) {
  if (!weaponGridCache.has(opponent.id)) {
    weaponGridCache.set(opponent.id, buildOpponentWeapon(opponent.weaponKind));
  }
  return weaponGridCache.get(opponent.id);
}
