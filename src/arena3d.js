import * as THREE from 'three';
import { GRID_N, DRAW_MAX_ROW } from './constants.js';
import { sound } from './sound.js';
import { createDetailedFighterRig } from './characterRig.js';

function createWoodFloorTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#c8965a';
  ctx.fillRect(0, 0, 512, 512);

  // Warm cedar planks
  const plankH = 32;
  for (let y = 0; y < 512; y += plankH) {
    const shade = ((y / plankH) % 3) * 6 - 6;
    ctx.fillStyle = `rgb(${200 + shade}, ${148 + shade}, ${88 + shade})`;
    ctx.fillRect(0, y, 512, plankH - 2);
    ctx.fillStyle = 'rgba(90, 52, 20, 0.28)';
    ctx.fillRect(0, y + plankH - 2, 512, 2);

    // Subtle wood grain lines
    ctx.strokeStyle = 'rgba(120, 72, 30, 0.12)';
    ctx.lineWidth = 1.5;
    for (let g = 0; g < 3; g++) {
      ctx.beginPath();
      const gy = y + 6 + g * 9;
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(170, gy + (g - 1) * 3, 340, gy - (g - 1) * 3, 512, gy);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * High-DPI Wood-Branded Circular Dojo Crest & Watermark ("禹承老師音樂課")
 * Strictly contained inside the circular 5-line staff emblem at the center of the stage!
 */
function createStageWatermarkTexture() {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 1024;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 1024, 1024);

  const cx = 512;
  const cy = 512;

  ctx.save();

  // 5-line concentric circular musical staff ring on the stage floor
  for (let i = 0; i < 5; i++) {
    const r = 392 + i * 22; // 392..480 px (all inside 512 px)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = i === 0 || i === 4 ? 'rgba(92, 48, 16, 0.28)' : 'rgba(110, 62, 22, 0.20)';
    ctx.lineWidth = i === 0 || i === 4 ? 4 : 2.5;
    ctx.stroke();
  }

  // Clip strictly inside the innermost circle (r = 376 px) so text never crosses the circular boundary
  ctx.beginPath();
  ctx.arc(cx, cy, 376, 0, Math.PI * 2);
  ctx.clip();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Subtle top & bottom musical note accents inside the circle
  ctx.font = '700 46px "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = 'rgba(88, 44, 14, 0.26)';
  ctx.fillText('♪', cx, cy - 135);
  ctx.fillText('♩', cx, cy + 135);

  // Carved wood highlight bevel
  ctx.font = '900 84px "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = 'rgba(255, 240, 212, 0.24)';
  ctx.fillText('禹承老師音樂課', cx + 2, cy + 3, 660);

  // Warm burnt-cedar wood watermark lettering centered inside the circle
  ctx.fillStyle = 'rgba(78, 38, 12, 0.38)';
  ctx.fillText('禹承老師音樂課', cx, cy, 660);

  ctx.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Render a 2D preview thumbnail of a weapon grid (with hilt) onto a 2D canvas
 * Used on Prep screen, VS card, and Result card!
 */
export function renderWeaponThumbnail(canvas, grid, options = {}) {
  const {
    bladeColor = '#d8dee9',
    glowColor = '#60a5fa',
    showStaff = true,
  } = options;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, W, H);

  const cell = W / GRID_N;

  if (showStaff) {
    ctx.strokeStyle = 'rgba(180, 162, 135, 0.38)';
    ctx.lineWidth = Math.max(1, W / 180);
    for (const row of [16, 26, 36, 46, 56]) {
      const y = (row + 0.5) * cell;
      ctx.beginPath();
      ctx.moveTo(W * 0.06, y);
      ctx.lineTo(W * 0.94, y);
      ctx.stroke();
    }
  }

  // Find lowest ink row to draw translucent conductor core beam from hilt to symbol
  let maxY = -1;
  let sumBottomX = 0;
  let bottomCnt = 0;
  for (let y = 0; y <= DRAW_MAX_ROW; y++) {
    for (let x = 0; x < GRID_N; x++) {
      if (grid[y * GRID_N + x] && y > maxY) maxY = y;
    }
  }
  if (maxY >= 0) {
    for (let y = Math.max(0, maxY - 3); y <= maxY; y++) {
      for (let x = 0; x < GRID_N; x++) {
        if (grid[y * GRID_N + x]) {
          sumBottomX += x;
          bottomCnt++;
        }
      }
    }
  }

  // Connector core beam if floating above hilt guard
  if (maxY >= 0 && maxY < DRAW_MAX_ROW - 1 && bottomCnt > 0) {
    const targetX = ((sumBottomX / bottomCnt) + 0.5) * cell;
    const targetY = (maxY + 0.5) * cell;
    const guardX = W * 0.5;
    const guardY = (DRAW_MAX_ROW + 1) * cell;

    ctx.save();
    ctx.strokeStyle = glowColor;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(3, cell * 2.4);
    ctx.beginPath();
    ctx.moveTo(guardX, guardY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.restore();
  }

  // Draw hilt at bottom (rows 67..79)
  const guardY = (DRAW_MAX_ROW + 1) * cell;
  const cx = W * 0.5;
  // Handle (tsuka)
  ctx.fillStyle = '#4a3525';
  ctx.strokeStyle = '#1b1b22';
  ctx.lineWidth = Math.max(1.5, cell * 0.45);
  const handleW = cell * 4.2;
  const handleH = H - guardY;
  ctx.fillRect(cx - handleW / 2, guardY + cell * 2, handleW, handleH);
  ctx.strokeRect(cx - handleW / 2, guardY + cell * 2, handleW, handleH);
  // Gold diamond wraps
  ctx.fillStyle = '#eab308';
  for (let wy = guardY + cell * 3.2; wy < H - cell * 1.5; wy += cell * 2.8) {
    ctx.fillRect(cx - handleW * 0.28, wy, handleW * 0.56, cell * 1.3);
  }
  // Guard (tsuba)
  const guardW = cell * 13;
  const guardH = cell * 2.5;
  ctx.fillStyle = '#eab308';
  ctx.fillRect(cx - guardW / 2, guardY, guardW, guardH);
  ctx.strokeRect(cx - guardW / 2, guardY, guardW, guardH);

  // Draw pixel silhouette outline first, then blade fill (Rakugaki Kengo style!)
  ctx.fillStyle = '#1b1b22';
  const pad = Math.max(1, cell * 0.36);
  for (let y = 0; y <= DRAW_MAX_ROW; y++) {
    for (let x = 0; x < GRID_N; x++) {
      if (!grid[y * GRID_N + x]) continue;
      ctx.fillRect(x * cell - pad, y * cell - pad, cell + pad * 2, cell + pad * 2);
    }
  }
  ctx.fillStyle = bladeColor;
  for (let y = 0; y <= DRAW_MAX_ROW; y++) {
    for (let x = 0; x < GRID_N; x++) {
      if (!grid[y * GRID_N + x]) continue;
      ctx.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}

/**
 * Build a 3D Voxel Weapon Group from an 80x80 grid
 * Origin (0,0,0) is at the fighter's grip on the handle; +Y points up along the blade, +Z points forward!
 */
function create3DWeaponGroup(grid, options = {}) {
  const {
    bladeColor = '#dfe6f0',
    glowColor = '#60a5fa',
    sizeMult = 1.0,
  } = options;

  const group = new THREE.Group();
  const voxSize = 0.026 * sizeMult;

  // 1. Katana / Conductor Hilt
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x3f2d20, roughness: 0.7 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.45, roughness: 0.35 });

  const handleH = 0.36;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.065, handleH, 0.08), handleMat);
  handle.position.y = handleH * 0.25;
  group.add(handle);

  // Tsuba (Guard)
  const guardY = handleH * 0.75;
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.16 * Math.sqrt(sizeMult), 0.045, 0.24 * Math.sqrt(sizeMult)),
    goldMat
  );
  guard.position.y = guardY;
  group.add(guard);

  // Collect voxels from grid:
  // Map grid X (0..79, center 40) -> local Z (forward/back in sword plane so player sees full note profile!)
  // Map grid Y (66..0) -> local +Y above guard!
  const active = [];
  let minRow = DRAW_MAX_ROW + 1;
  let maxRow = -1;
  let bottomSumX = 0;
  let bottomCnt = 0;

  for (let y = 0; y <= DRAW_MAX_ROW; y++) {
    for (let x = 0; x < GRID_N; x++) {
      if (!grid[y * GRID_N + x]) continue;
      const isEdge =
        x === 0 || x === GRID_N - 1 || y === 0 || y === DRAW_MAX_ROW ||
        !grid[(y - 1) * GRID_N + x] ||
        !grid[(y + 1) * GRID_N + x] ||
        !grid[y * GRID_N + (x - 1)] ||
        !grid[y * GRID_N + (x + 1)];
      active.push({ x, y, isEdge });
      if (y < minRow) minRow = y;
      if (y > maxRow) maxRow = y;
    }
  }

  if (maxRow >= 0) {
    for (const c of active) {
      if (c.y >= maxRow - 3) {
        bottomSumX += c.x;
        bottomCnt++;
      }
    }
  }

  const bladeStartY = guardY + 0.025;

  // Auto-weld glowing Conductor Core Shaft if note/rest floats above guard!
  if (maxRow >= 0 && maxRow < DRAW_MAX_ROW - 1 && bottomCnt > 0) {
    const targetRow = maxRow;
    const targetCol = bottomSumX / bottomCnt;
    const p0 = new THREE.Vector3(0, bladeStartY, 0);
    const p1 = new THREE.Vector3(
      0,
      bladeStartY + (DRAW_MAX_ROW - targetRow) * voxSize,
      (targetCol - GRID_N / 2) * voxSize
    );
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const len = dir.length();
    if (len > 0.02) {
      const coreGeo = new THREE.CylinderGeometry(0.022 * sizeMult, 0.028 * sizeMult, len, 8);
      const coreMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(glowColor),
        emissive: new THREE.Color(glowColor),
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.82,
        roughness: 0.25,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.copy(p0).addScaledVector(dir, 0.5);
      coreMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      group.add(coreMesh);
    }
  }

  // InstancedMesh for all drawn note/rest voxels (1 draw call!)
  if (active.length > 0) {
    const boxGeo = new THREE.BoxGeometry(voxSize * 2.1, voxSize * 1.04, voxSize * 1.04);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.25,
    });
    const inst = new THREE.InstancedMesh(boxGeo, mat, active.length);
    inst.castShadow = true;

    const dummy = new THREE.Object3D();
    const innerCol = new THREE.Color(bladeColor);
    const edgeCol = new THREE.Color(glowColor).lerp(new THREE.Color('#1b1b22'), 0.45);

    active.forEach((cell, i) => {
      const ly = bladeStartY + (DRAW_MAX_ROW - cell.y + 0.5) * voxSize;
      const lz = (cell.x - GRID_N / 2 + 0.5) * voxSize;
      dummy.position.set(0, ly, lz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, cell.isEdge ? edgeCol : innerCol);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }

  const maxTipY =
    minRow <= DRAW_MAX_ROW
      ? bladeStartY + (DRAW_MAX_ROW - minRow + 1) * voxSize
      : bladeStartY + 0.4;

  group.userData = {
    guardY: bladeStartY,
    tipY: maxTipY,
  };

  return group;
}

/**
 * Dynamic Swing Trail Ribbon Mesh (劍氣殘影 like in Rakugaki Kengo!)
 */
function createSwingRibbon(colorHex = '#ffffff') {
  const segs = 12;
  const positions = new Float32Array((segs + 1) * 2 * 3);
  const alphas = new Float32Array((segs + 1) * 2);
  const indices = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
  geo.setIndex(indices);

  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;

  return {
    mesh,
    history: [],
    push(pBase, pTip) {
      this.history.unshift({ base: pBase.clone(), tip: pTip.clone() });
      if (this.history.length > segs + 1) this.history.pop();
      this.sync();
    },
    decay() {
      if (this.history.length > 0) {
        this.history.pop();
        this.sync();
      }
    },
    clear() {
      this.history.length = 0;
      mesh.visible = false;
    },
    sync() {
      if (this.history.length < 2) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const posAttr = geo.getAttribute('position');
      for (let i = 0; i <= segs; i++) {
        const item = this.history[Math.min(i, this.history.length - 1)];
        posAttr.setXYZ(i * 2, item.base.x, item.base.y, item.base.z);
        posAttr.setXYZ(i * 2 + 1, item.tip.x, item.tip.y, item.tip.z);
      }
      posAttr.needsUpdate = true;
    },
  };
}

export class DojoArena3D {
  constructor(canvas3d, canvasOverlay, callbacks = {}) {
    this.canvas = canvas3d;
    this.ov = canvasOverlay;
    this.ovCtx = canvasOverlay.getContext('2d');
    this.callbacks = callbacks;

    this.mode = 'backdrop'; // 'backdrop' | 'fight' | 'result'
    this.speedMult = 1;
    this.manualControl = false;
    this.input = { moveX: 0, moveY: 0, block: false, blockJustAt: -99, attackQueued: false };

    this.popups = [];
    this.hitStopTimer = 0;
    this.camTime = 0;
    this.matchTimer = 45;

    this.initThree();
    this.setupPreviewFighters();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.lastTime = performance.now();
    const loop = (now) => {
      const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.update(rawDt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2b2238);
    this.scene.fog = new THREE.Fog(0x2b2238, 12, 28);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    this.camera.position.set(0, 3.6, 7.6);
    this.camera.lookAt(0, 1.3, 0);

    this.renderer = null;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch (_) {
      this.renderer = null;
    }

    // Warm Dojo Lighting
    const hemi = new THREE.HemisphereLight(0xfff4dc, 0x3b2d4a, 1.05);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe9c4, 1.55);
    sun.position.set(4.5, 9.5, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 24;
    const d = 6.5;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0x93c5fd, 0.45);
    rim.position.set(-5, 4, -6);
    this.scene.add(rim);

    // Circular Wooden Dojo Ring
    const floorTex = createWoodFloorTexture();
    const ringGeo = new THREE.CylinderGeometry(5.5, 5.8, 0.5, 64);
    const ringMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = -0.25;
    ringMesh.receiveShadow = true;
    this.scene.add(ringMesh);

    // Single Circular Stage Crest & Watermark ("禹承老師音樂課") centered inside the circular ring on the stage!
    const wmTex = createStageWatermarkTexture();
    const wmMat = new THREE.MeshStandardMaterial({
      map: wmTex,
      transparent: true,
      roughness: 0.78,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const wmStage = new THREE.Mesh(new THREE.CircleGeometry(2.55, 64), wmMat);
    wmStage.rotation.x = -Math.PI / 2;
    wmStage.position.set(0, 0.004, 0);
    wmStage.receiveShadow = true;
    this.scene.add(wmStage);

    // Red Ring Rope (Tawara)
    const ropeGeo = new THREE.TorusGeometry(5.38, 0.085, 12, 72);
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 });
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.rotation.x = Math.PI / 2;
    rope.position.y = 0.03;
    this.scene.add(rope);

    // Background Dojo Hall Floor & Pillars
    const hallFloor = new THREE.Mesh(
      new THREE.CircleGeometry(26, 48),
      new THREE.MeshStandardMaterial({ color: 0x3c2c24, roughness: 0.9 })
    );
    hallFloor.rotation.x = -Math.PI / 2;
    hallFloor.position.y = -0.5;
    this.scene.add(hallFloor);

    const pillarGeo = new THREE.CylinderGeometry(0.24, 0.26, 8, 12);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x543828, roughness: 0.85 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + 0.2;
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(Math.cos(ang) * 9.5, 3.5, Math.sin(ang) * 9.5);
      this.scene.add(p);
    }

    this.fightersGroup = new THREE.Group();
    this.scene.add(this.fightersGroup);

    this.ribbonA = createSwingRibbon('#ffffff');
    this.ribbonB = createSwingRibbon('#fde047');
    this.scene.add(this.ribbonA.mesh, this.ribbonB.mesh);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    if (this.renderer) {
      this.renderer.setSize(w, h, false);
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.ov.width = Math.round(w * dpr);
    this.ov.height = Math.round(h * dpr);
    this.ovDpr = dpr;
  }

  clearFighters() {
    while (this.fightersGroup.children.length > 0) {
      this.fightersGroup.remove(this.fightersGroup.children[0]);
    }
    this.ribbonA.clear();
    this.ribbonB.clear();
  }

  /**
   * Idle atmospheric fighters waiting in the background while player draws / inspects!
   */
  setupPreviewFighters(playerGrid = null, oppData = null, oppGrid = null) {
    this.clearFighters();
    this.mode = 'backdrop';

    const rigA = createDetailedFighterRig({
      persona: 'player',
      colors: { top: '#ffffff', hakama: '#1e3a5f', band: '#ef4444' },
      scale: 1.0,
      isBoss: false,
    });
    // Positioned flanking the UI pad with heroic 3/4 angle so player sees full character detail!
    rigA.root.position.set(-2.05, 0, 0.55);
    rigA.root.rotation.y = Math.PI * 0.34;

    const wA = create3DWeaponGroup(playerGrid || new Uint8Array(GRID_N * GRID_N), {
      bladeColor: '#e2e8f0',
      glowColor: '#60a5fa',
      sizeMult: 1.0,
    });
    rigA.weaponMount.add(wA);

    const oc = oppData ? oppData.colors : { top: '#573b26', hakama: '#1e293b', band: '#f97316' };
    const rigB = createDetailedFighterRig({
      persona: oppData ? oppData.id : 'metronome_sensei',
      colors: oc,
      scale: oppData ? oppData.scale : 1.0,
      isBoss: !!(oppData && oppData.isBoss),
    });
    rigB.root.position.set(2.05, 0, 0.55);
    rigB.root.rotation.y = -Math.PI * 0.34;

    if (oppGrid) {
      const wB = create3DWeaponGroup(oppGrid, {
        bladeColor: oc.blade || '#cbd5e1',
        glowColor: oc.glow || '#fbbf24',
        sizeMult: 1.0,
      });
      rigB.weaponMount.add(wB);
    }

    this.fightersGroup.add(rigA.root, rigB.root);
    this.fA = { rig: rigA, isBoss: false };
    this.fB = { rig: rigB, isBoss: !!(oppData && oppData.isBoss) };
  }

  setShowcaseView(active, focus = 'both') {
    this.showcaseActive = !!active;
    this.showcaseFocus = focus; // 'both' | 'player' | 'opponent'
  }

  /**
   * Launch a real 3D Duel between Fighter A (Player / P1) and Fighter B (Opponent / P2)!
   */
  startBattle(configA, configB, options = {}) {
    this.clearFighters();
    this.popups = [];
    this.hitStopTimer = 0;
    this.matchTimer = 45;
    this.manualControl = !!options.manual;
    this.speedMult = 1;
    this.input = { moveX: 0, moveY: 0, block: false, blockJustAt: -99, attackQueued: false };

    this.fA = this.spawnCombatant(configA, -1.75, 1);
    this.fB = this.spawnCombatant(configB, 1.75, -1);

    // Compute Rock-Paper-Scissors matchup bonus:
    // thin beats heavy, heavy beats wide, wide beats thin!
    const beats = { thin: 'heavy', heavy: 'wide', wide: 'thin' };
    this.fA.matchupMult =
      beats[this.fA.archetype] === this.fB.archetype
        ? 1.18
        : beats[this.fB.archetype] === this.fA.archetype
        ? 0.9
        : 1.0;
    this.fB.matchupMult =
      beats[this.fB.archetype] === this.fA.archetype
        ? 1.18
        : beats[this.fA.archetype] === this.fB.archetype
        ? 0.9
        : 1.0;

    this.mode = 'fight';
    this.fightElapsed = 0;

    if (this.fA.matchupMult > 1.05) {
      this.addPopup(this.fA.pos.x, 2.3, 0, '屬性相剋優勢！↑', '#ffe14d', 1.25);
    }
  }

  spawnCombatant(cfg, startX, dirSign) {
    const rig = createDetailedFighterRig({
      persona: cfg.persona || (dirSign > 0 ? 'player' : 'challenger'),
      colors: cfg.colors,
      scale: cfg.scale || 1.0,
      isBoss: !!cfg.isBoss,
    });
    const weapon = create3DWeaponGroup(cfg.grid, {
      bladeColor: cfg.colors.blade || '#e2e8f0',
      glowColor: cfg.colors.glow || '#60a5fa',
      sizeMult: cfg.sizeMult || 1.0,
    });
    rig.weaponMount.add(weapon);

    rig.root.position.set(startX, 0, 0);
    rig.root.rotation.y = dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.fightersGroup.add(rig.root);

    const sizeMult = cfg.sizeMult || 1.0;
    const sizeSpdMod = sizeMult > 1.4 ? 0.84 : sizeMult > 1.15 ? 0.92 : 1.0;
    const sizeDmgMod = sizeMult > 1.4 ? 1.24 : sizeMult > 1.15 ? 1.12 : 1.0;
    const sizeReachMod = 0.85 + sizeMult * 0.22;

    return {
      name: cfg.name,
      rig,
      weapon,
      isPlayer: dirSign > 0,
      isManual: !!cfg.isManual,
      isBoss: !!cfg.isBoss,
      scale: cfg.scale || 1.0,
      archetype: cfg.archetype || 'thin',
      promptId: cfg.promptId || 'quarter_note',
      move: cfg.move || 'overhead',
      plan: cfg.plan || 'balanced',
      maxHp: cfg.hp || 120,
      hp: cfg.hp || 120,
      atk: (cfg.atk || 65) * sizeDmgMod,
      spd: (cfg.spd || 65) * sizeSpdMod,
      guardStat: cfg.guard || 60,
      brk: (cfg.brk || 60) * sizeDmgMod,
      reach: Math.max(1.15, (cfg.reach || 1.25) * sizeReachMod * (cfg.isBoss ? 1.22 : 1.0)),
      pos: new THREE.Vector3(startX, 0, 0),
      vel: new THREE.Vector3(),
      state: 'idle', // 'idle' | 'windup' | 'slash' | 'recover' | 'block' | 'stun' | 'ko'
      stateTimer: 0,
      stateDur: 0,
      slashHitDone: false,
      aiCooldown: 0.35 + Math.random() * 0.25,
      counterBuff: 1.0,
      blockStartTime: -99,
      matchupMult: 1.0,
    };
  }

  setManualInput(partial) {
    if (partial.block && !this.input.block) {
      this.input.blockJustAt = this.fightElapsed || 0;
    }
    Object.assign(this.input, partial);
  }

  triggerManualAttack() {
    this.input.attackQueued = true;
  }

  setSpeedMultiplier(mult) {
    this.speedMult = mult;
  }

  addPopup(x, y, z, text, color = '#ffffff', scale = 1.0) {
    this.popups.push({
      pos: new THREE.Vector3(x, y, z),
      velY: 1.35,
      text,
      color,
      scale,
      age: 0,
      life: 0.95,
    });
  }

  burstMusicalNotes(x, y, z, color = '#ffe14d', count = 5) {
    const glyphs = ['♪', '♩', '♬', '𝄽', '✦'];
    for (let i = 0; i < count; i++) {
      this.popups.push({
        pos: new THREE.Vector3(
          x + (Math.random() - 0.5) * 0.7,
          y + (Math.random() - 0.3) * 0.5,
          z + (Math.random() - 0.5) * 0.6
        ),
        velX: (Math.random() - 0.5) * 2.4,
        velY: 1.4 + Math.random() * 1.8,
        text: glyphs[i % glyphs.length],
        color,
        scale: 0.85 + Math.random() * 0.35,
        age: 0,
        life: 0.65,
      });
    }
  }

  startAttack(f, moveOverride = null) {
    const mv = moveOverride || f.move || 'overhead';
    f.currentMove = mv;
    const spdFactor = 0.68 + (f.spd / 100) * 0.65; // ~0.95 .. 1.33
    const windupBase = mv === 'thrust' ? 0.22 : mv === 'sweep' ? 0.27 : 0.3;
    f.state = 'windup';
    f.stateDur = windupBase / spdFactor;
    f.stateTimer = 0;
    f.slashHitDone = false;
  }

  updateFighterAI(f, foe, dt) {
    const dist = f.pos.distanceTo(foe.pos);
    const idealDist = f.reach * 0.86;
    const toFoe = new THREE.Vector3().subVectors(foe.pos, f.pos);
    const dir = toFoe.lengthSq() > 0.0001 ? toFoe.clone().normalize() : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);

    f.aiCooldown -= dt;

    if (f.state === 'block') {
      f.stateTimer += dt;
      if (f.stateTimer >= f.stateDur || (foe.state !== 'windup' && foe.state !== 'slash' && f.stateTimer > 0.25)) {
        f.state = 'idle';
      }
      return;
    }

    if (f.state !== 'idle') return;

    // Reactive blocking based on Plan ('defensive' blocks often, 'balanced' sometimes, 'aggressive' rarely)
    if ((foe.state === 'windup' || foe.state === 'slash') && dist < foe.reach * 1.2 && f.aiCooldown <= 0.15) {
      const blockChance = f.plan === 'defensive' ? 0.68 : f.plan === 'balanced' ? 0.34 : 0.12;
      if (Math.random() < blockChance * dt * 8) {
        f.state = 'block';
        f.stateTimer = 0;
        f.stateDur = 0.48;
        f.blockStartTime = this.fightElapsed;
        f.aiCooldown = 0.22;
        return;
      }
    }

    // Movement toward / around opponent
    const moveSpd = (1.85 + (f.spd / 100) * 1.15) * (f.isBoss ? 0.82 : 1.0);
    const approachBias = f.plan === 'aggressive' ? 0.82 : f.plan === 'defensive' ? 1.04 : 0.92;

    if (dist > idealDist * approachBias) {
      f.vel.addScaledVector(dir, moveSpd * 7.5 * dt);
    } else if (dist < idealDist * 0.58 && f.plan !== 'aggressive') {
      f.vel.addScaledVector(dir, -moveSpd * 5.0 * dt);
    }

    // Subtle kendo circling
    const circleSign = f.isPlayer ? 1 : -1;
    f.vel.addScaledVector(perp, circleSign * 1.2 * dt);

    // Attack decision
    if (dist <= f.reach * 1.08 && f.aiCooldown <= 0) {
      const moves = [f.move, f.move, 'overhead', 'sweep', 'thrust'];
      const chosen = moves[Math.floor(Math.random() * moves.length)];
      this.startAttack(f, chosen);
      f.aiCooldown = (f.plan === 'aggressive' ? 0.22 : f.plan === 'defensive' ? 0.46 : 0.32) + Math.random() * 0.18;
    }
  }

  updateManualPlayer(f, foe, dt) {
    const moveSpd = 2.55 + (f.spd / 100) * 1.15;

    if (f.state === 'idle' || f.state === 'block') {
      if (this.input.attackQueued) {
        this.input.attackQueued = false;
        this.startAttack(f, f.move);
        return;
      }

      if (this.input.block) {
        if (f.state !== 'block') {
          f.state = 'block';
          f.stateTimer = 0;
          f.stateDur = 999;
          f.blockStartTime = this.input.blockJustAt;
        }
      } else if (f.state === 'block') {
        f.state = 'idle';
      }

      const speedScale = f.state === 'block' ? 0.45 : 1.0;
      // Camera looks roughly from +Z toward origin: moveX = left/right (world X), moveY = up/down (world Z)
      f.vel.x += this.input.moveX * moveSpd * 9.0 * speedScale * dt;
      f.vel.z += this.input.moveY * moveSpd * 9.0 * speedScale * dt;
    } else {
      this.input.attackQueued = false;
    }
  }

  stepFighterState(f, foe, ribbon, dt) {
    f.rig.sweatGroup.visible = f.state === 'stun';
    if (f.state === 'stun') {
      f.rig.sweatGroup.rotation.y += dt * 7;
    }

    const toFoe = new THREE.Vector3().subVectors(foe.pos, f.pos);
    if (f.state !== 'ko' && toFoe.lengthSq() > 0.001) {
      const targetYaw = Math.atan2(toFoe.x, toFoe.z);
      let diff = targetYaw - f.rig.root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      f.rig.root.rotation.y += diff * Math.min(1, dt * 12);
    }

    // Apply velocity + friction + ring collision
    f.pos.addScaledVector(f.vel, dt);
    f.vel.multiplyScalar(Math.pow(0.06, dt));

    // Keep fighters from overlapping inside each other
    const sep = new THREE.Vector3().subVectors(f.pos, foe.pos);
    const minSep = 0.72 + (f.isBoss || foe.isBoss ? 0.35 : 0);
    const d = sep.length();
    if (d < minSep && d > 0.0001) {
      sep.normalize().multiplyScalar((minSep - d) * 0.5);
      f.pos.add(sep);
      foe.pos.sub(sep);
    }

    // Keep within wooden dojo ring (radius 4.85)
    const r = Math.hypot(f.pos.x, f.pos.z);
    if (r > 4.85) {
      f.pos.x *= 4.85 / r;
      f.pos.z *= 4.85 / r;
    }

    f.rig.root.position.copy(f.pos);

    // State timers & Arm/Sword animation poses!
    const pivot = f.rig.armPivot;
    const mount = f.rig.weaponMount;
    pivot.position.set(0, 1.24, 0.12);
    mount.position.set(0, -0.1, 0.44);

    if (f.state === 'idle') {
      const bob = Math.sin(this.fightElapsed * 6 + (f.isPlayer ? 0 : 2)) * 0.05;
      pivot.rotation.set(-0.12 + bob, 0, 0);
      mount.rotation.set(0.32, 0, 0);
      ribbon.decay();
    } else if (f.state === 'block') {
      // Crossed defensive guard pose
      pivot.rotation.set(-0.45, 0.25, 0.55);
      mount.rotation.set(0.15, 0, 0.65);
      ribbon.decay();
    } else if (f.state === 'stun') {
      f.stateTimer += dt;
      pivot.rotation.set(-0.65, -0.35, -0.4);
      mount.rotation.set(-0.2, 0, 0);
      f.rig.bodyGroup.rotation.x = -0.16 * Math.sin((f.stateTimer / Math.max(0.1, f.stateDur)) * Math.PI);
      ribbon.decay();
      if (f.stateTimer >= f.stateDur) {
        f.rig.bodyGroup.rotation.x = 0;
        f.state = 'idle';
      }
    } else if (f.state === 'windup') {
      f.stateTimer += dt;
      const p = Math.min(1, f.stateTimer / Math.max(0.05, f.stateDur));
      if (f.currentMove === 'sweep') {
        pivot.rotation.set(-0.15, -1.05 * p, -0.35 * p);
        mount.rotation.set(0.6, 0, -0.75 * p);
      } else if (f.currentMove === 'thrust') {
        pivot.rotation.set(0.25 * p, 0, 0);
        pivot.position.z = 0.12 - 0.24 * p;
        mount.rotation.set(1.22 * p + 0.25 * (1 - p), 0, 0);
      } else {
        // Overhead kendo men strike windup
        pivot.rotation.set(-1.35 * p, 0, 0);
        mount.rotation.set(-0.35 * p + 0.3 * (1 - p), 0, 0);
      }
      ribbon.decay();

      if (f.stateTimer >= f.stateDur) {
        f.state = 'slash';
        f.stateTimer = 0;
        f.stateDur = 0.16 / (0.8 + (f.spd / 100) * 0.45);
        // Lunge step forward!
        const lungeDir = toFoe.lengthSq() > 0.001 ? toFoe.clone().normalize() : new THREE.Vector3(1, 0, 0);
        f.vel.addScaledVector(lungeDir, f.currentMove === 'thrust' ? 5.2 : 3.6);
        sound.playSwing(0.85 + (f.spd / 100) * 0.4);
      }
    } else if (f.state === 'slash') {
      f.stateTimer += dt;
      const p = Math.min(1, f.stateTimer / Math.max(0.04, f.stateDur));

      if (f.currentMove === 'sweep') {
        pivot.rotation.set(-0.1, -1.05 + 2.25 * p, -0.35 + 0.7 * p);
        mount.rotation.set(0.95, 0, -0.6 + 1.2 * p);
      } else if (f.currentMove === 'thrust') {
        pivot.rotation.set(0.22, 0, 0);
        pivot.position.z = -0.12 + 0.56 * Math.sin(p * Math.PI * 0.75);
        mount.rotation.set(1.42, 0, 0);
      } else {
        // Overhead slash!
        pivot.rotation.set(-1.35 + 2.15 * p, 0, 0);
        mount.rotation.set(-0.35 + 1.55 * p, 0, 0);
      }

      // Record world positions of guard & tip for swing trail ribbon!
      f.rig.root.updateMatrixWorld(true);
      const pBase = new THREE.Vector3(0, f.weapon.userData.guardY, 0).applyMatrix4(f.weapon.matrixWorld);
      const pTip = new THREE.Vector3(0, f.weapon.userData.tipY, 0).applyMatrix4(f.weapon.matrixWorld);
      ribbon.push(pBase, pTip);

      // Hit check at mid-swing!
      if (!f.slashHitDone && p >= 0.36) {
        f.slashHitDone = true;
        this.resolveStrike(f, foe);
      }

      if (f.stateTimer >= f.stateDur) {
        f.state = 'recover';
        f.stateTimer = 0;
        f.stateDur = 0.24 / (0.75 + (f.spd / 100) * 0.5);
      }
    } else if (f.state === 'recover') {
      f.stateTimer += dt;
      const p = Math.min(1, f.stateTimer / Math.max(0.05, f.stateDur));
      pivot.rotation.x *= 1 - p * 0.35;
      pivot.rotation.y *= 1 - p * 0.35;
      ribbon.decay();
      if (f.stateTimer >= f.stateDur) {
        f.state = 'idle';
      }
    } else if (f.state === 'ko') {
      f.stateTimer += dt;
      const fallP = Math.min(1, f.stateTimer / 0.45);
      f.rig.bodyGroup.rotation.x = -Math.PI * 0.48 * fallP;
      f.rig.bodyGroup.position.y = 0.22 * Math.sin(fallP * Math.PI);
      ribbon.decay();
    }

    // Drive detailed character secondary animations (stride, breathing, blinking, facial expressions, cloth sway)!
    if (f.rig.animateDetails) {
      const speed = Math.hypot(f.vel.x, f.vel.z);
      const stateProgress = f.stateDur > 0 ? Math.min(1, f.stateTimer / f.stateDur) : 0;
      f.rig.animateDetails({
        dt,
        time: this.fightElapsed || this.camTime,
        speed,
        state: f.state,
        stateProgress,
      });
    }
  }

  resolveStrike(attacker, defender) {
    if (defender.state === 'ko') return;
    const dist = attacker.pos.distanceTo(defender.pos);
    const effectiveReach = attacker.reach + (defender.isBoss ? 0.28 : 0.12);
    if (dist > effectiveReach) return;

    const mid = new THREE.Vector3().lerpVectors(attacker.pos, defender.pos, 0.55);
    const knockDir = new THREE.Vector3().subVectors(defender.pos, attacker.pos).normalize();

    // 1. Clash if both fighters are slashing simultaneously!
    if (defender.state === 'slash' || (defender.state === 'windup' && defender.stateTimer > defender.stateDur * 0.65)) {
      sound.playClash(false);
      this.hitStopTimer = 0.05;
      this.burstMusicalNotes(mid.x, 1.4, mid.z, '#ffe14d', 6);
      this.addPopup(mid.x, 1.9, mid.z, '鏘！！交鋒！', '#ffe14d', 1.15);

      const powerA = attacker.brk + attacker.atk * 0.5;
      const powerB = defender.brk + defender.atk * 0.5;
      attacker.vel.addScaledVector(knockDir, -2.6 * (powerB / Math.max(40, powerA)));
      defender.vel.addScaledVector(knockDir, 2.6 * (powerA / Math.max(40, powerB)));
      attacker.state = 'recover';
      attacker.stateTimer = 0;
      attacker.stateDur = 0.22;
      defender.slashHitDone = true;
      defender.state = 'recover';
      defender.stateTimer = 0;
      defender.stateDur = 0.22;
      return;
    }

    // 2. Defender is blocking!
    if (defender.state === 'block') {
      const blockAge = this.fightElapsed - defender.blockStartTime;
      const isJustParry = defender.isManual && blockAge >= 0 && blockAge <= 0.28;

      if (isJustParry) {
        // JUST PARRY! 完美休止格擋!
        sound.playClash(true);
        this.hitStopTimer = 0.08;
        attacker.state = 'stun';
        attacker.stateTimer = 0;
        attacker.stateDur = 1.05;
        attacker.vel.addScaledVector(knockDir, -3.5);
        defender.counterBuff = 1.65;
        this.burstMusicalNotes(mid.x, 1.5, mid.z, '#fef08a', 8);
        this.addPopup(mid.x, 2.1, mid.z, '完美格擋！JUST！', '#ffe14d', 1.4);
        if (this.callbacks.onJustParry) this.callbacks.onJustParry();
        return;
      }

      // Check Guard Break (heavy / whole-rest weapons excel at breaking guards!)
      const breakChance = Math.max(0.06, (attacker.brk - defender.guardStat * 0.92) / 100);
      if (Math.random() < breakChance) {
        sound.playGuardBreak();
        this.hitStopTimer = 0.065;
        const chipDmg = Math.max(6, Math.round(attacker.atk * 0.24 * attacker.matchupMult));
        defender.hp = Math.max(0, defender.hp - chipDmg);
        defender.state = 'stun';
        defender.stateTimer = 0;
        defender.stateDur = 0.78;
        defender.vel.addScaledVector(knockDir, 3.6);
        this.burstMusicalNotes(mid.x, 1.5, mid.z, '#fb923c', 6);
        this.addPopup(defender.pos.x, 2.1, defender.pos.z, `破防！！-${chipDmg}`, '#ff6a3d', 1.3);
        this.checkKO(attacker, defender);
        return;
      }

      // Successful standard block!
      sound.playClash(false);
      this.hitStopTimer = 0.04;
      const chip = Math.max(2, Math.round(attacker.atk * 0.07 * (100 / (60 + defender.guardStat))));
      defender.hp = Math.max(1, defender.hp - chip);
      defender.vel.addScaledVector(knockDir, 1.8);
      attacker.vel.addScaledVector(knockDir, -2.2);
      attacker.state = 'recover';
      attacker.stateTimer = 0;
      attacker.stateDur = 0.3;

      // Quarter rest special counter buff on block!
      if (defender.promptId === 'quarter_rest' || defender.archetype === 'wide') {
        defender.counterBuff = 1.3;
        this.addPopup(defender.pos.x, 1.9, defender.pos.z, '格擋反震！', '#34d399', 1.1);
      } else {
        this.addPopup(defender.pos.x, 1.85, defender.pos.z, '擋下！', '#93c5fd', 1.0);
      }
      if (this.callbacks.onHudUpdate) this.callbacks.onHudUpdate(this.fA, this.fB, this.matchTimer);
      return;
    }

    // 3. Clean Hit!
    const rawDmg =
      attacker.atk *
      0.34 *
      attacker.matchupMult *
      attacker.counterBuff *
      (defender.state === 'stun' ? 1.25 : 1.0) *
      (0.92 + Math.random() * 0.16);
    const dmg = Math.max(6, Math.round(rawDmg));
    const wasCounter = attacker.counterBuff > 1.05;
    attacker.counterBuff = 1.0;

    defender.hp = Math.max(0, defender.hp - dmg);
    const isHeavy = dmg >= 28 || attacker.archetype === 'heavy';
    sound.playHit(isHeavy);
    this.hitStopTimer = isHeavy ? 0.065 : 0.04;

    defender.vel.addScaledVector(knockDir, isHeavy ? 3.8 : 2.3);
    if (defender.state === 'windup' && (isHeavy || attacker.archetype === 'thin')) {
      // Interrupt opponent's slow windup!
      defender.state = 'stun';
      defender.stateTimer = 0;
      defender.stateDur = 0.32;
    }

    this.burstMusicalNotes(defender.pos.x, 1.45, defender.pos.z, wasCounter ? '#ffe14d' : '#ff8a65', 5);
    this.addPopup(
      defender.pos.x,
      1.95 * (defender.isBoss ? 1.3 : 1.0),
      defender.pos.z,
      `${wasCounter ? '反擊！' : ''}-${dmg}`,
      wasCounter ? '#ffe14d' : '#ff6a3d',
      isHeavy || wasCounter ? 1.3 : 1.08
    );

    this.checkKO(attacker, defender);
  }

  checkKO(attacker, defender) {
    if (this.callbacks.onHudUpdate) {
      this.callbacks.onHudUpdate(this.fA, this.fB, this.matchTimer);
    }
    if (defender.hp <= 0 && this.mode === 'fight') {
      defender.hp = 0;
      defender.state = 'ko';
      defender.stateTimer = 0;
      attacker.state = 'idle';
      this.mode = 'result';
      const playerWon = defender === this.fB;
      sound.playKO(playerWon);
      this.addPopup(defender.pos.x, 2.2, defender.pos.z, '勝負已分！！', '#ffe14d', 1.5);

      setTimeout(() => {
        if (this.callbacks.onBattleEnd) {
          this.callbacks.onBattleEnd({
            playerWon,
            fA: this.fA,
            fB: this.fB,
            timeUsed: Math.round(45 - this.matchTimer),
          });
        }
      }, 950);
    }
  }

  update(rawDt) {
    this.camTime += rawDt;

    if (this.mode === 'backdrop') {
      // Animate idle breathing, blinking, headband ribbons & Buddha halo even on Draw/Prep/Showcase screens!
      if (this.fA && this.fA.rig && this.fA.rig.animateDetails) {
        this.fA.rig.animateDetails({ dt: rawDt, time: this.camTime, speed: 0.18, state: 'idle' });
        this.fA.rig.armPivot.rotation.x = -0.1 + Math.sin(this.camTime * 2.6) * 0.04;
      }
      if (this.fB && this.fB.rig && this.fB.rig.animateDetails) {
        this.fB.rig.animateDetails({ dt: rawDt, time: this.camTime + 1.3, speed: 0.18, state: 'idle' });
        this.fB.rig.armPivot.rotation.x = -0.1 + Math.sin(this.camTime * 2.6 + 1.3) * 0.04;
      }

      if (this.showcaseActive) {
        // Close-up Character Inspection Camera!
        let targetCamPos;
        let lookTarget;
        const orbit = Math.sin(this.camTime * 0.55) * 0.55;
        if (this.showcaseFocus === 'player') {
          targetCamPos = new THREE.Vector3(-2.05 + Math.sin(orbit) * 1.6, 1.65, 0.55 + Math.cos(orbit) * 2.25);
          lookTarget = new THREE.Vector3(-2.05, 1.22, 0.55);
        } else if (this.showcaseFocus === 'opponent') {
          const bossExtra = this.fB && this.fB.isBoss ? 1.15 : 0;
          targetCamPos = new THREE.Vector3(2.05 + Math.sin(orbit) * (1.7 + bossExtra * 0.4), 1.7 + bossExtra * 0.45, 0.55 + Math.cos(orbit) * (2.35 + bossExtra));
          lookTarget = new THREE.Vector3(2.05, 1.25 + bossExtra * 0.42, 0.55);
        } else {
          targetCamPos = new THREE.Vector3(Math.sin(this.camTime * 0.35) * 0.8, 2.25, 5.35);
          lookTarget = new THREE.Vector3(0, 1.25, 0.45);
        }
        this.camera.position.lerp(targetCamPos, Math.min(1, rawDt * 6));
        this.camera.lookAt(lookTarget);
      } else {
        // Gentle cinematic dojo orbit behind UI cards
        const ang = Math.sin(this.camTime * 0.28) * 0.32;
        const targetPos = new THREE.Vector3(Math.sin(ang) * 7.1, 3.25, Math.cos(ang) * 7.1);
        this.camera.position.lerp(targetPos, Math.min(1, rawDt * 5));
        this.camera.lookAt(0, 1.25, 0.25);
      }
      return;
    }

    const dt = rawDt * (this.mode === 'fight' ? this.speedMult : 1);

    // Update popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.age += rawDt;
      p.pos.y += (p.velY || 1.2) * rawDt;
      if (p.velX) p.pos.x += p.velX * rawDt;
      if (p.velY) p.velY -= 2.4 * rawDt;
      if (p.age >= p.life) this.popups.splice(i, 1);
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= rawDt;
      return;
    }

    if (this.mode === 'fight') {
      this.fightElapsed += dt;
      this.matchTimer = Math.max(0, this.matchTimer - dt);

      if (this.fA.isManual) {
        this.updateManualPlayer(this.fA, this.fB, dt);
      } else {
        this.updateFighterAI(this.fA, this.fB, dt);
      }
      this.updateFighterAI(this.fB, this.fA, dt);

      this.stepFighterState(this.fA, this.fB, this.ribbonA, dt);
      this.stepFighterState(this.fB, this.fA, this.ribbonB, dt);

      if (this.callbacks.onHudUpdate) {
        this.callbacks.onHudUpdate(this.fA, this.fB, this.matchTimer);
      }

      // Time-up tiebreaker
      if (this.matchTimer <= 0 && this.mode === 'fight') {
        const ratioA = this.fA.hp / this.fA.maxHp;
        const ratioB = this.fB.hp / this.fB.maxHp;
        const playerWon = ratioA >= ratioB;
        const loser = playerWon ? this.fB : this.fA;
        loser.state = 'ko';
        loser.stateTimer = 0;
        this.mode = 'result';
        sound.playKO(playerWon);
        setTimeout(() => {
          if (this.callbacks.onBattleEnd) {
            this.callbacks.onBattleEnd({ playerWon, fA: this.fA, fB: this.fB, timeUsed: 45 });
          }
        }, 900);
      }
    } else if (this.mode === 'result' && this.fA && this.fB) {
      this.stepFighterState(this.fA, this.fB, this.ribbonA, rawDt);
      this.stepFighterState(this.fB, this.fA, this.ribbonB, rawDt);
    }

    // Dynamic framing camera tracking both fighters!
    if (this.fA && this.fB) {
      const midX = (this.fA.pos.x + this.fB.pos.x) * 0.5;
      const midZ = (this.fA.pos.z + this.fB.pos.z) * 0.5;
      const span = this.fA.pos.distanceTo(this.fB.pos);
      const bossZoom = this.fB.isBoss ? 1.55 : 0;
      const desiredDist = Math.max(5.8, Math.min(9.8, 4.3 + span * 0.92 + bossZoom));
      const desiredY = 2.65 + desiredDist * 0.2 + (this.fB.isBoss ? 0.45 : 0);

      this.camera.position.x += (midX * 0.65 - this.camera.position.x) * Math.min(1, rawDt * 5);
      this.camera.position.y += (desiredY - this.camera.position.y) * Math.min(1, rawDt * 5);
      this.camera.position.z += (midZ + desiredDist - this.camera.position.z) * Math.min(1, rawDt * 5);
      this.camera.lookAt(midX, 1.2 + (this.fB.isBoss ? 0.35 : 0), midZ);
    }
  }

  render() {
    this.camera.updateMatrixWorld();
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }

    // Render 2D floating combat callouts & musical sparks (plus 2D dojo fallback if WebGL is unavailable)
    const ctx = this.ovCtx;
    const W = this.ov.width;
    const H = this.ov.height;
    ctx.clearRect(0, 0, W, H);

    if (!this.renderer) {
      ctx.save();
      ctx.fillStyle = '#2b2238';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#c8965a';
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(W * 0.5, H * 0.72, W * 0.42, H * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(78, 38, 12, 0.36)';
      ctx.font = `900 ${Math.round(22 * this.ovDpr)}px "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♪ 禹承老師音樂課 ♪', W * 0.5, H * 0.74);
      const projF = new THREE.Vector3();
      for (const f of [this.fA, this.fB]) {
        if (!f || !f.rig) continue;
        projF.copy(f.pos || f.rig.root.position).project(this.camera);
        const fx = (projF.x * 0.5 + 0.5) * W;
        const fy = (-projF.y * 0.5 + 0.5) * H;
        const sc = (f.scale || 1) * this.ovDpr;
        ctx.fillStyle = f === this.fA ? '#1e3a5f' : '#7c2d12';
        ctx.fillRect(fx - 18 * sc, fy - 60 * sc, 36 * sc, 60 * sc);
        ctx.fillStyle = f.isBoss ? '#facc15' : '#f4cfa8';
        ctx.beginPath();
        ctx.arc(fx, fy - 76 * sc, 18 * sc, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (this.popups.length === 0) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const proj = new THREE.Vector3();
    for (const p of this.popups) {
      proj.copy(p.pos).project(this.camera);
      if (proj.z > 1) continue;
      const sx = (proj.x * 0.5 + 0.5) * W;
      const sy = (-proj.y * 0.5 + 0.5) * H;
      const alpha = Math.max(0, 1 - Math.pow(p.age / p.life, 2));
      const fontSize = Math.round(20 * p.scale * this.ovDpr);

      ctx.globalAlpha = alpha;
      ctx.font = `900 ${fontSize}px "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif`;
      ctx.lineWidth = Math.max(3, fontSize * 0.22);
      ctx.strokeStyle = '#1b1b22';
      ctx.strokeText(p.text, sx, sy);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, sx, sy);
    }
    ctx.restore();
  }
}
