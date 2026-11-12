import assert from 'node:assert/strict';
import { GRID_N, STAFF_LINES } from '../src/constants.js';
import { evaluateDrawing } from '../src/noteClassifier.js';

function makeGrid() {
  return new Uint8Array(GRID_N * GRID_N);
}

function drawBrush(g, x, y, r = 1) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r + 0.5) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (nx >= 0 && nx < GRID_N && ny >= 0 && ny <= 66) {
          g[ny * GRID_N + nx] = 1;
        }
      }
    }
  }
}

function drawLine(g, x0, y0, x1, y1, r = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    drawBrush(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r);
  }
}

function drawOval(g, cx, cy, rx, ry, filled = true, r = 1, gapAngle = null) {
  if (filled) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) {
          if (x >= 0 && x < GRID_N && y >= 0 && y <= 66) g[y * GRID_N + x] = 1;
        }
      }
    }
  } else {
    const steps = 90;
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      if (gapAngle !== null && Math.abs(ang - gapAngle) < 0.14) continue;
      drawBrush(g, cx + Math.cos(ang) * rx, cy + Math.sin(ang) * ry, r);
    }
  }
}

function fillRect(g, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x >= 0 && x < GRID_N && y >= 0 && y <= 66) g[y * GRID_N + x] = 1;
    }
  }
}

// 1. Quarter note (stem-up)
{
  const g = makeGrid();
  drawOval(g, 38, 46, 6, 4.5, true);
  drawLine(g, 43, 45, 43, 18, 1);
  const res = evaluateDrawing(g, 'quarter_note');
  assert.equal(res.passed, true, `Quarter note stem-up failed: ${res.feedback}`);

  // Confusion check: should fail when target is half_note or eighth_note
  const wrongHalf = evaluateDrawing(g, 'half_note');
  assert.equal(wrongHalf.passed, false);
  assert.match(wrongHalf.feedback, /空心/);

  const wrongEighth = evaluateDrawing(g, 'eighth_note');
  assert.equal(wrongEighth.passed, false);
  assert.match(wrongEighth.feedback, /符尾/);
}

// 2. Quarter note (stem-down!)
{
  const g = makeGrid();
  drawOval(g, 40, 24, 6, 4.5, true);
  drawLine(g, 35, 25, 35, 52, 1);
  const res = evaluateDrawing(g, 'quarter_note');
  assert.equal(res.passed, true, `Quarter note stem-down failed: ${res.feedback}`);
}

// 3. Half note (hollow stem-up, both closed and with tiny 1-cell gap)
{
  const g = makeGrid();
  drawOval(g, 38, 46, 6.5, 5, false, 1, null);
  drawLine(g, 44, 45, 44, 17, 1);
  const res = evaluateDrawing(g, 'half_note');
  assert.equal(res.passed, true, `Half note closed failed: ${res.feedback}`);

  const gGap = makeGrid();
  drawOval(gGap, 38, 46, 6.5, 5, false, 1, 1.5); // small gap at bottom
  drawLine(gGap, 44, 45, 44, 17, 1);
  const resGap = evaluateDrawing(gGap, 'half_note');
  assert.equal(resGap.passed, true, `Half note with tiny gap failed: ${resGap.feedback}`);

  // Confusion check against quarter_note
  const wrongQ = evaluateDrawing(g, 'quarter_note');
  assert.equal(wrongQ.passed, false);
  assert.match(wrongQ.feedback, /實心/);
}

// 4. Eighth note (stem-up + curved right flag)
{
  const g = makeGrid();
  drawOval(g, 36, 47, 6, 4.5, true);
  drawLine(g, 41, 46, 41, 17, 1);
  drawLine(g, 41, 17, 50, 24, 1);
  drawLine(g, 50, 24, 48, 33, 1);
  const res = evaluateDrawing(g, 'eighth_note');
  assert.equal(res.passed, true, `Eighth note failed: ${res.feedback}`);

  // Wrong if target is quarter_note
  const wrongQ = evaluateDrawing(g, 'quarter_note');
  assert.equal(wrongQ.passed, false);
  assert.match(wrongQ.feedback, /八分音符/);
}

// 5. Eighth note (stem-down + right flag)
{
  const g = makeGrid();
  drawOval(g, 40, 22, 6, 4.5, true);
  drawLine(g, 35, 23, 35, 51, 1);
  drawLine(g, 35, 51, 45, 43, 1);
  drawLine(g, 45, 43, 44, 36, 1);
  const res = evaluateDrawing(g, 'eighth_note');
  assert.equal(res.passed, true, `Eighth note stem-down failed: ${res.feedback}`);
}

// 6. Quarter rest (zigzag + C hook)
{
  const g = makeGrid();
  drawLine(g, 37, 22, 43, 29, 1);
  drawLine(g, 43, 29, 36, 36, 1);
  drawLine(g, 36, 36, 43, 43, 1);
  drawLine(g, 43, 43, 36, 46, 1);
  drawLine(g, 36, 46, 39, 50, 1);
  const res = evaluateDrawing(g, 'quarter_rest');
  assert.equal(res.passed, true, `Quarter rest failed: ${res.feedback} (detected=${res.detectedId})`);
}

// 7. Half rest (sitting ON TOP of Line 3 = row 36)
{
  const g = makeGrid();
  fillRect(g, 32, 32, 48, 36); // rows 32..36, sits right on Line 3 (36)
  const res = evaluateDrawing(g, 'half_rest');
  assert.equal(res.passed, true, `Half rest plain block failed: ${res.feedback} (detected=${res.detectedId})`);

  // Should fail whole_rest with clear position message!
  const wrongWhole = evaluateDrawing(g, 'whole_rest');
  assert.equal(wrongWhole.passed, false);
  assert.match(wrongWhole.feedback, /第 4 線/);

  // Half rest with hat brim ___▄___ on Line 3
  const gHat = makeGrid();
  fillRect(gHat, 33, 31, 47, 35);
  fillRect(gHat, 28, 36, 52, 36);
  const resHat = evaluateDrawing(gHat, 'half_rest');
  assert.equal(resHat.passed, true, `Half rest with brim failed: ${resHat.feedback}`);
}

// 8. Whole rest (hanging BELOW Line 4 = row 26)
{
  const g = makeGrid();
  fillRect(g, 32, 26, 48, 30); // rows 26..30, hangs right below Line 4 (26)
  const res = evaluateDrawing(g, 'whole_rest');
  assert.equal(res.passed, true, `Whole rest plain block failed: ${res.feedback} (detected=${res.detectedId})`);

  // Should fail half_rest with clear position message!
  const wrongHalf = evaluateDrawing(g, 'half_rest');
  assert.equal(wrongHalf.passed, false);
  assert.match(wrongHalf.feedback, /第 3 線/);

  // Whole rest with top brim ¯¯¯▀¯¯¯ on Line 4
  const gBrim = makeGrid();
  fillRect(gBrim, 28, 26, 52, 26);
  fillRect(gBrim, 33, 27, 47, 31);
  const resBrim = evaluateDrawing(gBrim, 'whole_rest');
  assert.equal(resBrim.passed, true, `Whole rest with brim failed: ${resBrim.feedback}`);
}

// 9. Straight vertical line should NOT pass quarter_rest or notes
{
  const g = makeGrid();
  drawLine(g, 40, 20, 40, 48, 1);
  for (const id of ['quarter_note', 'eighth_note', 'half_note', 'quarter_rest', 'half_rest', 'whole_rest']) {
    const res = evaluateDrawing(g, id);
    assert.equal(res.passed, false, `Straight stick falsely passed ${id}`);
  }
}

// 10. Slanted stem Quarter note & Thick brush Quarter note
{
  const gSlant = makeGrid();
  drawOval(gSlant, 36, 48, 6, 4.5, true);
  drawLine(gSlant, 41, 47, 45, 18, 1); // tilted 4 cells right at top
  const resSlant = evaluateDrawing(gSlant, 'quarter_note');
  assert.equal(resSlant.passed, true, `Slanted quarter note failed: ${resSlant.feedback} (detected=${resSlant.detectedId})`);

  const gThick = makeGrid();
  drawOval(gThick, 37, 47, 7, 5.5, true);
  drawLine(gThick, 42, 46, 42, 16, 2); // thick brush r=2
  const resThick = evaluateDrawing(gThick, 'quarter_note');
  assert.equal(resThick.passed, true, `Thick brush quarter note failed: ${resThick.feedback}`);
}

console.log('ALL CLASSIFIER TESTS PASSED 100%!');
