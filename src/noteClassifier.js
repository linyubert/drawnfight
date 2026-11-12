import {
  GRID_N,
  STAFF_LINES,
  LINE_SPACING,
  DRAW_MAX_ROW,
  PROMPT_MAP,
  SWORD_NAME_PARTS,
} from './constants.js';

/**
 * Dilate binary grid (80x80) by radius r (Chebyshev distance) within [0..maxRow]
 */
function dilateGrid(grid, r = 1, maxRow = DRAW_MAX_ROW) {
  const out = new Uint8Array(GRID_N * GRID_N);
  for (let y = 0; y <= maxRow; y++) {
    for (let x = 0; x < GRID_N; x++) {
      if (!grid[y * GRID_N + x]) continue;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(maxRow, y + r);
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(GRID_N - 1, x + r);
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          out[yy * GRID_N + xx] = 1;
        }
      }
    }
  }
  return out;
}

function erodeGrid(grid, r = 1, maxRow = DRAW_MAX_ROW) {
  const out = new Uint8Array(GRID_N * GRID_N);
  for (let y = 0; y <= maxRow; y++) {
    for (let x = 0; x < GRID_N; x++) {
      if (!grid[y * GRID_N + x]) continue;
      let ok = true;
      for (let yy = y - r; yy <= y + r && ok; yy++) {
        for (let xx = x - r; xx <= x + r; xx++) {
          if (yy < 0 || yy > maxRow || xx < 0 || xx >= GRID_N || !grid[yy * GRID_N + xx]) {
            ok = false;
            break;
          }
        }
      }
      if (ok) out[y * GRID_N + x] = 1;
    }
  }
  return out;
}

/**
 * Morphological close (dilate then erode) to bridge 1-cell pen-lift gaps
 */
function closeGrid(grid, r = 1, maxRow = DRAW_MAX_ROW) {
  return erodeGrid(dilateGrid(grid, r, maxRow), r, maxRow);
}

/**
 * Find connected components allowing up to `bridgeGap` cell distance between strokes
 */
function extractComponents(rawGrid) {
  const visited = new Uint8Array(GRID_N * GRID_N);
  const components = [];

  for (let y = 0; y <= DRAW_MAX_ROW; y++) {
    for (let x = 0; x < GRID_N; x++) {
      const idx = y * GRID_N + x;
      if (!rawGrid[idx] || visited[idx]) continue;

      const cells = [];
      const queue = [idx];
      visited[idx] = 1;

      while (queue.length > 0) {
        const cur = queue.pop();
        cells.push(cur);
        const cy = Math.floor(cur / GRID_N);
        const cx = cur % GRID_N;

        // 2-cell neighborhood bridges tiny 1-cell pen-lift gaps between head & stem
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = cy + dy;
            const nx = cx + dx;
            if (ny < 0 || ny > DRAW_MAX_ROW || nx < 0 || nx >= GRID_N) continue;
            const nIdx = ny * GRID_N + nx;
            if (rawGrid[nIdx] && !visited[nIdx]) {
              visited[nIdx] = 1;
              queue.push(nIdx);
            }
          }
        }
      }
      components.push(cells);
    }
  }

  components.sort((a, b) => b.length - a.length);
  return components;
}

/**
 * Count enclosed background (0) pixels inside a sub-box [x0..x1, y0..y1]
 * Flood-fills 0s from outside a 1-cell margin around the sub-box.
 */
function countEnclosedHolesInBox(grid, x0, y0, x1, y1) {
  const bx0 = Math.max(0, x0 - 1);
  const by0 = Math.max(0, y0 - 1);
  const bx1 = Math.min(GRID_N - 1, x1 + 1);
  const by1 = Math.min(DRAW_MAX_ROW, y1 + 1);
  const bw = bx1 - bx0 + 1;
  const bh = by1 - by0 + 1;
  const outside = new Uint8Array(bw * bh);
  const q = [];

  const trySeed = (lx, ly) => {
    const gx = bx0 + lx;
    const gy = by0 + ly;
    const bi = ly * bw + lx;
    if (!outside[bi] && !grid[gy * GRID_N + gx]) {
      outside[bi] = 1;
      q.push(bi);
    }
  };

  for (let lx = 0; lx < bw; lx++) {
    trySeed(lx, 0);
    trySeed(lx, bh - 1);
  }
  for (let ly = 0; ly < bh; ly++) {
    trySeed(0, ly);
    trySeed(bw - 1, ly);
  }

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (q.length > 0) {
    const cur = q.pop();
    const ly = Math.floor(cur / bw);
    const lx = cur % bw;
    for (const [dx, dy] of dirs) {
      const nx = lx + dx;
      const ny = ly + dy;
      if (nx < 0 || nx >= bw || ny < 0 || ny >= bh) continue;
      const nbi = ny * bw + nx;
      if (outside[nbi]) continue;
      const gx = bx0 + nx;
      const gy = by0 + ny;
      if (!grid[gy * GRID_N + gx]) {
        outside[nbi] = 1;
        q.push(nbi);
      }
    }
  }

  let holeCount = 0;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const lx = gx - bx0;
      const ly = gy - by0;
      if (!grid[gy * GRID_N + gx] && !outside[ly * bw + lx]) {
        holeCount++;
      }
    }
  }
  return holeCount;
}

/**
 * Check if all 4 cardinal directions from (cx, cy) hit ink within box
 */
function isSurrounded4Way(grid, cx, cy, x0, y0, x1, y1) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  for (let y = cy - 1; y >= y0; y--) if (grid[y * GRID_N + cx]) { up = true; break; }
  for (let y = cy + 1; y <= y1; y++) if (grid[y * GRID_N + cx]) { down = true; break; }
  for (let x = cx - 1; x >= x0; x--) if (grid[cy * GRID_N + x]) { left = true; break; }
  for (let x = cx + 1; x <= x1; x++) if (grid[cy * GRID_N + x]) { right = true; break; }
  return up && down && left && right;
}

/**
 * Compute physical 3D weapon stats from the drawn grid + musical symbol bonus + quiz score
 */
export function computeWeaponStats(grid, promptId, quizScore = 85, usedHint = false) {
  let ink = 0;
  let minX = GRID_N;
  let maxX = -1;
  let minY = DRAW_MAX_ROW + 1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;
  let perimeter = 0;

  for (let y = 0; y <= DRAW_MAX_ROW; y++) {
    for (let x = 0; x < GRID_N; x++) {
      if (!grid[y * GRID_N + x]) continue;
      ink++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sumX += x;
      sumY += y;

      if (
        x === 0 || x === GRID_N - 1 || y === 0 || y === DRAW_MAX_ROW ||
        !grid[(y - 1) * GRID_N + x] ||
        !grid[(y + 1) * GRID_N + x] ||
        !grid[y * GRID_N + (x - 1)] ||
        !grid[y * GRID_N + (x + 1)]
      ) {
        perimeter++;
      }
    }
  }

  if (ink === 0) {
    return {
      empty: true,
      lengthCm: 28,
      weightKg: 0.4,
      edgePct: 0,
      archetype: 'thin',
      archetypeLabel: '空劍柄',
      comX: GRID_N / 2,
      comY: DRAW_MAX_ROW,
      powerRating: 0,
      atk: 10,
      spd: 50,
      guard: 20,
      brk: 10,
      reach: 1.0,
    };
  }

  const spanH = DRAW_MAX_ROW - minY + 1; // Height from hilt guard up to highest drawn pixel
  const symbolH = maxY - minY + 1;
  const symbolW = maxX - minX + 1;

  const lengthCm = Math.round(30 + spanH * 2.15);
  const weightKg = Math.round((0.45 + ink * 0.0068) * 10) / 10;
  const edgePct = Math.min(99, Math.max(15, Math.round((perimeter / Math.max(1, ink)) * 115)));

  // Determine Rakugaki Kengo 3-way archetype:
  // thin (細快), heavy (重擊), wide (寬盾)
  let archetype = 'thin';
  if (ink >= 260 || (weightKg >= 2.1 && symbolW < symbolH * 1.15)) {
    archetype = 'heavy';
  } else if (symbolW >= 20 && (symbolW >= symbolH * 0.68 || promptId === 'half_rest' || promptId === 'half_note')) {
    archetype = 'wide';
  } else if (promptId === 'whole_rest' && ink >= 110) {
    archetype = 'heavy';
  } else if (symbolW >= 24) {
    archetype = 'wide';
  } else if (ink >= 210) {
    archetype = 'heavy';
  }

  const archetypeLabels = {
    thin: '速音細劍',
    heavy: '重低音巨刃',
    wide: '和弦寬盾刀',
  };

  const prompt = PROMPT_MAP[promptId] || PROMPT_MAP.quarter_note;
  const tb = prompt.traitBonus;
  const accuracyMult = 0.85 + (Math.max(60, quizScore) - 60) * 0.0065; // 0.85 .. 1.11
  const memoryMult = usedHint ? 1.0 : 1.08;
  const totalMult = accuracyMult * memoryMult;

  const baseAtk = archetype === 'heavy' ? 76 : archetype === 'thin' ? 62 : 58;
  const baseSpd = archetype === 'thin' ? 84 : archetype === 'wide' ? 66 : 50;
  const baseGuard = archetype === 'wide' ? 85 : archetype === 'heavy' ? 60 : 52;
  const baseBrk = archetype === 'heavy' ? 88 : archetype === 'wide' ? 58 : 48;

  const atk = Math.min(100, Math.round(baseAtk * tb.dmg * totalMult));
  const spd = Math.min(100, Math.round(baseSpd * tb.spd * (0.95 + (quizScore - 60) * 0.0025)));
  const guard = Math.min(100, Math.round(baseGuard * tb.guard * accuracyMult));
  const brk = Math.min(100, Math.round(baseBrk * tb.break * totalMult));
  const reach = Math.max(0.95, Math.min(1.85, 0.78 + spanH * 0.016));

  const prefixes = SWORD_NAME_PARTS.prefixByPrompt[promptId] || ['音律'];
  const suffixes = SWORD_NAME_PARTS.suffixByArchetype[archetype] || ['名刀'];
  const autoName = `${prefixes[ink % prefixes.length]}之${suffixes[(symbolW + symbolH) % suffixes.length]}`;

  return {
    empty: false,
    ink,
    minX,
    maxX,
    minY,
    maxY,
    symbolW,
    symbolH,
    spanH,
    lengthCm,
    weightKg,
    edgePct,
    archetype,
    archetypeLabel: archetypeLabels[archetype],
    comX: sumX / ink,
    comY: sumY / ink,
    atk,
    spd,
    guard,
    brk,
    reach,
    usedHint,
    quizScore,
    autoName,
  };
}

/**
 * Analyze note candidate (Notehead + Stem + optional Flag)
 */
function analyzeNoteCandidate(cleanGrid, closedGrid, bbox) {
  const { minX, maxX, minY, maxY, w, h } = bbox;
  if (h < 14) return { isNote: false };

  // Test both stem-up (head at bottom) and stem-down (head at top)
  const candidates = [
    { stemUp: true, hy0: Math.max(minY, maxY - Math.max(7, Math.round(h * 0.37))), hy1: maxY },
    { stemUp: false, hy0: minY, hy1: Math.min(maxY, minY + Math.max(7, Math.round(h * 0.37))) },
  ];

  let best = null;

  for (const cand of candidates) {
    const { stemUp, hy0, hy1 } = cand;
    // Measure bounding X of the putative notehead rows
    let hx0 = GRID_N;
    let hx1 = -1;
    let headInk = 0;
    for (let y = hy0; y <= hy1; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (cleanGrid[y * GRID_N + x]) {
          if (x < hx0) hx0 = x;
          if (x > hx1) hx1 = x;
          headInk++;
        }
      }
    }
    if (hx1 < hx0) continue;
    const headW = hx1 - hx0 + 1;
    const headH = hy1 - hy0 + 1;
    if (headW < 6 || headH < 5) continue;

    // Look for a vertical stem extending out of the notehead into the remaining height
    const shaftY0 = stemUp ? minY : hy1 + 1;
    const shaftY1 = stemUp ? hy0 - 1 : maxY;
    const shaftH = shaftY1 - shaftY0 + 1;
    if (shaftH < 8) continue;

    // Find best stem line X(y) = sx + slope * (y - shaftY0) allowing slight hand tilt (-14°..+14°)
    let bestStemX = -1;
    let bestSlope = 0;
    let bestStemRows = 0;
    const slopes = [0, -0.12, 0.12, -0.24, 0.24];
    for (const slope of slopes) {
      for (let sx = minX; sx <= maxX; sx++) {
        let coveredRows = 0;
        for (let y = shaftY0; y <= shaftY1; y++) {
          const cxLine = Math.round(sx + slope * (y - shaftY0));
          if (cxLine < 0 || cxLine >= GRID_N) continue;
          if (
            cleanGrid[y * GRID_N + cxLine] ||
            (cxLine > 0 && cleanGrid[y * GRID_N + (cxLine - 1)]) ||
            (cxLine < GRID_N - 1 && cleanGrid[y * GRID_N + (cxLine + 1)])
          ) {
            coveredRows++;
          }
        }
        if (coveredRows > bestStemRows) {
          bestStemRows = coveredRows;
          bestStemX = sx;
          bestSlope = slope;
        }
      }
    }

    const stemXAt = (y) => Math.round(bestStemX + bestSlope * (y - shaftY0));
    const stemXNearHead = stemXAt(stemUp ? shaftY1 : shaftY0);

    const stemCoverage = bestStemRows / shaftH;
    if (stemCoverage < 0.72) continue;

    // Also verify the stem connects near the notehead horizontally
    if (stemXNearHead < hx0 - 3 || stemXNearHead > hx1 + 3) continue;

    // Estimate stem thickness in the shaft portion near the head (before any flag)
    const nearHeadY0 = stemUp ? Math.max(shaftY0, hy0 - Math.max(4, Math.round(shaftH * 0.35))) : shaftY0;
    const nearHeadY1 = stemUp ? hy0 - 1 : Math.min(shaftY1, hy1 + Math.max(4, Math.round(shaftH * 0.35)));
    const widthsNearHead = [];
    for (let y = nearHeadY0; y <= nearHeadY1; y++) {
      let lx = GRID_N;
      let rx = -1;
      for (let x = minX; x <= maxX; x++) {
        if (cleanGrid[y * GRID_N + x]) {
          if (x < lx) lx = x;
          if (x > rx) rx = x;
        }
      }
      if (rx >= lx) {
        widthsNearHead.push(rx - lx + 1);
      }
    }
    widthsNearHead.sort((a, b) => a - b);
    const stemThickness = widthsNearHead.length
      ? widthsNearHead[Math.floor(widthsNearHead.length * 0.4)]
      : 3;

    // Notehead must be noticeably wider than the stem stroke itself!
    if (headW < stemThickness + 3 || headW < 6) continue;

    // Check continuity along the stem line across the shaft:
    let straightShaftRows = 0;
    for (let y = shaftY0; y <= shaftY1; y++) {
      const sxLine = stemXAt(y);
      let rowHasStem = false;
      for (let dx = -3; dx <= 3; dx++) {
        const xx = sxLine + dx;
        if (xx >= 0 && xx < GRID_N && cleanGrid[y * GRID_N + xx]) {
          rowHasStem = true;
          break;
        }
      }
      if (rowHasStem) straightShaftRows++;
    }
    if (straightShaftRows / shaftH < 0.72) continue;

    // Score which end is more genuinely the oval notehead:
    // True notehead has larger compact mass near its center and straight narrow neck right next to it
    const headArea = headW * headH;
    const headFill = headInk / Math.max(1, headArea);
    const holesRaw = countEnclosedHolesInBox(cleanGrid, hx0, hy0, hx1, hy1);
    const holesClosed = countEnclosedHolesInBox(closedGrid, hx0, hy0, hx1, hy1);

    // Check inner core of notehead (central 36% box)
    const cx0 = hx0 + Math.max(1, Math.floor(headW * 0.32));
    const cx1 = hx1 - Math.max(1, Math.floor(headW * 0.32));
    const cy0 = hy0 + Math.max(1, Math.floor(headH * 0.3));
    const cy1 = hy1 - Math.max(1, Math.floor(headH * 0.3));
    let coreCells = 0;
    let coreInk = 0;
    for (let y = cy0; y <= cy1; y++) {
      for (let x = cx0; x <= cx1; x++) {
        coreCells++;
        if (cleanGrid[y * GRID_N + x]) coreInk++;
      }
    }
    const coreFill = coreCells > 0 ? coreInk / coreCells : headFill;
    const midX = Math.round((hx0 + hx1) / 2);
    const midY = Math.round((hy0 + hy1) / 2);
    const surrounded = isSurrounded4Way(closedGrid, midX, midY, hx0, hy0, hx1, hy1);

    const isHollow =
      (holesClosed >= 5 && coreFill <= 0.38) ||
      (holesRaw >= 4 && coreFill <= 0.42) ||
      (surrounded && coreFill <= 0.25 && headW >= 8 && headH >= 6);

    const isFilled = !isHollow && headFill >= 0.44 && coreFill >= 0.52 && holesRaw <= 4;

    if (!isHollow && !isFilled) {
      // Could still be an ambiguous notehead (partially filled)
    }

    // Check Flag in the tip half of the shaft (away from the notehead)
    const tipY0 = stemUp ? shaftY0 : Math.floor((shaftY0 + shaftY1) / 2);
    const tipY1 = stemUp ? Math.ceil((shaftY0 + shaftY1) / 2) + 2 : shaftY1;
    const stemHalfW = Math.max(1, Math.ceil(stemThickness / 2));

    let rightFlagInk = 0;
    let maxRightReach = 0;
    let leftFlagInk = 0;
    let maxLeftReach = 0;

    for (let y = tipY0; y <= tipY1; y++) {
      const sxY = stemXAt(y);
      for (let x = minX; x <= maxX; x++) {
        if (!cleanGrid[y * GRID_N + x]) continue;
        const dr = x - (sxY + stemHalfW);
        if (dr >= 2) {
          rightFlagInk++;
          if (dr > maxRightReach) maxRightReach = dr;
        }
        const dl = (sxY - stemHalfW) - x;
        if (dl >= 2) {
          leftFlagInk++;
          if (dl > maxLeftReach) maxLeftReach = dl;
        }
      }
    }

    // Also check slightly lower down the upper 70% of shaft for long sweeping flags
    const extTipY0 = stemUp ? shaftY0 : shaftY0 + Math.floor(shaftH * 0.28);
    const extTipY1 = stemUp ? shaftY0 + Math.ceil(shaftH * 0.72) : shaftY1;
    let extRightFlagInk = 0;
    for (let y = extTipY0; y <= extTipY1; y++) {
      const sxY = stemXAt(y);
      for (let x = sxY + stemHalfW + 2; x <= maxX; x++) {
        if (cleanGrid[y * GRID_N + x]) extRightFlagInk++;
      }
    }

    const hasRightFlag = maxRightReach >= 4 && (rightFlagInk >= 5 || extRightFlagInk >= 7);
    const hasLeftFlag = !hasRightFlag && maxLeftReach >= 5 && leftFlagInk >= 7;

    // Prefer the orientation where the neck adjacent to the head is narrower & head is rounder
    const headAspect = headW / headH;
    const aspectPenalty = headAspect < 0.65 || headAspect > 2.6 ? 25 : 0;
    const neckNarrowBonus = Math.max(0, headW - stemThickness) * 3;
    // Standard stem-up has head on left/center of stem; stem-down has head on right/center of stem
    const standardSideBonus = stemUp
      ? (stemXNearHead >= (hx0 + hx1) / 2 - 2 ? 12 : 0)
      : (stemXNearHead <= (hx0 + hx1) / 2 + 2 ? 12 : 0);

    const candQuality =
      stemCoverage * 40 +
      neckNarrowBonus +
      standardSideBonus -
      aspectPenalty +
      (isHollow || isFilled ? 20 : 0);

    if (!best || candQuality > best.candQuality) {
      best = {
        isNote: true,
        stemUp,
        hx0,
        hx1,
        hy0,
        hy1,
        headW,
        headH,
        headFill,
        coreFill,
        holesRaw,
        holesClosed,
        isHollow,
        isFilled,
        stemX: bestStemX,
        stemThickness,
        stemCoverage,
        shaftH,
        hasRightFlag,
        hasLeftFlag,
        maxRightReach,
        rightFlagInk: Math.max(rightFlagInk, extRightFlagInk),
        candQuality,
      };
    }
  }

  return best || { isNote: false };
}

/**
 * Analyze Quarter Rest (`𝄽`) zigzag / squiggle candidate
 */
function analyzeQuarterRest(cleanGrid, bbox) {
  const { minX, maxX, minY, maxY, w, h } = bbox;
  if (h < 13 || w < 5 || w > 34 || h < w * 0.95) {
    return { isQuarterRest: false };
  }

  // Compute row center and row width across [minY..maxY]
  const centers = [];
  const spans = [];
  for (let y = minY; y <= maxY; y++) {
    let lx = GRID_N;
    let rx = -1;
    for (let x = minX; x <= maxX; x++) {
      if (cleanGrid[y * GRID_N + x]) {
        if (x < lx) lx = x;
        if (x > rx) rx = x;
      }
    }
    if (rx >= lx) {
      centers.push((lx + rx) / 2);
      spans.push(rx - lx + 1);
    }
  }

  if (centers.length < 12) return { isQuarterRest: false };

  // Smooth centers with window 3
  const smooth = centers.map((_, i) => {
    const a = centers[Math.max(0, i - 1)];
    const b = centers[i];
    const c = centers[Math.min(centers.length - 1, i + 1)];
    return (a + b + c) / 3;
  });

  // Count significant horizontal direction reversals (zigzag turning points)
  let dir = 0; // +1 right, -1 left
  let anchor = smooth[0];
  let reversals = 0;
  const minSwing = Math.max(2.0, w * 0.18);

  for (let i = 1; i < smooth.length; i++) {
    const diff = smooth[i] - anchor;
    if (dir === 0) {
      if (Math.abs(diff) >= minSwing) {
        dir = diff > 0 ? 1 : -1;
        anchor = smooth[i];
      }
    } else if (dir === 1) {
      if (smooth[i] > anchor) {
        anchor = smooth[i];
      } else if (anchor - smooth[i] >= minSwing) {
        reversals++;
        dir = -1;
        anchor = smooth[i];
      }
    } else if (dir === -1) {
      if (smooth[i] < anchor) {
        anchor = smooth[i];
      } else if (smooth[i] - anchor >= minSwing) {
        reversals++;
        dir = 1;
        anchor = smooth[i];
      }
    }
  }

  const medianSpan = [...spans].sort((a, b) => a - b)[Math.floor(spans.length / 2)];
  const cy = (minY + maxY) / 2;
  const staffCentered = cy >= STAFF_LINES[5] - 2 && cy <= STAFF_LINES[1] + 4;

  // Quarter rest has >= 2 horizontal direction reversals (at least 3 alternating strokes: e.g. \ / \ or \ / c)
  // and isn't a thick solid block
  const isQuarterRest = reversals >= 2 && w >= 6 && medianSpan <= Math.max(10, w * 0.68) && staffCentered;

  return {
    isQuarterRest,
    reversals,
    staffCentered,
    medianSpan,
  };
}

/**
 * Analyze Horizontal Block Rest (`二分休止符` / `全休止符`)
 */
function analyzeBlockRest(cleanGrid, closedGrid, bbox) {
  const { minX, maxX, minY, maxY, w, h } = bbox;
  if (w < 6 || h < 2 || h > 16 || w < h * 1.15) {
    return { isBlockCandidate: false };
  }

  // Row spans to detect optional hat brim (___▄___ or ¯¯¯▀¯¯¯)
  const rowInfo = [];
  for (let y = minY; y <= maxY; y++) {
    let lx = GRID_N;
    let rx = -1;
    let cnt = 0;
    for (let x = minX; x <= maxX; x++) {
      if (cleanGrid[y * GRID_N + x]) {
        if (x < lx) lx = x;
        if (x > rx) rx = x;
        cnt++;
      }
    }
    if (rx >= lx) {
      rowInfo.push({ y, lx, rx, span: rx - lx + 1, cnt });
    }
  }
  if (rowInfo.length < 2) return { isBlockCandidate: false };

  const sortedSpans = rowInfo.map((r) => r.span).sort((a, b) => a - b);
  const medSpan = sortedSpans[Math.floor(sortedSpans.length * 0.5)];

  // Check if top 1-2 rows or bottom 1-2 rows are wider brims
  let hasTopBrim = false;
  let hasBottomBrim = false;
  let coreRows = rowInfo;

  if (rowInfo.length >= 4) {
    const topMaxSpan = Math.max(rowInfo[0].span, rowInfo[1].span);
    const botMaxSpan = Math.max(rowInfo[rowInfo.length - 1].span, rowInfo[rowInfo.length - 2].span);
    if (topMaxSpan >= medSpan * 1.25 && botMaxSpan < medSpan * 1.18) {
      hasTopBrim = true;
      coreRows = rowInfo.filter((r, idx) => !(idx <= 1 && r.span > medSpan * 1.18));
    } else if (botMaxSpan >= medSpan * 1.25 && topMaxSpan < medSpan * 1.18) {
      hasBottomBrim = true;
      coreRows = rowInfo.filter((r, idx) => !(idx >= rowInfo.length - 2 && r.span > medSpan * 1.18));
    }
  }

  if (coreRows.length === 0) coreRows = rowInfo;

  const coreMinY = coreRows[0].y;
  const coreMaxY = coreRows[coreRows.length - 1].y;
  let coreMinX = GRID_N;
  let coreMaxX = -1;
  let coreInk = 0;
  let coreWeightedY = 0;
  for (const r of coreRows) {
    if (r.lx < coreMinX) coreMinX = r.lx;
    if (r.rx > coreMaxX) coreMaxX = r.rx;
    coreInk += r.cnt;
    coreWeightedY += r.y * r.cnt;
  }

  const coreW = coreMaxX - coreMinX + 1;
  const coreH = coreMaxY - coreMinY + 1;
  const coreArea = Math.max(1, coreW * coreH);
  const coreFill = coreInk / coreArea;
  const coreCy = coreInk > 0 ? coreWeightedY / coreInk : (coreMinY + coreMaxY) / 2;
  const holes = countEnclosedHolesInBox(closedGrid, coreMinX, coreMinY, coreMaxX, coreMaxY);

  const isFilledBlock = coreFill >= 0.5 && holes <= Math.max(3, coreArea * 0.12);
  const isHollowBlock = !isFilledBlock && (holes >= 4 || coreFill < 0.48);

  const y4 = STAFF_LINES[4]; // 26
  const y3 = STAFF_LINES[3]; // 36
  const mid34 = (y4 + y3) / 2; // 31

  // Check if they filled the entire Space 3 touching both Line 4 and Line 3 without a clear brim
  const touchesBoth3And4 =
    !hasTopBrim &&
    !hasBottomBrim &&
    coreMinY <= y4 + 1 &&
    coreMaxY >= y3 - 1 &&
    coreH >= LINE_SPACING - 2;

  // Half rest: sits ON TOP OF Line 3 (lower half of Space 3)
  const sitsOnLine3 =
    !touchesBoth3And4 &&
    coreMaxY >= y3 - 3 &&
    coreMaxY <= y3 + 3 &&
    coreMinY >= y4 + 2 &&
    coreCy >= mid34 - 0.6 &&
    !hasTopBrim;

  // Whole rest: hangs BELOW Line 4 (upper half of Space 3)
  const hangsUnderLine4 =
    !touchesBoth3And4 &&
    coreMinY >= y4 - 3 &&
    coreMinY <= y4 + 3 &&
    coreMaxY <= y3 - 2 &&
    coreCy <= mid34 + 0.6 &&
    !hasBottomBrim;

  return {
    isBlockCandidate: true,
    isFilledBlock,
    isHollowBlock,
    hasTopBrim,
    hasBottomBrim,
    coreMinY,
    coreMaxY,
    coreW,
    coreH,
    coreFill,
    coreCy,
    touchesBoth3And4,
    sitsOnLine3,
    hangsUnderLine4,
  };
}

/**
 * Main Evaluation Entry Point:
 * Grades whether `rawGrid` matches `targetPromptId` and provides specific educational feedback!
 */
export function evaluateDrawing(rawGrid, targetPromptId, usedHint = false) {
  const target = PROMPT_MAP[targetPromptId];
  const components = extractComponents(rawGrid);
  const sigComponents = components.filter((c) => c.length >= 5);

  if (sigComponents.length === 0) {
    return {
      passed: false,
      score: 0,
      grade: '—',
      detectedId: null,
      feedback: `畫板還是空的喔！請在五線譜上畫出「${target.name}」。`,
    };
  }

  // Check if player drew multiple disconnected large objects (e.g. ♫ two notes)
  if (sigComponents.length >= 2 && sigComponents[1].length >= 18) {
    return {
      passed: false,
      score: 25,
      grade: 'NG',
      detectedId: 'multiple_objects',
      feedback:
        targetPromptId === 'eighth_note'
          ? '請畫「單顆」八分音符（♪：1顆實心符頭＋符幹＋1條右彎符尾），不要畫成兩顆分開或雙連音喔！'
          : `畫面分成好幾個不連貫的圖案囉！請只畫一個完整的「${target.name}」。`,
    };
  }

  // Build cleaned grid from significant components
  const cleanGrid = new Uint8Array(GRID_N * GRID_N);
  let minX = GRID_N;
  let maxX = -1;
  let minY = DRAW_MAX_ROW + 1;
  let maxY = -1;
  let ink = 0;

  for (const comp of sigComponents) {
    for (const idx of comp) {
      cleanGrid[idx] = 1;
      ink++;
      const y = Math.floor(idx / GRID_N);
      const x = idx % GRID_N;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const bbox = { minX, maxX, minY, maxY, w, h, ink };
  const closedGrid = closeGrid(cleanGrid, 1, DRAW_MAX_ROW);

  if (ink < 14 || (w < 5 && h < 8)) {
    return {
      passed: false,
      score: 15,
      grade: 'NG',
      detectedId: 'too_small',
      feedback: `畫得太小囉！請在五線譜上畫大一點的「${target.name}」，鑄造出來的音符劍才夠威猛！`,
    };
  }

  // Run the 3 structural analyzers
  const blockRes = analyzeBlockRest(cleanGrid, closedGrid, bbox);
  const noteRes = analyzeNoteCandidate(cleanGrid, closedGrid, bbox);
  const qRestRes = analyzeQuarterRest(cleanGrid, bbox);

  // Determine what symbol was actually drawn (`detectedId`)
  let detectedId = 'unknown';

  if (blockRes.isBlockCandidate) {
    if (blockRes.isHollowBlock) {
      detectedId = 'unfilled_block';
    } else if (blockRes.touchesBoth3And4) {
      detectedId = 'rest_too_thick';
    } else if (blockRes.isFilledBlock && blockRes.sitsOnLine3) {
      detectedId = 'half_rest';
    } else if (blockRes.isFilledBlock && blockRes.hangsUnderLine4) {
      detectedId = 'whole_rest';
    } else if (blockRes.isFilledBlock) {
      detectedId = 'wrong_line_block';
    }
  }

  if (detectedId === 'unknown') {
    // Distinguish Note vs Quarter Rest if both triggered
    if (noteRes.isNote && (noteRes.isHollow || noteRes.isFilled)) {
      // Make sure a zigzag quarter rest with a thick bottom hook isn't misread as a note:
      // A true note doesn't zig-zag back and forth >= 3 times with narrow head
      const looksMoreLikeQRest =
        qRestRes.isQuarterRest &&
        qRestRes.reversals >= 3 &&
        !noteRes.isHollow &&
        noteRes.headW <= noteRes.stemThickness + 5;

      if (looksMoreLikeQRest) {
        detectedId = 'quarter_rest';
      } else if (noteRes.isHollow) {
        if (noteRes.hasRightFlag || noteRes.hasLeftFlag) {
          detectedId = 'hollow_with_flag';
        } else {
          detectedId = 'half_note';
        }
      } else if (noteRes.isFilled) {
        if (noteRes.hasRightFlag) {
          detectedId = 'eighth_note';
        } else if (noteRes.hasLeftFlag) {
          detectedId = 'eighth_note_left_flag';
        } else {
          detectedId = 'quarter_note';
        }
      }
    } else if (qRestRes.isQuarterRest) {
      detectedId = 'quarter_rest';
    } else if (noteRes.isNote && !noteRes.isHollow && !noteRes.isFilled) {
      detectedId = 'ambiguous_head_fill';
    } else {
      // Check stemless oval (whole note or stemless blob)
      const holesAll = countEnclosedHolesInBox(closedGrid, minX, minY, maxX, maxY);
      if (h < 16 && w >= 7 && holesAll >= 5) {
        detectedId = 'stemless_hollow';
      } else if (h < 16 && w >= 7 && ink / (w * h) >= 0.5) {
        detectedId = 'stemless_filled';
      } else if (w <= 5 && h >= 14) {
        detectedId = 'straight_stick';
      }
    }
  }

  // Did the player draw the exact prompted symbol?
  if (detectedId === targetPromptId) {
    let score = 82;
    if (targetPromptId === 'half_note') {
      score += Math.min(14, Math.round(noteRes.holesClosed * 0.45));
      if (noteRes.stemCoverage > 0.9) score += 4;
    } else if (targetPromptId === 'quarter_note') {
      score += Math.min(12, Math.round(noteRes.headFill * 14));
      if (noteRes.stemCoverage > 0.9) score += 6;
    } else if (targetPromptId === 'eighth_note') {
      score += Math.min(10, Math.round(noteRes.headFill * 12));
      if (noteRes.maxRightReach >= 6) score += 8;
    } else if (targetPromptId === 'quarter_rest') {
      score += Math.min(12, qRestRes.reversals * 4);
      if (qRestRes.staffCentered) score += 6;
    } else if (targetPromptId === 'half_rest') {
      const lineDist = Math.abs(blockRes.coreMaxY - STAFF_LINES[3]);
      score += Math.max(0, 14 - lineDist * 4);
      score += Math.min(4, Math.round(blockRes.coreFill * 5));
    } else if (targetPromptId === 'whole_rest') {
      const lineDist = Math.abs(blockRes.coreMinY - STAFF_LINES[4]);
      score += Math.max(0, 14 - lineDist * 4);
      score += Math.min(4, Math.round(blockRes.coreFill * 5));
    }

    score = Math.max(68, Math.min(100, score));
    const grade = score >= 93 ? 'S' : score >= 84 ? 'A' : 'B';
    const weapon = computeWeaponStats(cleanGrid, targetPromptId, score, usedHint);

    return {
      passed: true,
      score,
      grade,
      detectedId,
      feedback: `完美過關！「${target.name}」（${target.beats}）判定合格，已鑄成【${weapon.archetypeLabel}】！`,
      weapon,
      cleanGrid,
    };
  }

  // Construct ultra-specific, friendly Chinese teacher feedback explaining WHY it didn't pass!
  let feedback = '';

  if (detectedId === 'quarter_note') {
    if (targetPromptId === 'half_note') {
      feedback = '你把符頭塗滿變成「四分音符（1拍）」囉！二分音符的橢圓符頭中間要留白「空心」喔！';
    } else if (targetPromptId === 'eighth_note') {
      feedback = '目前是「四分音符」喔！八分音符還要在符幹尖端往「右邊」多畫一條彎彎的符尾（小尾巴）！';
    } else {
      feedback = `你畫的是「四分音符（♩）」，但這題考的是「${target.name}」喔！`;
    }
  } else if (detectedId === 'half_note') {
    if (targetPromptId === 'quarter_note') {
      feedback = '你畫成空心的「二分音符（2拍）」囉！四分音符要把符頭「塗滿實心」（可切換粗筆塗滿）！';
    } else if (targetPromptId === 'eighth_note') {
      feedback = '八分音符的符頭要「塗滿實心」，而且符幹尖端往右還要有一條彎彎的「符尾」喔！';
    } else {
      feedback = `你畫的是「二分音符」，但這題考的是「${target.name}」喔！`;
    }
  } else if (detectedId === 'eighth_note') {
    if (targetPromptId === 'quarter_note') {
      feedback = '你多畫了一條符尾，變成「八分音符（♪）」囉！四分音符只要實心符頭＋直線符幹，沒有尾巴喔！';
    } else if (targetPromptId === 'half_note') {
      feedback = '這是「八分音符（♪）」！二分音符的符頭要是「空心」，而且沒有符尾喔！';
    } else {
      feedback = `你畫的是「八分音符（♪）」，但這題考的是「${target.name}」喔！`;
    }
  } else if (detectedId === 'eighth_note_left_flag') {
    feedback = '差一點點！八分音符的符尾（小尾巴）要往「右邊」彎，不能往左邊彎喔！';
  } else if (detectedId === 'hollow_with_flag') {
    if (targetPromptId === 'eighth_note') {
      feedback = '符尾畫對了，但八分音符的符頭不能空心，請把符頭「塗滿實心」喔！';
    } else if (targetPromptId === 'half_note') {
      feedback = '二分音符是空心符頭＋直線符幹，不需要畫符尾（小尾巴）喔！';
    } else {
      feedback = `這個形狀混合了空心頭與符尾，請確認「${target.name}」的畫法喔！`;
    }
  } else if (detectedId === 'ambiguous_head_fill') {
    if (targetPromptId === 'half_note') {
      feedback = '符頭中間有點糊在一起囉！二分音符的符頭請用「細筆」畫出清楚的空心圓圈＋符幹！';
    } else if (targetPromptId === 'quarter_note' || targetPromptId === 'eighth_note') {
      feedback = `符頭還沒塗滿喔！請切換「粗筆」把${target.name}的橢圓符頭塗成實心！`;
    } else {
      feedback = `這題考的是「${target.name}」，不是音符喔！需要提示可點「💡 偷看提示」。`;
    }
  } else if (detectedId === 'quarter_rest') {
    feedback = `你畫的是閃電狀的「四分休止符」，但這題考的是「${target.name}」喔！`;
  } else if (detectedId === 'half_rest') {
    if (targetPromptId === 'whole_rest') {
      feedback = '位置上下顛倒囉！你畫在「第 3 線上方」變成二分休止符（帽子）了；全休止符要掛在「第 4 線的下方」喔！';
    } else {
      feedback = `你畫的是坐在第 3 線上的「二分休止符」，但這題考的是「${target.name}」喔！`;
    }
  } else if (detectedId === 'whole_rest') {
    if (targetPromptId === 'half_rest') {
      feedback = '位置上下顛倒囉！你掛在「第 4 線下方」變成全休止符了；二分休止符要像帽子一樣坐在「第 3 線的上方」喔！';
    } else {
      feedback = `你畫的是掛在第 4 線下的「全休止符」，但這題考的是「${target.name}」喔！`;
    }
  } else if (detectedId === 'rest_too_thick') {
    feedback = '長方塊畫太厚、同時碰到第 3 線和第 4 線囉！只要畫一半高：二分休止符貼在「第 3 線上方」，全休止符貼在「第 4 線下方」！';
  } else if (detectedId === 'unfilled_block') {
    if (targetPromptId === 'half_rest' || targetPromptId === 'whole_rest') {
      feedback = `長方塊裡面要「塗滿實心」喔！（建議點選「粗筆」把${target.name}塗黑）`;
    } else {
      feedback = `這題考的是「${target.name}」，不是空心長方框喔！`;
    }
  } else if (detectedId === 'wrong_line_block') {
    if (targetPromptId === 'half_rest') {
      feedback = '形狀對了（實心橫方塊），但畫錯條線囉！二分休止符要坐在正中間「第 3 線的上方」（第三間下半部）！';
    } else if (targetPromptId === 'whole_rest') {
      feedback = '形狀對了（實心橫方塊），但畫錯條線囉！全休止符要掛在「第 4 線的下方」（第三間上半部）！';
    } else {
      feedback = `你畫了一個橫長方塊，但這題考的是「${target.name}」喔！`;
    }
  } else if (detectedId === 'stemless_hollow') {
    if (targetPromptId === 'half_note') {
      feedback = '有空心符頭了，但還少了一條直直的「符幹」喔！（只有空心圈圈是全音符）';
    } else {
      feedback = `只有一個空心圈圈喔！這題考的是「${target.name}」，忘記畫法可點「💡 偷看提示」！`;
    }
  } else if (detectedId === 'stemless_filled') {
    if (targetPromptId === 'quarter_note' || targetPromptId === 'eighth_note') {
      feedback = `有實心符頭了，但別忘了連上一條直直的「符幹」${targetPromptId === 'eighth_note' ? '與右彎符尾' : ''}喔！`;
    } else if (targetPromptId === 'half_rest' || targetPromptId === 'whole_rest') {
      feedback = `${target.name}要是橫向扁平的「實心長方塊」（寬度大於高度），並貼在正確的五線譜線上喔！`;
    } else {
      feedback = `這題考的是「${target.name}」，請確認形狀喔！`;
    }
  } else if (detectedId === 'straight_stick') {
    if (targetPromptId === 'quarter_rest') {
      feedback = '太直囉！四分休止符不是一直線，要像閃電一樣「右下 → 左下 → 右下」再加上底下的小彎鉤喔！';
    } else {
      feedback = `只有一條直線喔！別忘了畫出「${target.name}」完整的符頭或休止符形狀！`;
    }
  } else {
    if (targetPromptId === 'quarter_rest') {
      feedback = '還不太像「四分休止符」喔！請在五線譜中間畫出「閃電 Z 字折線 ＋ 底下往左的小彎鉤」（可點 💡 偷看提示）！';
    } else {
      feedback = `還不太像「${target.name}」喔！卡關的話可以點一下「💡 偷看提示」查看畫法口訣！`;
    }
  }

  return {
    passed: false,
    score: 38,
    grade: '再試一次',
    detectedId,
    feedback,
  };
}
