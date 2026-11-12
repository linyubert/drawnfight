import * as THREE from 'three';

let sharedFabricTex = null;
function getFabricBumpTexture() {
  if (sharedFabricTex) return sharedFabricTex;
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(0, 0, 64, 64);
  // Subtle Japanese sashiko kendo-gi diamond weave
  ctx.strokeStyle = '#ececec';
  ctx.lineWidth = 1.5;
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      ctx.strokeRect(x + 1, y + 1, 6, 6);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  sharedFabricTex = tex;
  return tex;
}

/**
 * Create fluted / pleated samurai Hakama skirt geometry with crisp vertical folds!
 */
function createPleatedHakamaGeometry(topR = 0.205, botR = 0.375, height = 0.72, pleats = 12) {
  const radialSegs = 56;
  const heightSegs = 6;
  const geo = new THREE.CylinderGeometry(topR, botR, height, radialSegs, heightSegs, false);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.01) continue;

    const ang = Math.atan2(z, x);
    // Vertical factor: 0 at waist (+height/2), 1 at hem (-height/2)
    const t = Math.max(0, Math.min(1, (height * 0.5 - y) / height));
    const pleatWave = Math.cos(ang * pleats) * 0.018 * (0.25 + 0.75 * t);
    // Slightly wider side-to-side than front-to-back like real tailored hakama
    const ovalScaleX = 1.05;
    const ovalScaleZ = 0.94;
    const nr = r + pleatWave;

    pos.setX(i, Math.cos(ang) * nr * ovalScaleX);
    pos.setZ(i, Math.sin(ang) * nr * ovalScaleZ);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Build a richly detailed, expressive 3D Fighter Rig with persona-specific costumes & animations!
 * Faces +Z in local space.
 */
export function createDetailedFighterRig(options = {}) {
  const {
    persona = 'player',
    colors = {},
    scale = 1.0,
    isBoss = false,
  } = options;

  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const fabricTex = getFabricBumpTexture();

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: isBoss ? 0xfacc15 : persona === 'taiko_chef' || persona === 'blacksmith_tuner' ? 0xeab892 : 0xf6d3b2,
    metalness: isBoss ? 0.62 : 0.04,
    roughness: isBoss ? 0.24 : 0.58,
  });

  const blushMat = new THREE.MeshBasicMaterial({
    color: isBoss ? 0xf59e0b : 0xf472b6,
    transparent: true,
    opacity: isBoss ? 0.25 : 0.34,
  });

  const topMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.top || '#ffffff'),
    bumpMap: isBoss ? null : fabricTex,
    bumpScale: 0.008,
    metalness: isBoss ? 0.5 : 0.05,
    roughness: isBoss ? 0.3 : 0.62,
  });

  const hakamaMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.hakama || '#1e3a5f'),
    metalness: isBoss ? 0.45 : 0.06,
    roughness: isBoss ? 0.32 : 0.68,
  });

  const bandMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.band || '#ef4444'),
    roughness: 0.45,
  });

  const hairColorHex =
    persona === 'maestro_beethoven'
      ? 0xd6d3d1
      : persona === 'metronome_sensei'
      ? 0x57534e
      : persona === 'golden_buddha'
      ? 0xb45309
      : persona === 'player2'
      ? 0x451a03
      : persona === 'pirate_guitarist'
      ? 0x27272a
      : 0x1b1b22;

  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColorHex,
    roughness: 0.55,
    metalness: isBoss ? 0.35 : 0.08,
  });

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1b22, roughness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.58, roughness: 0.28 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.72 });

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // =========================================================================
  // 1. LOWER BODY: Articulated Legs + Tabi/Shoes/Sandals + Pleated Hakama + Obi
  // =========================================================================
  const legsGroup = new THREE.Group();
  bodyGroup.add(legsGroup);

  const buildLeg = (sideSign) => {
    const pivot = new THREE.Group();
    pivot.position.set(sideSign * 0.115, 0.44, 0);

    // Shin / Calf
    const shinMat = persona === 'recorder_kid' ? skinMat : whiteMat;
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.048, 0.36, 10), shinMat);
    shin.position.y = -0.19;
    shin.castShadow = true;
    pivot.add(shin);

    if (persona === 'recorder_kid') {
      // Navy crew sock + white school sneaker (uwabaki) with blue toe!
      const sock = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.05, 0.14, 10),
        new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 })
      );
      sock.position.y = -0.31;
      pivot.add(sock);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.075, 0.21), whiteMat);
      shoe.position.set(0, -0.4, 0.035);
      shoe.castShadow = true;
      pivot.add(shoe);

      const toeCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.118, 0.045, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 })
      );
      toeCap.position.set(0, -0.41, 0.115);
      pivot.add(toeCap);
    } else if (isBoss) {
      // Golden bare Buddha foot
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skinMat);
      foot.scale.set(0.95, 0.55, 1.45);
      foot.position.set(0, -0.4, 0.04);
      pivot.add(foot);
    } else {
      // Traditional Samurai White Tabi Sock + Zori Sandal with Hanao Strap!
      const tabi = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), whiteMat);
      tabi.scale.set(0.92, 0.62, 1.55);
      tabi.position.set(0, -0.39, 0.035);
      pivot.add(tabi);

      const sandalSole = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.028, 0.215),
        new THREE.MeshStandardMaterial({ color: 0xd6b37c, roughness: 0.8 })
      );
      sandalSole.position.set(0, -0.425, 0.035);
      sandalSole.castShadow = true;
      pivot.add(sandalSole);

      const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.11), bandMat);
      strapL.position.set(0.022, -0.39, 0.04);
      strapL.rotation.y = -0.25;
      const strapR = strapL.clone();
      strapR.position.x = -0.022;
      strapR.rotation.y = 0.25;
      pivot.add(strapL, strapR);
    }

    return pivot;
  };

  const legL = buildLeg(1);
  const legR = buildLeg(-1);
  legsGroup.add(legL, legR);

  // Stage 8 Boss: Floating 2-Tier 3D Golden Lotus Pedestal (蓮華座)!
  let lotusGroup = null;
  if (isBoss) {
    lotusGroup = new THREE.Group();
    lotusGroup.position.y = 0.04;
    const lotusGold = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.65,
      roughness: 0.25,
    });
    const lotusRose = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      metalness: 0.5,
      roughness: 0.3,
    });

    const coreBase = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.38, 0.09, 20), lotusGold);
    coreBase.position.y = 0.03;
    lotusGroup.add(coreBase);

    const petalGeo = new THREE.ConeGeometry(0.11, 0.24, 5);
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, i % 2 === 0 ? lotusGold : lotusRose);
      petal.position.set(Math.cos(ang) * 0.44, 0.08, Math.sin(ang) * 0.44);
      petal.rotation.order = 'YXZ';
      petal.rotation.y = -ang + Math.PI / 2;
      petal.rotation.x = 0.55;
      lotusGroup.add(petal);
    }
    root.add(lotusGroup);
  }

  // Hakama / Shorts / Pants
  if (persona === 'recorder_kid') {
    // Schoolboy navy shorts!
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.245, 0.36, 20), hakamaMat);
    shorts.position.y = 0.62;
    shorts.castShadow = true;
    bodyGroup.add(shorts);
  } else {
    const hakamaGeo = createPleatedHakamaGeometry(0.205, 0.37, 0.72, 12);
    const hakama = new THREE.Mesh(hakamaGeo, hakamaMat);
    hakama.position.y = 0.48;
    hakama.castShadow = true;
    bodyGroup.add(hakama);
  }

  // Obi Sash (帯) + Back Knot (腰板)
  const obiColor =
    persona === 'pirate_guitarist'
      ? 0x78350f
      : persona === 'maestro_beethoven'
      ? 0x991b1b
      : isBoss
      ? 0xd97706
      : 0xfef3c7;
  const obiMat = new THREE.MeshStandardMaterial({ color: obiColor, roughness: 0.55 });
  const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.222, 0.228, 0.11, 20), obiMat);
  obi.scale.set(1.04, 1, 0.88);
  obi.position.y = 0.83;
  bodyGroup.add(obi);

  if (persona === 'pirate_guitarist') {
    // Brass Pirate Belt Buckle!
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.04), goldMat);
    buckle.position.set(0, 0.83, 0.2);
    bodyGroup.add(buckle);
  } else if (!isBoss && persona !== 'recorder_kid') {
    // Samurai Obi Back Knot
    const obiKnot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.08), obiMat);
    obiKnot.position.set(0, 0.84, -0.2);
    bodyGroup.add(obiKnot);
  }

  // =========================================================================
  // 2. UPPER TORSO: Sculpted Chest, Crossed Kimono Collar, Coats & Backpacks!
  // =========================================================================
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 1.1;
  bodyGroup.add(torsoGroup);

  // Rounded chest core
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.205, 0.5, 16), topMat);
  chest.scale.set(1.08, 1.0, 0.76);
  chest.castShadow = true;
  torsoGroup.add(chest);

  // Broad rounded shoulder caps
  const shoulderGeo = new THREE.SphereGeometry(0.115, 12, 10);
  const shL = new THREE.Mesh(shoulderGeo, topMat);
  shL.position.set(0.2, 0.17, 0);
  const shR = shL.clone();
  shR.position.set(-0.2, 0.17, 0);
  torsoGroup.add(shL, shR);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.092, 0.16, 12), skinMat);
  neck.position.y = 0.28;
  torsoGroup.add(neck);

  // Crossed Kimono V-Lapels (右前: left lapel over right lapel!)
  const collarMat =
    persona === 'player'
      ? new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.5 })
      : persona === 'maestro_beethoven'
      ? whiteMat
      : bandMat;

  const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.3, 0.035), collarMat);
  lapelL.position.set(0.045, 0.08, 0.162);
  lapelL.rotation.z = 0.34;

  const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.28, 0.03), collarMat);
  lapelR.position.set(-0.045, 0.07, 0.155);
  lapelR.rotation.z = -0.34;
  torsoGroup.add(lapelL, lapelR);

  // Persona-Specific Torso Costumes & Props!
  if (persona === 'player') {
    // Golden musical badge on left chest!
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), goldMat);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0.11, 0.11, 0.168);
    torsoGroup.add(badge);
  } else if (persona === 'player2' || persona === 'metronome_sensei') {
    // Sleeveless Haori / Jinbaori Overcoat Panels!
    const haoriCol = persona === 'metronome_sensei' ? 0x1c1917 : 0xc2410c;
    const haoriMat = new THREE.MeshStandardMaterial({ color: haoriCol, roughness: 0.6 });
    const panelGeo = new THREE.BoxGeometry(0.13, 0.52, 0.34);
    const pL = new THREE.Mesh(panelGeo, haoriMat);
    pL.position.set(0.15, -0.01, 0);
    const pR = pL.clone();
    pR.position.set(-0.15, -0.01, 0);
    const pBack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.05), haoriMat);
    pBack.position.set(0, -0.01, -0.16);
    torsoGroup.add(pL, pR, pBack);
  } else if (persona === 'recorder_kid') {
    // Iconic Red Japanese Randoseru School Backpack + Yellow Name Tag!
    const bagMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32, metalness: 0.1 });
    const bagBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.18), bagMat);
    bagBody.position.set(0, 0.03, -0.24);
    bagBody.castShadow = true;
    torsoGroup.add(bagBody);

    const bagFlap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.322, 12, 1, false, 0, Math.PI), bagMat);
    bagFlap.rotation.z = Math.PI / 2;
    bagFlap.position.set(0, 0.21, -0.24);
    torsoGroup.add(bagFlap);

    const strapGeo = new THREE.BoxGeometry(0.048, 0.42, 0.22);
    const stL = new THREE.Mesh(strapGeo, bagMat);
    stL.position.set(0.12, 0.06, -0.06);
    const stR = stL.clone();
    stR.position.x = -0.12;
    torsoGroup.add(stL, stR);

    const nameTag = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.045, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    nameTag.position.set(0.1, 0.12, 0.17);
    torsoGroup.add(nameTag);
  } else if (persona === 'taiko_chef') {
    // Crisp White Itamae / Festival Apron (前掛け)
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.04), whiteMat);
    apron.position.set(0, -0.34, 0.19);
    torsoGroup.add(apron);
  } else if (persona === 'pirate_guitarist') {
    // Gold Fringed Pirate Captain Epaulettes!
    const epGeo = new THREE.BoxGeometry(0.14, 0.05, 0.16);
    const epL = new THREE.Mesh(epGeo, goldMat);
    epL.position.set(0.24, 0.22, 0);
    epL.rotation.z = -0.15;
    const epR = epL.clone();
    epR.position.x = -0.24;
    epR.rotation.z = 0.15;
    torsoGroup.add(epL, epR);
  } else if (persona === 'blacksmith_tuner') {
    // Heavy Leather Blacksmith Apron Bib + Cross Straps!
    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.56, 0.045), leatherMat);
    bib.position.set(0, -0.12, 0.168);
    torsoGroup.add(bib);
  } else if (persona === 'paganini_ronin') {
    // Royal Purple Virtuoso Asymmetric Shoulder Cape + Gold Brooch!
    const capeMat = new THREE.MeshStandardMaterial({ color: 0x6b21a8, roughness: 0.55 });
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.68, 12, 1, false, 0, Math.PI * 1.25), capeMat);
    cape.position.set(0.08, -0.08, -0.12);
    cape.rotation.x = 0.16;
    cape.rotation.z = -0.12;
    torsoGroup.add(cape);

    const brooch = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), goldMat);
    brooch.position.set(0.13, 0.16, 0.17);
    torsoGroup.add(brooch);
  } else if (persona === 'maestro_beethoven') {
    // White Dress Shirt Plastron + Flowing Red Maestro Cravat + Twin Coattails!
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.03), whiteMat);
    shirt.position.set(0, 0.07, 0.16);
    torsoGroup.add(shirt);

    const cravatMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
    const cravatKnot = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), cravatMat);
    cravatKnot.position.set(0, 0.2, 0.185);
    const cravatTail = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.18, 6), cravatMat);
    cravatTail.position.set(0, 0.1, 0.19);
    cravatTail.rotation.x = 0.12;
    torsoGroup.add(cravatKnot, cravatTail);

    // Symphony Coattails in back
    const tailGeo = new THREE.BoxGeometry(0.14, 0.46, 0.04);
    const ctL = new THREE.Mesh(tailGeo, topMat);
    ctL.position.set(0.09, -0.38, -0.19);
    ctL.rotation.x = 0.18;
    const ctR = ctL.clone();
    ctR.position.x = -0.09;
    torsoGroup.add(ctL, ctR);
  } else if (isBoss) {
    // Golden Buddha Diagonal Vermilion Kasaya Sash (袈裟)!
    const kasayaMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.25,
      roughness: 0.45,
    });
    const kasayaSash = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.068, 10, 24), kasayaMat);
    kasayaSash.scale.set(1.0, 1.35, 0.85);
    kasayaSash.rotation.y = 0.3;
    kasayaSash.rotation.z = 0.65;
    kasayaSash.position.set(-0.02, 0.02, 0.01);
    torsoGroup.add(kasayaSash);
  }

  // =========================================================================
  // 3. ARTICULATED ARMS, HANGING KIMONO SLEEVES, KOTE GAUNTLETS & HANDS!
  // =========================================================================
  const armPivot = new THREE.Group();
  armPivot.position.set(0, 1.24, 0.12);
  bodyGroup.add(armPivot);

  const buildDetailedArm = (sideSign, gripY, gripZ) => {
    const g = new THREE.Group();

    const bareArms = persona === 'taiko_chef' || persona === 'blacksmith_tuner';
    // Wide Hanging Kimono / Happi Sleeve (袖) on upper arm
    if (!bareArms) {
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.24), topMat);
      sleeve.position.set(sideSign * 0.17, -0.05, 0.09);
      sleeve.rotation.y = -sideSign * 0.28;
      sleeve.rotation.x = 0.25;
      sleeve.castShadow = true;
      g.add(sleeve);
    }

    // Forearm cylinder connecting shoulder to sword grip
    const pStart = new THREE.Vector3(sideSign * 0.18, 0.0, 0.04);
    const pEnd = new THREE.Vector3(0, gripY, gripZ);
    const dir = new THREE.Vector3().subVectors(pEnd, pStart);
    const len = dir.length();

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, len, 10), skinMat);
    forearm.position.copy(pStart).addScaledVector(dir, 0.5);
    forearm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    forearm.castShadow = true;
    g.add(forearm);

    // Kote Wrist Guard / Bracer near hand!
    if (persona !== 'recorder_kid' && !isBoss) {
      const koteMat =
        persona === 'blacksmith_tuner'
          ? new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.6, roughness: 0.35 })
          : hakamaMat;
      const kote = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.052, 0.13, 10), koteMat);
      kote.position.copy(pStart).addScaledVector(dir, 0.78);
      kote.quaternion.copy(forearm.quaternion);
      g.add(kote);
    }

    // Sculpted Hand (Palm + Curled Fingers + Thumb gripping hilt!)
    const handGroup = new THREE.Group();
    handGroup.position.copy(pEnd);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.056, 10, 10), skinMat);
    palm.scale.set(0.95, 0.9, 1.15);
    handGroup.add(palm);

    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.058, 0.062), skinMat);
    fingers.position.set(-sideSign * 0.02, 0, 0.022);
    handGroup.add(fingers);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.032, 4, 6), skinMat);
    thumb.rotation.z = Math.PI / 3;
    thumb.position.set(sideSign * 0.035, 0.025, 0.025);
    handGroup.add(thumb);

    g.add(handGroup);
    return g;
  };

  // Right hand grips upper tsuka (-0.05, 0.44); Left hand grips lower pommel (-0.17, 0.41)
  armPivot.add(buildDetailedArm(-1, -0.05, 0.44));
  armPivot.add(buildDetailedArm(1, -0.17, 0.41));

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.1, 0.44);
  weaponMount.rotation.x = 0.28;
  armPivot.add(weaponMount);

  // =========================================================================
  // 4. EXPRESSIVE 3D HEAD, EARS, DYNAMIC EYES/BROWS/MOUTH & PERSONA HEADGEAR!
  // =========================================================================
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.56, 0);
  bodyGroup.add(headGroup);

  const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.235, 24, 20), skinMat);
  headSphere.scale.set(1.03, 0.98, 0.98);
  headSphere.castShadow = true;
  headGroup.add(headSphere);

  // Sculpted Ears (with elongated 福耳 earlobes for Golden Buddha!)
  const earGeo = new THREE.SphereGeometry(0.052, 10, 8);
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.scale.set(0.55, isBoss ? 1.85 : 1.05, 0.8);
  earL.position.set(0.235, isBoss ? -0.03 : 0, -0.01);
  const earR = earL.clone();
  earR.position.x = -0.235;
  headGroup.add(earL, earR);

  // Cute 3D Nose & Rosy Cheeks
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), skinMat);
  nose.scale.set(0.85, 0.9, 1.25);
  nose.position.set(0, -0.015, 0.232);
  headGroup.add(nose);

  const cheekGeo = new THREE.CircleGeometry(0.038, 12);
  const cheekL = new THREE.Mesh(cheekGeo, blushMat);
  cheekL.position.set(0.125, -0.045, 0.205);
  cheekL.rotation.y = 0.45;
  const cheekR = cheekL.clone();
  cheekR.position.x = -0.125;
  cheekR.rotation.y = -0.45;
  headGroup.add(cheekL, cheekR);

  // Layered Expressive Eyes (Sclera + Iris + Shine Catchlight + Eyelid + KO Cross!)
  const buildEye = (sideSign) => {
    const eg = new THREE.Group();
    eg.position.set(sideSign * 0.082, 0.022, 0.212);
    eg.rotation.y = sideSign * 0.26;

    const sclera = new THREE.Mesh(
      new THREE.CircleGeometry(0.042, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    eg.add(sclera);

    const irisColor =
      persona === 'paganini_ronin'
        ? 0x7e22ce
        : persona === 'maestro_beethoven'
        ? 0x1d4ed8
        : isBoss
        ? 0x92400e
        : 0x1b1b22;
    const iris = new THREE.Mesh(
      new THREE.CircleGeometry(0.029, 14),
      new THREE.MeshBasicMaterial({ color: irisColor })
    );
    iris.position.z = 0.002;
    eg.add(iris);

    const shine = new THREE.Mesh(
      new THREE.CircleGeometry(0.01, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    shine.position.set(0.01, 0.011, 0.004);
    eg.add(shine);

    // Blink / Squint Eyelid
    const eyelid = new THREE.Mesh(new THREE.PlaneGeometry(0.092, 0.092), skinMat);
    eyelid.position.set(0, 0.045, 0.006);
    eyelid.scale.y = isBoss ? 0.42 : 0.01; // Buddha has serene half-closed eyes!
    eg.add(eyelid);

    // KO 'X' Eye
    const koGroup = new THREE.Group();
    koGroup.position.z = 0.008;
    koGroup.visible = false;
    const barGeo = new THREE.PlaneGeometry(0.075, 0.018);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x1b1b22 });
    const b1 = new THREE.Mesh(barGeo, barMat);
    b1.rotation.z = Math.PI / 4;
    const b2 = b1.clone();
    b2.rotation.z = -Math.PI / 4;
    koGroup.add(b1, b2);
    eg.add(koGroup);

    return { group: eg, iris, eyelid, koGroup };
  };

  const eyeL = buildEye(1);
  const eyeR = buildEye(-1);
  headGroup.add(eyeL.group, eyeR.group);

  // Articulated Eyebrows (眉)
  const browThickness = persona === 'metronome_sensei' || persona === 'blacksmith_tuner' ? 0.028 : 0.019;
  const browGeo = new THREE.BoxGeometry(0.082, browThickness, 0.022);
  const browL = new THREE.Mesh(browGeo, hairMat);
  browL.position.set(0.082, 0.078, 0.218);
  browL.rotation.y = 0.26;
  const browR = browL.clone();
  browR.position.x = -0.082;
  browR.rotation.y = -0.26;
  headGroup.add(browL, browR);

  // Dynamic Mouth (Calm Line / Battle Shout / Surprised O)
  const mouthIdle = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.012, 0.01),
    new THREE.MeshBasicMaterial({ color: 0x451a03 })
  );
  mouthIdle.position.set(0, -0.078, 0.224);
  headGroup.add(mouthIdle);

  const mouthShout = new THREE.Group();
  mouthShout.position.set(0, -0.082, 0.223);
  mouthShout.visible = false;
  const cavity = new THREE.Mesh(
    new THREE.CircleGeometry(0.036, 12),
    new THREE.MeshBasicMaterial({ color: 0x7f1d1d })
  );
  const teeth = new THREE.Mesh(
    new THREE.PlaneGeometry(0.048, 0.014),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  teeth.position.set(0, 0.018, 0.002);
  mouthShout.add(cavity, teeth);
  headGroup.add(mouthShout);

  // =========================================================================
  // 5. BESPOKE HAIRSTYLES, HATS, BEARDS, HALOS & FLUTTERING HEADBAND TAILS!
  // =========================================================================
  const ribbonTails = [];
  let rotatingHalo = null;
  let swayingTail = null;

  const addFlutteringHeadband = (bandY = 0.075) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.233, 0.028, 10, 28), bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = bandY;
    headGroup.add(band);

    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), bandMat);
    knot.position.set(0, bandY, -0.24);
    headGroup.add(knot);

    for (const side of [-1, 1]) {
      const tailPivot = new THREE.Group();
      tailPivot.position.set(side * 0.025, bandY, -0.245);
      const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.24, 0.014), bandMat);
      tailMesh.position.set(side * 0.03, -0.11, -0.03);
      tailMesh.rotation.z = side * 0.22;
      tailMesh.rotation.x = 0.28;
      tailPivot.add(tailMesh);
      headGroup.add(tailPivot);
      ribbonTails.push({ pivot: tailPivot, side });
    }
  };

  if (isBoss) {
    // Stage 8 Boss: 38 Sacred Snail-Shell Curls (螺髪) + Ushnisha + Forehead Gem + Rotating Sun Halo!
    const curlGeo = new THREE.SphereGeometry(0.044, 8, 8);
    const rings = [
      { y: 0.1, r: 0.215, count: 14 },
      { y: 0.165, r: 0.175, count: 12 },
      { y: 0.215, r: 0.115, count: 8 },
    ];
    for (const rg of rings) {
      for (let i = 0; i < rg.count; i++) {
        const ang = (i / rg.count) * Math.PI * 2;
        // Leave front forehead open
        if (rg.y < 0.13 && Math.sin(ang) > 0.55) continue;
        const curl = new THREE.Mesh(curlGeo, hairMat);
        curl.position.set(Math.cos(ang) * rg.r, rg.y, Math.sin(ang) * rg.r);
        headGroup.add(curl);
      }
    }
    const ushnisha = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), hairMat);
    ushnisha.position.set(0, 0.255, -0.01);
    headGroup.add(ushnisha);

    const urna = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    urna.position.set(0, 0.095, 0.228);
    headGroup.add(urna);

    // Ornate Multi-Ring Rotating Dharma Sun Halo!
    rotatingHalo = new THREE.Group();
    rotatingHalo.position.set(0, 0.06, -0.22);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const haloOuter = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.028, 10, 40), haloMat);
    const haloInner = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.018, 8, 32), haloMat);
    rotatingHalo.add(haloOuter, haloInner);

    const rayGeo = new THREE.ConeGeometry(0.028, 0.14, 4);
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const ray = new THREE.Mesh(rayGeo, haloMat);
      ray.position.set(Math.cos(ang) * 0.53, Math.sin(ang) * 0.53, 0);
      ray.rotation.z = ang - Math.PI / 2;
      rotatingHalo.add(ray);
    }
    headGroup.add(rotatingHalo);
  } else if (persona === 'recorder_kid') {
    // Cute Bowl-Cut Hair + Bright Yellow Japanese School Cap (通学帽)!
    const hairBowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
      hairMat
    );
    hairBowl.rotation.x = -0.12;
    headGroup.add(hairBowl);

    const capMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.248, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.46),
      capMat
    );
    capDome.position.y = 0.03;
    headGroup.add(capDome);

    const capVisor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.022, 18, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
      capMat
    );
    capVisor.position.set(0, 0.05, 0.09);
    capVisor.rotation.x = 0.22;
    headGroup.add(capVisor);
  } else if (persona === 'pirate_guitarist') {
    // Eyepatch over Right Eye + Spiky Punk Hair + Black Tricorn Pirate Hat!
    eyeR.group.visible = false;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.052, 12), darkMat);
    patch.position.set(-0.082, 0.025, 0.222);
    patch.rotation.y = -0.26;
    const patchStrap = new THREE.Mesh(new THREE.TorusGeometry(0.236, 0.01, 6, 24), darkMat);
    patchStrap.rotation.y = 0.2;
    patchStrap.rotation.x = 1.25;
    patchStrap.position.y = 0.04;
    headGroup.add(patch, patchStrap);

    // Scruffy beard
    const scruff = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.11, 6), hairMat);
    scruff.rotation.x = Math.PI;
    scruff.position.set(0, -0.16, 0.17);
    headGroup.add(scruff);

    // Tricorn Pirate Hat!
    const hatGroup = new THREE.Group();
    hatGroup.position.y = 0.14;
    hatGroup.rotation.x = -0.1;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.16, 16), darkMat);
    hatGroup.add(crown);

    const triBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.035, 3), darkMat);
    triBrim.rotation.y = Math.PI;
    triBrim.position.y = -0.04;
    const triTrim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.016, 6, 3), goldMat);
    triTrim.rotation.x = Math.PI / 2;
    triTrim.rotation.z = Math.PI / 6;
    triTrim.position.y = -0.025;
    hatGroup.add(triBrim, triTrim);

    // Red feather plume
    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
    );
    plume.position.set(0.18, 0.12, -0.05);
    plume.rotation.z = -0.45;
    hatGroup.add(plume);
    headGroup.add(hatGroup);
  } else if (persona === 'maestro_beethoven') {
    // Sculpted Voluminous Wild Wavy Silver Beethoven Mane!
    const topHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.252, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    topHair.position.set(0, 0.03, -0.02);
    headGroup.add(topHair);

    const lockGeo = new THREE.SphereGeometry(0.095, 10, 10);
    const lockPositions = [
      [0.21, 0.08, 0.06],
      [-0.21, 0.08, 0.06],
      [0.24, -0.02, -0.02],
      [-0.24, -0.02, -0.02],
      [0.21, -0.12, -0.08],
      [-0.21, -0.12, -0.08],
      [0.12, -0.08, -0.19],
      [-0.12, -0.08, -0.19],
      [0, 0.04, -0.22],
    ];
    for (const [lx, ly, lz] of lockPositions) {
      const lk = new THREE.Mesh(lockGeo, hairMat);
      lk.scale.set(0.9, 1.35, 1.05);
      lk.position.set(lx, ly, lz);
      headGroup.add(lk);
    }
  } else if (persona === 'blacksmith_tuner') {
    // Soot Headscarf + Brass Steampunk Goggles on Forehead + Thick Braided Beard!
    const wrap = new THREE.Mesh(
      new THREE.SphereGeometry(0.244, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.8 })
    );
    headGroup.add(wrap);

    // Goggles on forehead
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    });
    for (const sx of [-0.075, 0.075]) {
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 14), goldMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(sx, 0.125, 0.215);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.044, 12), lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.copy(rim.position);
      headGroup.add(rim, lens);
    }

    // Thick Blacksmith Beard
    const beardMain = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), hairMat);
    beardMain.scale.set(1.15, 1.25, 0.85);
    beardMain.position.set(0, -0.15, 0.15);
    headGroup.add(beardMain);
  } else if (persona === 'challenger') {
    // Ronin Woven Straw Hat (編笠 Kasa) + Fluttering Scarf!
    const kasaMat = new THREE.MeshStandardMaterial({ color: 0xd4a359, roughness: 0.82 });
    const kasa = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.22, 24), kasaMat);
    kasa.position.set(0, 0.19, 0.02);
    kasa.rotation.x = 0.12;
    kasa.castShadow = true;
    headGroup.add(kasa);
    addFlutteringHeadband(-0.18);
  } else {
    // Samurai Hair Cap + Front Bangs + Persona Variations (Player, 2P, Sensei, Taiko Chef, Paganini)!
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.242, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat
    );
    hairCap.rotation.x = -0.22;
    headGroup.add(hairCap);

    // Sculpted samurai bangs framing forehead
    const bangGeo = new THREE.ConeGeometry(0.042, 0.11, 5);
    for (const bx of [-0.11, 0.11]) {
      const bang = new THREE.Mesh(bangGeo, hairMat);
      bang.rotation.x = Math.PI * 0.92;
      bang.rotation.z = bx > 0 ? -0.22 : 0.22;
      bang.position.set(bx, 0.11, 0.205);
      headGroup.add(bang);
    }

    if (persona === 'paganini_ronin') {
      // Long Flowing Silky Ponytail!
      swayingTail = new THREE.Group();
      swayingTail.position.set(0, 0.08, -0.22);
      const pony = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.48, 10), hairMat);
      pony.rotation.x = Math.PI * 0.88;
      pony.position.set(0, -0.2, -0.08);
      swayingTail.add(pony);
      headGroup.add(swayingTail);
      addFlutteringHeadband(0.075);
    } else if (persona === 'taiko_chef') {
      // Twisted White Festival Hachimaki with Front V-Knot!
      const twistBand = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.032, 10, 28), whiteMat);
      twistBand.rotation.x = Math.PI / 2;
      twistBand.position.y = 0.085;
      headGroup.add(twistBand);

      const knotFront = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), whiteMat);
      knotFront.position.set(0, 0.095, 0.235);
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 6), whiteMat);
      hornL.position.set(0.045, 0.14, 0.235);
      hornL.rotation.z = -0.55;
      const hornR = hornL.clone();
      hornR.position.x = -0.045;
      hornR.rotation.z = 0.55;
      headGroup.add(knotFront, hornL, hornR);
    } else {
      // Classic Samurai Topknot (髷 Chonmage) + Fluttering Hachimaki!
      const bunStem = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.1, 10), hairMat);
      bunStem.position.set(0, 0.24, -0.08);
      const bunTop = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.11, 6, 10), hairMat);
      bunTop.rotation.x = Math.PI / 2.2;
      bunTop.position.set(0, 0.275, -0.03);
      headGroup.add(bunStem, bunTop);

      if (persona === 'metronome_sensei') {
        // Dignified Sensei Mustache & Goatee!
        const goatee = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 8), hairMat);
        goatee.rotation.x = Math.PI;
        goatee.position.set(0, -0.18, 0.19);
        headGroup.add(goatee);
      }

      addFlutteringHeadband(0.075);
    }
  }

  // =========================================================================
  // 6. STUN & SWEAT FX: Sculpted Teardrops + Spinning Golden Dizzy Stars!
  // =========================================================================
  const sweatGroup = new THREE.Group();
  sweatGroup.position.set(0, 1.92, 0);
  sweatGroup.visible = false;
  const sweatMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd });
  const starMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const drop = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.09, 8), sweatMat);
    drop.position.set(Math.cos(ang) * 0.27, (i % 2) * 0.05, Math.sin(ang) * 0.27);
    sweatGroup.add(drop);

    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), starMat);
    const sAng = ang + Math.PI / 3;
    star.position.set(Math.cos(sAng) * 0.25, 0.04, Math.sin(sAng) * 0.25);
    sweatGroup.add(star);
  }
  bodyGroup.add(sweatGroup);

  // =========================================================================
  // 7. LIVE ANIMATION CONTROLLER: Stride, Breathing, Expressions, Cloth Sway!
  // =========================================================================
  const animState = {
    stridePhase: Math.random() * Math.PI * 2,
    blinkTimer: 1.5 + Math.random() * 2.5,
    blinkProgress: 0,
  };

  function animateDetails({ dt, time, speed = 0, state = 'idle', stateProgress = 0 }) {
    // 1. Footwork & Leg Stride!
    if (state === 'ko') {
      legL.rotation.x = -0.55;
      legR.rotation.x = -0.35;
    } else if (state === 'slash') {
      // Deep kendo fumikomi lunge!
      legL.rotation.x = -0.52;
      legR.rotation.x = 0.48;
    } else if (state === 'windup') {
      legL.rotation.x = 0.22 * stateProgress;
      legR.rotation.x = -0.22 * stateProgress;
    } else if (state === 'block') {
      // Braced wide stance
      legL.rotation.x = -0.26;
      legR.rotation.x = 0.26;
    } else if (speed > 0.12) {
      animState.stridePhase += dt * (5.5 + speed * 3.2);
      const swing = Math.sin(animState.stridePhase) * Math.min(0.55, 0.16 + speed * 0.14);
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
    } else {
      legL.rotation.x *= 0.85;
      legR.rotation.x *= 0.85;
    }

    // 2. Subtle Chest Breathing & Torso Twist during Slashes!
    const breath = 1 + Math.sin(time * 3.2) * 0.018;
    torsoGroup.scale.set(breath, 1, breath);

    if (state === 'windup') {
      torsoGroup.rotation.y = -0.22 * stateProgress;
      headGroup.rotation.y = 0.16 * stateProgress;
    } else if (state === 'slash') {
      torsoGroup.rotation.y = -0.22 + 0.52 * stateProgress;
      headGroup.rotation.y = -0.15 * stateProgress;
    } else {
      torsoGroup.rotation.y *= 0.85;
      headGroup.rotation.y *= 0.85;
    }

    // 3. Natural Eyelid Blinking & Dynamic Facial Expressions!
    animState.blinkTimer -= dt;
    if (animState.blinkTimer <= 0) {
      animState.blinkProgress = 0.14;
      animState.blinkTimer = 2.4 + Math.random() * 2.8;
    }
    if (animState.blinkProgress > 0) {
      animState.blinkProgress = Math.max(0, animState.blinkProgress - dt);
    }
    const isBlinking = animState.blinkProgress > 0;

    if (state === 'ko') {
      eyeL.koGroup.visible = true;
      eyeR.koGroup.visible = true;
      eyeL.iris.visible = false;
      eyeR.iris.visible = false;
      eyelidSet(0.01);
      browL.rotation.z = 0.35;
      browR.rotation.z = -0.35;
      mouthIdle.visible = false;
      mouthShout.visible = true;
      mouthShout.scale.set(0.75, 0.85, 1);
    } else {
      eyeL.koGroup.visible = false;
      eyeR.koGroup.visible = false;
      eyeL.iris.visible = true;
      eyeR.iris.visible = true;

      if (state === 'windup' || state === 'slash') {
        // Fierce battle shout!
        eyelidSet(isBoss ? 0.35 : 0.18);
        browL.rotation.z = -0.38;
        browR.rotation.z = 0.38;
        mouthIdle.visible = false;
        mouthShout.visible = true;
        mouthShout.scale.set(1.05, 1.1, 1);
      } else if (state === 'stun') {
        // Shocked / dizzy!
        eyelidSet(0.01);
        browL.rotation.z = 0.36;
        browR.rotation.z = -0.36;
        mouthIdle.visible = false;
        mouthShout.visible = true;
        mouthShout.scale.set(0.68, 0.9, 1);
      } else if (state === 'block') {
        // Tense guard squint!
        eyelidSet(isBlinking ? 1.0 : 0.42);
        browL.rotation.z = -0.32;
        browR.rotation.z = 0.32;
        mouthIdle.visible = true;
        mouthShout.visible = false;
      } else {
        // Calm focused kendo stance
        eyelidSet(isBlinking ? 1.0 : isBoss ? 0.42 : 0.02);
        browL.rotation.z = -0.14;
        browR.rotation.z = 0.14;
        mouthIdle.visible = true;
        mouthShout.visible = false;
      }
    }

    function eyelidSet(val) {
      eyeL.eyelid.scale.y = val;
      eyeL.eyelid.position.y = 0.045 * (1 - val * 0.95);
      eyeR.eyelid.scale.y = val;
      eyeR.eyelid.position.y = 0.045 * (1 - val * 0.95);
    }

    // 4. Secondary Motion: Headband Ribbons, Ponytail, Buddha Halo & Lotus!
    const windAmp = 0.12 + Math.min(0.45, speed * 0.12);
    for (const rt of ribbonTails) {
      rt.pivot.rotation.x = 0.25 + speed * 0.18 + Math.sin(time * 8.5 + rt.side) * windAmp;
      rt.pivot.rotation.z = rt.side * (0.15 + Math.cos(time * 6.5) * 0.08);
    }
    if (swayingTail) {
      swayingTail.rotation.x = Math.min(0.55, speed * 0.15) + Math.sin(time * 5.2) * 0.08;
      swayingTail.rotation.z = Math.cos(time * 4.1) * 0.08;
    }
    if (rotatingHalo) {
      rotatingHalo.rotation.z = time * 0.65;
    }
    if (lotusGroup) {
      lotusGroup.rotation.y = time * 0.35;
    }
  }

  return {
    root,
    bodyGroup,
    torsoGroup,
    headGroup,
    armPivot,
    weaponMount,
    sweatGroup,
    legL,
    legR,
    animateDetails,
  };
}
