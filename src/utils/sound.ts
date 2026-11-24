import type { BgmPace, BgmScene, SkillId } from '../types/chess';

class PixelSoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private bgmScene: BgmScene = 'lobby';
  private lobbyBgmEnabled = true;
  private lobbyBgmPace: BgmPace = 'normal';
  private bgmEnabled = true;
  private bgmTurnPaused = false;
  private bgmPace: BgmPace = 'normal';
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmStep = 0;
  private bgmNextNoteTime = 0;
  private bgmFilter: BiquadFilterNode | null = null;
  private bgmMasterGain: GainNode | null = null;

  private ensureContext(allowWhenMuted = false): AudioContext | null {
    if ((!allowWhenMuted && this.muted) || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getContext(): AudioContext | null {
    return this.ensureContext(false);
  }

  private getActivePace(): BgmPace {
    return this.bgmScene === 'lobby' ? this.lobbyBgmPace : this.bgmPace;
  }

  private isSceneBgmActive(): boolean {
    if (this.muted) return false;
    if (this.bgmScene === 'lobby') {
      return this.lobbyBgmEnabled;
    }
    return this.bgmEnabled && !this.bgmTurnPaused;
  }

  private getBgmDestination(): AudioNode | null {
    const ctx = this.ensureContext(false);
    if (!ctx) return null;
    const activePace = this.getActivePace();
    const cutoff =
      this.bgmScene === 'lobby'
        ? activePace === 'slow'
          ? 1120
          : 1750
        : activePace === 'slow'
        ? 960
        : 1550;
    if (!this.bgmFilter) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      filter.Q.value = 0.7;

      const master = ctx.createGain();
      master.gain.value = 1;
      filter.connect(master);
      master.connect(ctx.destination);

      this.bgmFilter = filter;
      this.bgmMasterGain = master;
    } else {
      this.bgmFilter.frequency.value = cutoff;
    }
    return this.bgmFilter;
  }

  private syncBgmPlayback() {
    if (this.isSceneBgmActive()) {
      this.startBgmLoop();
    } else {
      this.stopBgmLoop();
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    this.syncBgmPlayback();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setBgmScene(scene: BgmScene) {
    if (this.bgmScene === scene) return;
    this.bgmScene = scene;
    this.bgmStep = 0;
    if (this.bgmTimer) {
      this.stopBgmLoop();
    }
    this.syncBgmPlayback();
  }

  public getBgmScene(): BgmScene {
    return this.bgmScene;
  }

  public setLobbyBgmEnabled(enabled: boolean) {
    this.lobbyBgmEnabled = enabled;
    if (this.bgmScene === 'lobby') {
      this.syncBgmPlayback();
    }
  }

  public isLobbyBgmEnabled(): boolean {
    return this.lobbyBgmEnabled;
  }

  public setLobbyBgmPace(pace: BgmPace) {
    if (this.lobbyBgmPace === pace) return;
    this.lobbyBgmPace = pace;
    if (this.bgmScene === 'lobby' && this.bgmTimer) {
      this.stopBgmLoop();
      this.syncBgmPlayback();
    }
  }

  public getLobbyBgmPace(): BgmPace {
    return this.lobbyBgmPace;
  }

  public setBgmEnabled(enabled: boolean) {
    this.bgmEnabled = enabled;
    if (this.bgmScene === 'game') {
      this.syncBgmPlayback();
    }
  }

  public isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  public setBgmTurnPaused(paused: boolean) {
    if (this.bgmTurnPaused === paused) return;
    this.bgmTurnPaused = paused;
    if (this.bgmScene === 'game') {
      this.syncBgmPlayback();
    }
  }

  public setBgmPace(pace: BgmPace) {
    if (this.bgmPace === pace) return;
    this.bgmPace = pace;
    if (this.bgmScene === 'game' && this.bgmTimer) {
      this.stopBgmLoop();
      this.syncBgmPlayback();
    }
  }

  public getBgmPace(): BgmPace {
    return this.bgmPace;
  }

  public isAudioRunning(): boolean {
    return Boolean(this.ctx && this.ctx.state === 'running');
  }

  public unlockAndStartBgm(): boolean {
    const ctx = this.ensureContext(true);
    if (this.isSceneBgmActive()) {
      this.startBgmLoop();
    }
    return Boolean(ctx && ctx.state === 'running');
  }

  private playBgmNoteAt(
    startTime: number,
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number
  ) {
    const ctx = this.getContext();
    const dest = this.getBgmDestination();
    if (!ctx || !dest || freq <= 0) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0008, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private startBgmLoop() {
    if (
      this.bgmTimer ||
      !this.isSceneBgmActive() ||
      typeof window === 'undefined'
    ) {
      return;
    }

    const ctx = this.ensureContext(false);
    if (ctx && this.bgmMasterGain) {
      try {
        this.bgmMasterGain.gain.cancelScheduledValues(ctx.currentTime);
        this.bgmMasterGain.gain.setValueAtTime(1, ctx.currentTime);
      } catch {
        // ignore
      }
    }

    const scene = this.bgmScene;
    const isSlow = this.getActivePace() === 'slow';

    if (scene === 'lobby') {
      // 64-step warm, nostalgic C-major / A-minor pixel tavern & waiting room theme
      const lobbyMelody: number[] = [
        523.25, 0, 659.25, 0, 783.99, 0, 659.25, 587.33,
        523.25, 0, 440.0, 0, 392.0, 0, 0, 0,
        349.23, 0, 440.0, 0, 523.25, 0, 587.33, 523.25,
        493.88, 0, 440.0, 0, 392.0, 0, 0, 0,
        523.25, 0, 659.25, 783.99, 880.0, 0, 783.99, 659.25,
        587.33, 0, 523.25, 0, 440.0, 0, 493.88, 0,
        523.25, 0, 440.0, 392.0, 349.23, 0, 392.0, 440.0,
        392.0, 0, 329.63, 0, 261.63, 0, 0, 0,
      ];
      const lobbyHarmony: number[] = [
        329.63, 0, 392.0, 0, 329.63, 0, 392.0, 0,
        293.66, 0, 349.23, 0, 246.94, 0, 293.66, 0,
        220.0, 0, 261.63, 0, 293.66, 0, 349.23, 0,
        246.94, 0, 293.66, 0, 196.0, 0, 246.94, 0,
        329.63, 0, 392.0, 0, 349.23, 0, 440.0, 0,
        293.66, 0, 349.23, 0, 261.63, 0, 329.63, 0,
        220.0, 0, 261.63, 0, 174.61, 0, 220.0, 0,
        196.0, 0, 246.94, 0, 196.0, 0, 0, 0,
      ];
      const lobbyBass: number[] = [
        130.81, 0, 0, 0, 196.0, 0, 0, 0,
        110.0, 0, 0, 0, 164.81, 0, 0, 0,
        87.31, 0, 0, 0, 130.81, 0, 0, 0,
        98.0, 0, 0, 0, 146.83, 0, 98.0, 0,
        130.81, 0, 0, 0, 174.61, 0, 0, 0,
        146.83, 0, 0, 0, 110.0, 0, 0, 0,
        87.31, 0, 0, 0, 110.0, 0, 0, 0,
        98.0, 0, 123.47, 0, 130.81, 0, 0, 0,
      ];

      const stepSec = isSlow ? 0.56 : 0.255;
      const melDur = isSlow ? 0.42 : 0.23;
      const harmDur = isSlow ? 0.36 : 0.19;
      const bassDur = isSlow ? 0.52 : 0.32;

      this.bgmNextNoteTime = ctx ? ctx.currentTime + 0.04 : 0;

      const scheduleLobbyAhead = () => {
        if (!this.isSceneBgmActive() || this.bgmScene !== 'lobby') return;
        const audioCtx = this.ctx;
        if (!audioCtx || audioCtx.state !== 'running') return;

        if (this.bgmNextNoteTime < audioCtx.currentTime - 0.1) {
          this.bgmNextNoteTime = audioCtx.currentTime + 0.02;
        }

        while (this.bgmNextNoteTime < audioCtx.currentTime + 0.18) {
          const step = this.bgmStep % lobbyMelody.length;
          const mFreq = lobbyMelody[step];
          const hFreq = lobbyHarmony[step];
          const bFreq = lobbyBass[step];
          if (mFreq > 0) {
            this.playBgmNoteAt(
              this.bgmNextNoteTime,
              mFreq,
              melDur,
              'triangle',
              isSlow ? 0.022 : 0.026
            );
          }
          if (hFreq > 0) {
            this.playBgmNoteAt(
              this.bgmNextNoteTime,
              hFreq,
              harmDur,
              'sine',
              isSlow ? 0.011 : 0.013
            );
          }
          if (bFreq > 0) {
            this.playBgmNoteAt(
              this.bgmNextNoteTime,
              bFreq,
              bassDur,
              'triangle',
              isSlow ? 0.022 : 0.026
            );
          }
          this.bgmStep = (this.bgmStep + 1) % lobbyMelody.length;
          this.bgmNextNoteTime += stepSec;
        }
      };

      scheduleLobbyAhead();
      this.bgmTimer = setInterval(scheduleLobbyAhead, 60);
      return;
    }

    // 32-step Baroque-inspired D-minor / F-major chiptune battle loop (In-Game)
    const melody: number[] = [
      293.66, 0, 349.23, 440.0, 523.25, 0, 440.0, 392.0,
      349.23, 0, 329.63, 293.66, 329.63, 0, 220.0, 0,
      261.63, 0, 329.63, 392.0, 440.0, 0, 392.0, 349.23,
      329.63, 0, 293.66, 261.63, 293.66, 0, 220.0, 0,
    ];
    const bass: number[] = [
      146.83, 0, 146.83, 0, 174.61, 0, 174.61, 0,
      130.81, 0, 130.81, 0, 110.0, 0, 110.0, 0,
      130.81, 0, 130.81, 0, 174.61, 0, 174.61, 0,
      110.0, 0, 130.81, 0, 146.83, 0, 146.83, 0,
    ];

    const stepSec = isSlow ? 0.76 : 0.265;
    const melDur = isSlow ? 0.38 : 0.21;
    const bassDur = isSlow ? 0.44 : 0.23;

    this.bgmNextNoteTime = ctx ? ctx.currentTime + 0.04 : 0;

    const scheduleAhead = () => {
      if (!this.isSceneBgmActive() || this.bgmScene !== 'game') return;
      const audioCtx = this.ctx;
      if (!audioCtx || audioCtx.state !== 'running') return;

      if (this.bgmNextNoteTime < audioCtx.currentTime - 0.1) {
        this.bgmNextNoteTime = audioCtx.currentTime + 0.02;
      }

      while (this.bgmNextNoteTime < audioCtx.currentTime + 0.18) {
        const step = this.bgmStep % melody.length;
        const mFreq = melody[step];
        const bFreq = bass[step];
        if (mFreq > 0) {
          this.playBgmNoteAt(
            this.bgmNextNoteTime,
            mFreq,
            melDur,
            'square',
            isSlow ? 0.014 : 0.018
          );
        }
        if (bFreq > 0) {
          this.playBgmNoteAt(
            this.bgmNextNoteTime,
            bFreq,
            bassDur,
            'triangle',
            isSlow ? 0.026 : 0.032
          );
        }
        this.bgmStep = (this.bgmStep + 1) % melody.length;
        this.bgmNextNoteTime += stepSec;
      }
    };

    scheduleAhead();
    this.bgmTimer = setInterval(scheduleAhead, 60);
  }

  private stopBgmLoop() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.ctx && this.bgmMasterGain) {
      try {
        const now = this.ctx.currentTime;
        this.bgmMasterGain.gain.cancelScheduledValues(now);
        this.bgmMasterGain.gain.setTargetAtTime(0.0001, now, 0.015);
      } catch {
        // ignore
      }
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    volume = 0.08,
    delay = 0,
    slideToFreq?: number
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, now + duration);
    }

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  public playSelect() {
    this.playTone(520, 0.045, 'square', 0.045, 0, 660);
  }

  public playMove() {
    this.playTone(260, 0.06, 'triangle', 0.1, 0, 180);
    this.playTone(440, 0.035, 'square', 0.03, 0.015);
  }

  public playCapture() {
    this.playTone(220, 0.09, 'sawtooth', 0.09, 0, 90);
    this.playTone(580, 0.05, 'square', 0.06, 0.02, 310);
  }

  public playCastle() {
    this.playTone(280, 0.055, 'triangle', 0.09, 0, 210);
    this.playTone(350, 0.065, 'triangle', 0.09, 0.08, 260);
  }

  public playCheck() {
    this.playTone(660, 0.08, 'square', 0.07, 0);
    this.playTone(880, 0.12, 'square', 0.07, 0.085);
  }

  public playTrashGainMana() {
    this.playTone(659.25, 0.06, 'square', 0.06, 0);
    this.playTone(987.77, 0.11, 'square', 0.065, 0.06);
  }

  public playDrawCard() {
    this.playTone(392, 0.045, 'triangle', 0.07, 0, 523.25);
    this.playTone(659.25, 0.07, 'square', 0.055, 0.045, 783.99);
  }

  public playManaGain() {
    this.playTone(587.33, 0.055, 'triangle', 0.06, 0);
    this.playTone(880, 0.1, 'sine', 0.065, 0.055, 1046.5);
  }

  public playAugmentSelect() {
    this.playTone(440, 0.06, 'triangle', 0.07, 0);
    this.playTone(554.37, 0.06, 'triangle', 0.07, 0.06);
    this.playTone(880, 0.12, 'square', 0.06, 0.12);
  }

  public playAugmentTrigger() {
    this.playTone(587.33, 0.05, 'triangle', 0.055, 0);
    this.playTone(783.99, 0.06, 'triangle', 0.055, 0.05);
    this.playTone(1046.5, 0.1, 'sine', 0.06, 0.1);
  }

  public playSkillCast(skillId: SkillId) {
    switch (skillId) {
      case 'freeze':
        this.playTone(1100, 0.07, 'triangle', 0.07, 0, 740);
        this.playTone(1480, 0.12, 'sine', 0.07, 0.06, 980);
        break;
      case 'smoke':
        this.playTone(190, 0.14, 'sawtooth', 0.065, 0, 65);
        this.playTone(120, 0.16, 'triangle', 0.06, 0.04, 55);
        break;
      case 'shield':
      case 'purify':
        this.playTone(440, 0.07, 'square', 0.06, 0);
        this.playTone(660, 0.07, 'square', 0.06, 0.055);
        this.playTone(880, 0.12, 'triangle', 0.08, 0.11);
        break;
      case 'diagonal_rook':
      case 'snipe':
        this.playTone(960, 0.09, 'sawtooth', 0.075, 0, 240);
        this.playTone(1240, 0.06, 'square', 0.055, 0.03, 380);
        break;
      case 'revive':
      case 'pawn_guard':
        this.playTone(392, 0.07, 'square', 0.05, 0);
        this.playTone(523.25, 0.07, 'square', 0.05, 0.07);
        this.playTone(659.25, 0.07, 'square', 0.055, 0.14);
        this.playTone(783.99, 0.14, 'square', 0.065, 0.21);
        break;
      case 'swap':
      case 'bishop_shift':
      case 'royal_escape':
        this.playTone(360, 0.06, 'square', 0.06, 0, 720);
        this.playTone(720, 0.08, 'square', 0.06, 0.07, 360);
        break;
      case 'disarm':
        this.playTone(580, 0.07, 'sawtooth', 0.06, 0, 210);
        this.playTone(300, 0.08, 'triangle', 0.06, 0.05, 160);
        break;
      case 'phantom_step':
      case 'camel_jump':
      case 'alfil_leap':
      case 'center_drop':
        this.playTone(480, 0.07, 'sine', 0.07, 0, 960);
        this.playTone(760, 0.1, 'triangle', 0.06, 0.05, 520);
        break;
      case 'tactical_jam':
        this.playTone(180, 0.08, 'sawtooth', 0.06, 0, 110);
        this.playTone(260, 0.12, 'square', 0.05, 0.06, 95);
        break;
      case 'great_attack':
      case 'straight_bishop':
      case 'vanguard_lance':
        this.playTone(440, 0.06, 'square', 0.06, 0, 880);
        this.playTone(660, 0.09, 'sawtooth', 0.055, 0.05, 990);
        break;
      case 'trojan_horse':
      case 'royal_dash':
        this.playTone(293.66, 0.07, 'square', 0.06, 0);
        this.playTone(392.0, 0.07, 'square', 0.06, 0.06);
        this.playTone(587.33, 0.12, 'triangle', 0.075, 0.12);
        break;
      case 'queens_gambit':
        this.playTone(330, 0.07, 'square', 0.06, 0);
        this.playTone(554.37, 0.07, 'square', 0.06, 0.06);
        this.playTone(880, 0.13, 'square', 0.07, 0.12);
        break;
      case 'pawn_surge':
        this.playTone(440, 0.05, 'triangle', 0.07, 0, 587.33);
        this.playTone(587.33, 0.07, 'square', 0.05, 0.05, 783.99);
        break;
      case 'mana_drain':
      case 'arcane_tome':
        this.playTone(784, 0.08, 'sine', 0.065, 0, 392);
        this.playTone(523.25, 0.11, 'triangle', 0.07, 0.07, 987.77);
        break;
      case 'shadow_bind':
        this.playTone(220, 0.09, 'sawtooth', 0.065, 0, 130);
        this.playTone(165, 0.12, 'square', 0.055, 0.06, 110);
        break;
      case 'knight_sweep':
        this.playTone(349.23, 0.05, 'sawtooth', 0.07, 0, 698.46);
        this.playTone(880, 0.08, 'square', 0.06, 0.045, 440);
        break;
      case 'field_promotion':
        this.playTone(440, 0.06, 'square', 0.055, 0);
        this.playTone(659.25, 0.06, 'square', 0.055, 0.06);
        this.playTone(880, 0.07, 'square', 0.06, 0.12);
        this.playTone(1174.66, 0.14, 'triangle', 0.07, 0.18);
        break;
      default:
        this.playTone(420, 0.06, 'square', 0.06, 0, 620);
        this.playTone(680, 0.09, 'triangle', 0.07, 0.055, 880);
        break;
    }
  }

  public playGameStart() {
    this.playTone(392, 0.07, 'square', 0.05, 0);
    this.playTone(523.25, 0.07, 'square', 0.05, 0.075);
    this.playTone(659.25, 0.11, 'square', 0.06, 0.15);
  }

  public playGameOver(isWin: boolean) {
    if (isWin) {
      this.playTone(523.25, 0.08, 'square', 0.06, 0);
      this.playTone(659.25, 0.08, 'square', 0.06, 0.09);
      this.playTone(783.99, 0.08, 'square', 0.06, 0.18);
      this.playTone(1046.5, 0.18, 'square', 0.07, 0.27);
    } else {
      this.playTone(392, 0.1, 'sawtooth', 0.055, 0);
      this.playTone(349.23, 0.1, 'sawtooth', 0.055, 0.11);
      this.playTone(293.66, 0.2, 'sawtooth', 0.06, 0.22);
    }
  }
}

export const soundEngine = new PixelSoundEngine();
