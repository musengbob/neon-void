// NEON VOID — all sound is synthesized with WebAudio: no audio files, no network.
// A tiny synth for effects plus a pulsing bass/arpeggio loop for music.
// Every call is safe before the audio context exists (it starts on first gesture).

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let musicTimer = null;
  let muted = false;
  let step = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  // The music loop: a 8-step bass pulse with a sparse arpeggio on top.
  const bassLine = [55, 55, 65.41, 49, 55, 55, 73.42, 82.41];
  const arpNotes = [220, 261.63, 329.63, 440, 329.63, 261.63];

  function musicStep() {
    if (!ctx || muted) return;
    const beat = 0.21;
    const t0 = ctx.currentTime;
    const bass = bassLine[step % bassLine.length];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = bass;
    gain.gain.setValueAtTime(0.5, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + beat * 0.9);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + beat);
    if (step % 2 === 0) {
      const note = arpNotes[(step / 2) % arpNotes.length];
      const a = ctx.createOscillator();
      const ag = ctx.createGain();
      a.type = 'triangle';
      a.frequency.value = note * 2;
      ag.gain.setValueAtTime(0.25, t0);
      ag.gain.exponentialRampToValueAtTime(0.001, t0 + beat * 1.6);
      a.connect(ag);
      ag.connect(musicGain);
      a.start(t0);
      a.stop(t0 + beat * 1.7);
    }
    step++;
  }

  return {
    ensure,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(musicStep, 210);
    },
    stopMusic() {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
    },
    shoot() {
      tone(720, 0.09, 'square', 0.12, 180);
    },
    hit() {
      tone(190, 0.06, 'triangle', 0.16, 90);
    },
    explode() {
      noise(0.35, 0.5, 900);
      tone(120, 0.3, 'sine', 0.3, 40);
    },
    hurt() {
      tone(110, 0.25, 'sawtooth', 0.3, 55);
      noise(0.15, 0.25, 500);
    },
    pickup() {
      tone(880, 0.08, 'sine', 0.18, 1320);
    },
    heal() {
      tone(523, 0.12, 'sine', 0.2, 784);
      tone(784, 0.14, 'sine', 0.16, 1046, 0.08);
    },
    upgrade() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.18, null, i * 0.07));
    },
    waveClear() {
      [392, 523, 659].forEach((f, i) => tone(f, 0.2, 'triangle', 0.16, null, i * 0.09));
    },
    bossAlarm() {
      tone(220, 0.4, 'sawtooth', 0.2, 110);
      tone(220, 0.4, 'sawtooth', 0.2, 110, 0.45);
    },
    gameOver() {
      [392, 311, 233, 175].forEach((f, i) => tone(f, 0.35, 'triangle', 0.2, null, i * 0.22));
    },
    victory() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, null, i * 0.12));
    },
    dash() {
      noise(0.12, 0.2, 2400);
    },
    click() {
      tone(660, 0.05, 'square', 0.1, 440);
    },
  };
}
