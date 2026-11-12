// Staff & Grid Geometry Constants (80x80 voxel grid mapped to 512x512 canvas)
export const GRID_N = 80;
export const PAD_PX = 512;
export const CELL_PX = PAD_PX / GRID_N; // 6.4px per cell

// 5-line staff rows (0 = top of pad, 79 = bottom of pad)
// Standard music numbering: Line 1 is bottom, Line 5 is top!
export const STAFF_LINES = {
  5: 16, // 第 5 線 (Top)
  4: 26, // 第 4 線
  3: 36, // 第 3 線 (Middle)
  2: 46, // 第 2 線
  1: 56, // 第 1 線 (Bottom)
};

export const LINE_SPACING = 10; // 10 grid cells between adjacent staff lines
export const DRAW_MAX_ROW = 66; // Rows 0..66 are drawable; 67..79 is the sword hilt base

// The 6 required musical symbols
export const NOTE_PROMPTS = [
  {
    id: 'quarter_note',
    name: '四分音符',
    enName: 'Quarter Note',
    beats: '1 拍',
    symbol: '♩',
    category: 'note',
    shortRule: '實心橢圓符頭 ＋ 直線符幹（無符尾）',
    verbalHint: '畫一個「塗滿實心」的橢圓形符頭，再連上一條直直的「符幹」（往上或往下都可以，不要畫尾巴喔）！',
    combatTraitName: '四拍正劍',
    combatTraitDesc: '攻守均衡＋精準斬擊（傷害與命中穩定提升 15%）',
    traitBonus: { dmg: 1.15, spd: 1.08, guard: 1.1, break: 1.1 },
    bladeColor: '#3b4252',
    glowColor: '#60a5fa',
    rhythmNotes: [
      { freq: 523.25, dur: 0.28, delay: 0 },
    ],
  },
  {
    id: 'eighth_note',
    name: '八分音符',
    enName: 'Eighth Note',
    beats: '半拍 (0.5 拍)',
    symbol: '♪',
    category: 'note',
    shortRule: '實心符頭 ＋ 直線符幹 ＋ 右側 1 條彎符尾',
    verbalHint: '先畫「塗滿實心」的符頭與直直的「符幹」，最後在符幹尖端往「右邊」畫出一條彎彎的符尾（小尾巴）！',
    combatTraitName: '疾風八分斬',
    combatTraitDesc: '半拍神速連擊（揮劍速度大幅提升 25%）',
    traitBonus: { dmg: 1.05, spd: 1.25, guard: 1.0, break: 1.05 },
    bladeColor: '#1e3a5f',
    glowColor: '#38bdf8',
    rhythmNotes: [
      { freq: 523.25, dur: 0.14, delay: 0 },
      { freq: 659.25, dur: 0.16, delay: 0.16 },
    ],
  },
  {
    id: 'half_note',
    name: '二分音符',
    enName: 'Half Note',
    beats: '2 拍',
    symbol: '𝅗𝅥',
    category: 'note',
    shortRule: '空心橢圓符頭 ＋ 直線符幹（無符尾）',
    verbalHint: '畫一個中間留白「空心」的橢圓圈圈當符頭（千萬別塗滿！），再連上一條直直的「符幹」！',
    combatTraitName: '共鳴二分刃',
    combatTraitDesc: '空心音箱共鳴（攻擊距離與招架反震提升 20%）',
    traitBonus: { dmg: 1.12, spd: 1.05, guard: 1.22, break: 1.08 },
    bladeColor: '#334155',
    glowColor: '#34d399',
    rhythmNotes: [
      { freq: 523.25, dur: 0.52, delay: 0 },
    ],
  },
  {
    id: 'quarter_rest',
    name: '四分休止符',
    enName: 'Quarter Rest',
    beats: '休息 1 拍',
    symbol: '𝄽',
    category: 'rest',
    shortRule: '五線譜中央「閃電 Z 字 ＋ 下方 C 型彎鉤」',
    verbalHint: '在五線譜中間（約第 4 線到第 2 線之間），像寫閃電一樣「右下 → 左下 → 右下」，最底下再加一個往左彎的小 C 鉤！',
    combatTraitName: '閃電休止返',
    combatTraitDesc: '看破節奏（格擋或擦身時觸發閃電反擊傷害 +25%）',
    traitBonus: { dmg: 1.14, spd: 1.18, guard: 1.18, break: 1.05 },
    bladeColor: '#4c1d95',
    glowColor: '#c084fc',
    rhythmNotes: [
      { freq: 392.0, dur: 0.09, delay: 0 },
      { freq: 587.33, dur: 0.2, delay: 0.22 },
    ],
  },
  {
    id: 'half_rest',
    name: '二分休止符',
    enName: 'Half Rest',
    beats: '休息 2 拍',
    symbol: '𝄻',
    category: 'rest',
    shortRule: '實心扁長方塊，坐在「第 3 線上方」（像紳士帽）',
    verbalHint: '口訣：「二分像帽子戴頭上」！在正中間「第 3 線的上面」畫一個塗滿實心的橫長方塊（約佔第三間下半部，不要碰到第 4 線）！',
    combatTraitName: '紳士帽鐵壁',
    combatTraitDesc: '穩坐中線（防禦減傷與招架穩定度大幅提升 28%）',
    traitBonus: { dmg: 1.08, spd: 1.0, guard: 1.3, break: 1.12 },
    bladeColor: '#065f46',
    glowColor: '#fbbf24',
    rhythmNotes: [
      { freq: 440.0, dur: 0.1, delay: 0 },
      { freq: 554.37, dur: 0.25, delay: 0.3 },
    ],
  },
  {
    id: 'whole_rest',
    name: '全休止符',
    enName: 'Whole Rest',
    beats: '休息 4 拍',
    symbol: '𝄺',
    category: 'rest',
    shortRule: '實心扁長方塊，掛在「第 4 線下方」（像倒掛臉盆）',
    verbalHint: '口訣：「全休太重往下掉」！在上面數來第二條「第 4 線的下面」畫一個塗滿實心的橫長方塊（約佔第三間上半部，不要碰到第 3 線）！',
    combatTraitName: '萬鈞全休錘',
    combatTraitDesc: '四拍重壓（破防威力提升 32%，能直接砸碎敵人防禦！）',
    traitBonus: { dmg: 1.2, spd: 0.96, guard: 1.1, break: 1.35 },
    bladeColor: '#7c2d12',
    glowColor: '#fb923c',
    rhythmNotes: [
      { freq: 329.63, dur: 0.12, delay: 0 },
      { freq: 659.25, dur: 0.35, delay: 0.36 },
    ],
  },
];

export const PROMPT_MAP = Object.fromEntries(NOTE_PROMPTS.map((p) => [p.id, p]));

/**
 * Draw a clean canonical reference of any of the 6 symbols onto a 2D canvas context.
 * Used for:
 * 1) Optional "偷看提示" ghost overlay on the drawing pad
 * 2) Post-quiz / Encyclopedia educational diagram
 */
export function drawReferenceSymbol(ctx, promptId, sizePx, options = {}) {
  const {
    ghost = false,
    showStaff = false,
  } = options;
  const s = sizePx / PAD_PX;
  ctx.save();
  ctx.scale(s, s);

  if (showStaff) {
    ctx.strokeStyle = '#cbbba0';
    ctx.lineWidth = 2;
    for (let line = 1; line <= 5; line++) {
      const y = (STAFF_LINES[line] + 0.5) * CELL_PX;
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(PAD_PX - 24, y);
      ctx.stroke();

      ctx.fillStyle = line === 3 || line === 4 ? '#9a6b3b' : '#a89984';
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.fillText(`${line}線`, 28, y - 5);
    }
  }

  const color = ghost ? 'rgba(255, 106, 61, 0.32)' : '#1b1b22';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (ghost) {
    ctx.setLineDash([10, 8]);
  }

  const yLine3 = (STAFF_LINES[3] + 0.5) * CELL_PX; // ~233.6
  const yLine4 = (STAFF_LINES[4] + 0.5) * CELL_PX; // ~169.6
  const yLine2 = (STAFF_LINES[2] + 0.5) * CELL_PX; // ~297.6
  const cx = PAD_PX * 0.5;

  if (promptId === 'quarter_note' || promptId === 'half_note' || promptId === 'eighth_note') {
    // Head centered around Space 1 / Line 2 (y ~ 298)
    const headX = cx - 22;
    const headY = yLine2;
    const rx = 36;
    const ry = 25;

    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(-0.32);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    if (promptId === 'half_note') {
      ctx.lineWidth = 14;
      ctx.stroke();
    } else {
      ctx.fill();
      if (ghost) {
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }
    ctx.restore();

    // Stem going up on the right side of the notehead
    const stemX = headX + rx - 6;
    const stemBottomY = headY - 4;
    const stemTopY = headY - 185;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(stemX, stemBottomY);
    ctx.lineTo(stemX, stemTopY);
    ctx.stroke();

    if (promptId === 'eighth_note') {
      // Curved flag to the right
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(stemX, stemTopY + 4);
      ctx.bezierCurveTo(
        stemX + 58, stemTopY + 34,
        stemX + 74, stemTopY + 78,
        stemX + 42, stemTopY + 124
      );
      ctx.stroke();
    }
  } else if (promptId === 'quarter_rest') {
    // Classic quarter rest: zigzag + bottom C-hook centered around Line 4..Line 2
    const topY = yLine4 - 24;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(cx - 18, topY);
    ctx.lineTo(cx + 24, topY + 52);
    ctx.lineTo(cx - 22, topY + 102);
    ctx.lineTo(cx + 22, topY + 148);
    ctx.quadraticCurveTo(cx - 34, topY + 156, cx - 14, topY + 196);
    ctx.stroke();
  } else if (promptId === 'half_rest') {
    // Sits ON TOP OF Line 3 (occupying lower half of Space 3)
    const blockW = 104;
    const blockH = 31;
    const blockX = cx - blockW / 2;
    const blockY = yLine3 - blockH;
    ctx.fillRect(blockX, blockY, blockW, blockH);
    if (ghost) {
      ctx.lineWidth = 4;
      ctx.strokeRect(blockX, blockY, blockW, blockH);
    }
    // Emphasize sitting on Line 3 with subtle brim ticks
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(blockX - 20, yLine3);
    ctx.lineTo(blockX + blockW + 20, yLine3);
    ctx.stroke();
  } else if (promptId === 'whole_rest') {
    // Hangs BELOW Line 4 (occupying upper half of Space 3)
    const blockW = 104;
    const blockH = 31;
    const blockX = cx - blockW / 2;
    const blockY = yLine4;
    ctx.fillRect(blockX, blockY, blockW, blockH);
    if (ghost) {
      ctx.lineWidth = 4;
      ctx.strokeRect(blockX, blockY, blockW, blockH);
    }
    // Emphasize hanging under Line 4
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(blockX - 20, yLine4);
    ctx.lineTo(blockX + blockW + 20, yLine4);
    ctx.stroke();
  }

  ctx.restore();
}

export const SWORD_NAME_PARTS = {
  prefixByPrompt: {
    quarter_note: ['正拍', '四分', '踏實', '定音'],
    eighth_note: ['疾風', '八分', '連音', '閃光'],
    half_note: ['共鳴', '空心', '二分', '迴響'],
    quarter_rest: ['閃電', '瞬止', '雷鳴', '留白'],
    half_rest: ['紳士帽', '中線', '鐵壁', '靜寂'],
    whole_rest: ['萬鈞', '全休', '鎮魂', '無聲'],
  },
  suffixByArchetype: {
    thin: ['細劍', '速音丸', '指揮刀', '刺劍'],
    heavy: ['重錘', '大太刀', '巨刃', '破陣刀'],
    wide: ['護手刀', '音盾丸', '斬馬刀', '闊劍'],
  },
};
