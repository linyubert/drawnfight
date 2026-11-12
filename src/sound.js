import { PROMPT_MAP, DRAW_MAX_ROW } from './constants.js';

class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastBrushAt = 0;

    // 3-Track Battle BGM Carousel State
    this.bgmAudio = null;
    this.bgmTrackIndex = 0; // Rotates 0 -> 1 -> 2 -> 0 ... across battles!
    this.bgmActive = false;
    this.bgmFailCount = 0;
  }

  getBattleTracks() {
    if (typeof window !== 'undefined' && Array.isArray(window.BATTLE_BGM_TRACKS) && window.BATTLE_BGM_TRACKS.length > 0) {
      return window.BATTLE_BGM_TRACKS;
    }
    return ['audio/bgm1.mp3', 'audio/bgm2.mp3', 'audio/bgm3.mp3'];
  }

  ensureBgmElement() {
    if (this.bgmAudio || typeof Audio === 'undefined') return this.bgmAudio;
    const audio = new Audio();
    audio.preload = 'auto';

    // When a track finishes while combat is still ongoing, rotate to the next track!
    audio.addEventListener('ended', () => {
      if (!this.bgmActive) return;
      this.playCurrentCarouselTrack(false);
    });

    // Graceful fallback if audio files are not placed in the deployment folder yet
    audio.addEventListener('error', () => {
      if (!this.bgmActive) return;
      const tracks = this.getBattleTracks();
      this.bgmFailCount++;
      if (this.bgmFailCount < tracks.length) {
        this.playCurrentCarouselTrack(false);
      } else {
        this.bgmActive = false;
      }
    });

    this.bgmAudio = audio;
    return audio;
  }

  playCurrentCarouselTrack(resetFailCount = true) {
    const tracks = this.getBattleTracks();
    if (!tracks.length) return;
    const audio = this.ensureBgmElement();
    if (!audio) return;

    if (resetFailCount) this.bgmFailCount = 0;

    const idx = this.bgmTrackIndex % tracks.length;
    // Advance pointer so the next battle (or next track after `ended`) plays the next song in rotation!
    this.bgmTrackIndex = (idx + 1) % tracks.length;

    const vol =
      typeof window !== 'undefined' && typeof window.BATTLE_BGM_VOLUME === 'number'
        ? Math.max(0, Math.min(1, window.BATTLE_BGM_VOLUME))
        : 0.55;

    audio.volume = vol;
    audio.muted = this.muted;
    audio.src = tracks[idx];
    try {
      audio.currentTime = 0;
    } catch (_) {}

    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  }

  /**
   * Called right when 3D Battle starts — plays tracks[0], next battle tracks[1], next tracks[2], then loops!
   */
  startBattleBgm() {
    this.bgmActive = true;
    this.playCurrentCarouselTrack(true);
  }

  /**
   * Stops battle BGM cleanly when battle ends or player exits to redraw
   */
  stopBattleBgm() {
    this.bgmActive = false;
    if (!this.bgmAudio) return;
    try {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
    } catch (_) {}
  }

  ensure() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.bgmAudio) {
      this.bgmAudio.muted = this.muted;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.bgmAudio) {
      this.bgmAudio.muted = this.muted;
    }
    if (!this.muted) this.playClick();
    return this.muted;
  }

  playTone(freq, dur = 0.12, type = 'triangle', vol = 0.14, delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  playClick() {
    this.playTone(660, 0.06, 'triangle', 0.1);
  }

  /**
   * Musical staff brush tick: pitch maps from bottom of staff (C4) to top (A5)
   */
  playBrushRow(row, erasing = false) {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = performance.now();
    if (now - this.lastBrushAt < 48) return;
    this.lastBrushAt = now;

    if (erasing) {
      this.playTone(220, 0.04, 'sine', 0.06);
      return;
    }

    const scale = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.0];
    const norm = Math.max(0, Math.min(1, 1 - row / DRAW_MAX_ROW));
    const idx = Math.min(scale.length - 1, Math.floor(norm * scale.length));
    this.playTone(scale[idx], 0.065, 'triangle', 0.075);
  }

  playQuizPass(promptId) {
    const p = PROMPT_MAP[promptId];
    if (p && p.rhythmNotes) {
      for (const rn of p.rhythmNotes) {
        this.playTone(rn.freq, rn.dur, 'triangle', 0.18, rn.delay);
      }
    }
    // Bright forging fanfare
    this.playTone(523.25, 0.14, 'triangle', 0.14, 0.35);
    this.playTone(659.25, 0.14, 'triangle', 0.14, 0.45);
    this.playTone(783.99, 0.16, 'triangle', 0.15, 0.55);
    this.playTone(1046.5, 0.32, 'triangle', 0.18, 0.66);
  }

  playQuizFail() {
    this.playTone(311.13, 0.12, 'sine', 0.14, 0);
    this.playTone(261.63, 0.2, 'sine', 0.14, 0.13);
  }

  playSwing(speedMult = 1.0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280 * speedMult, t0);
    osc.frequency.exponentialRampToValueAtTime(95, t0 + 0.13);
    gain.gain.setValueAtTime(0.09, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.15);
  }

  playClash(justParry = false) {
    if (justParry) {
      // Resonant golden bell parry!
      this.playTone(1318.5, 0.38, 'sine', 0.22, 0);
      this.playTone(1975.5, 0.32, 'triangle', 0.16, 0.02);
      this.playTone(2637.0, 0.25, 'sine', 0.12, 0.04);
      return;
    }
    this.playTone(920 + Math.random() * 260, 0.09, 'sawtooth', 0.09, 0);
    this.playTone(1480 + Math.random() * 200, 0.12, 'triangle', 0.11, 0.01);
  }

  playHit(heavy = false) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = heavy ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(heavy ? 150 : 210, t0);
    osc.frequency.exponentialRampToValueAtTime(42, t0 + (heavy ? 0.24 : 0.15));
    gain.gain.setValueAtTime(heavy ? 0.25 : 0.18, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + (heavy ? 0.25 : 0.16));
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.26);

    // Musical harmonic ping on hit
    this.playTone(heavy ? 392 : 587.33, 0.11, 'triangle', 0.1, 0.01);
  }

  playGuardBreak() {
    this.playHit(true);
    this.playTone(220, 0.22, 'sawtooth', 0.15, 0.04);
    this.playTone(155.56, 0.28, 'sawtooth', 0.15, 0.1);
  }

  playKO(win = true) {
    this.playHit(true);
    if (win) {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => this.playTone(f, 0.24, 'triangle', 0.17, 0.18 + i * 0.1));
    } else {
      const notes = [392.0, 349.23, 311.13, 261.63];
      notes.forEach((f, i) => this.playTone(f, 0.26, 'sine', 0.15, 0.18 + i * 0.12));
    }
  }
}

export const sound = new SoundManager();
