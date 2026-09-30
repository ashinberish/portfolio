// All sounds are synthesised with the Web Audio API — no audio files.
// Browsers only allow audio after a user gesture, so it starts muted.

function noiseBuffer(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function loopNoise(ctx, buffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start();
  return src;
}

export function createAudio() {
  let ctx = null;
  let master;
  let engineOsc;
  let engineSub;
  let engineFilter;
  let engineBus;
  let gravelBus;
  let riverBus;
  let birdBus;
  let cricketBus;
  let planeBus;
  let planePan;
  let nextBird = 0;
  let nextCricket = 0;
  let enabled = false;

  function build() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const noise = noiseBuffer(ctx);

    // Engine: a soft, warm hum. Pure low tones (no buzzy saw/square edges),
    // heavily muffled, with only a gentle idle pulse.
    engineBus = ctx.createGain();
    engineBus.gain.value = 0.1;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 200;
    engineFilter.Q.value = 0.5;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sine';
    engineOsc.frequency.value = 44;
    engineSub = ctx.createOscillator();
    engineSub.type = 'triangle';
    engineSub.frequency.value = 88;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.45;
    const pulse = ctx.createOscillator();
    pulse.frequency.value = 11;
    const pulseDepth = ctx.createGain();
    pulseDepth.gain.value = 0.02;
    pulse.connect(pulseDepth).connect(engineBus.gain);
    engineOsc.connect(engineFilter);
    engineSub.connect(subGain).connect(engineFilter);
    engineFilter.connect(engineBus).connect(master);
    engineOsc.start();
    engineSub.start();
    pulse.start();

    // Tyres on gravel: a quiet, low rumble rather than a hiss.
    gravelBus = ctx.createGain();
    gravelBus.gain.value = 0.022;
    const gravelFilter = ctx.createBiquadFilter();
    gravelFilter.type = 'lowpass';
    gravelFilter.frequency.value = 520;
    gravelFilter.Q.value = 0.4;
    const crackle = ctx.createOscillator();
    crackle.frequency.value = 5.3;
    const crackleDepth = ctx.createGain();
    crackleDepth.gain.value = 0.006;
    crackle.connect(crackleDepth).connect(gravelBus.gain);
    crackle.start();
    loopNoise(ctx, noise).connect(gravelFilter).connect(gravelBus).connect(master);

    // River off to the right: soft, low rushing water.
    riverBus = ctx.createGain();
    riverBus.gain.value = 0.045;
    const riverFilter = ctx.createBiquadFilter();
    riverFilter.type = 'lowpass';
    riverFilter.frequency.value = 700;
    const riverPan = ctx.createStereoPanner();
    riverPan.pan.value = 0.6;
    const ripple = ctx.createOscillator();
    ripple.frequency.value = 0.4;
    const rippleDepth = ctx.createGain();
    rippleDepth.gain.value = 0.015;
    ripple.connect(rippleDepth).connect(riverBus.gain);
    ripple.start();
    loopNoise(ctx, noise).connect(riverFilter).connect(riverPan).connect(riverBus).connect(master);

    // Distant propeller drone; level and pan follow the nearest plane.
    planeBus = ctx.createGain();
    planeBus.gain.value = 0;
    planePan = ctx.createStereoPanner();
    const planeFilter = ctx.createBiquadFilter();
    planeFilter.type = 'bandpass';
    planeFilter.frequency.value = 520;
    planeFilter.Q.value = 0.9;
    const planeTone = ctx.createGain();
    planeTone.gain.value = 1;
    for (const f of [86, 129]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(planeTone);
      o.start();
    }
    const buzz = ctx.createOscillator();
    buzz.frequency.value = 31;
    const buzzDepth = ctx.createGain();
    buzzDepth.gain.value = 0.35;
    buzz.connect(buzzDepth).connect(planeTone.gain);
    buzz.start();
    planeTone.connect(planeFilter).connect(planePan).connect(planeBus).connect(master);

    birdBus = ctx.createGain();
    birdBus.connect(master);
    cricketBus = ctx.createGain();
    cricketBus.connect(master);
  }

  // A short songbird phrase: a few quick whistled sweeps.
  function chirp(at) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(birdBus);
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1600;
    const style = Math.random();
    for (let i = 0; i < notes; i++) {
      const t = at + i * (0.07 + Math.random() * 0.06);
      const len = 0.05 + Math.random() * 0.07;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const from = style < 0.5 ? base : base * 1.4;
      const to = style < 0.5 ? base * (1.3 + Math.random() * 0.4) : base * 0.8;
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + len);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(g).connect(pan);
      osc.start(t);
      osc.stop(t + len + 0.02);
    }
  }

  // Cricket: a burst of tiny high pulses.
  function cricket(at) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 2 - 1;
    pan.connect(cricketBus);
    const freq = 4200 + Math.random() * 600;
    const pulses = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pulses; i++) {
      const t = at + i * 0.045;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.018, t + 0.005);
      g.gain.linearRampToValueAtTime(0, t + 0.025);
      osc.connect(g).connect(pan);
      osc.start(t);
      osc.stop(t + 0.03);
    }
  }

  // Friendly two-tone toy horn: "beep-beep".
  function horn() {
    if (!ctx || !enabled || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.11;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1500;
    tone.Q.value = 2;
    tone.connect(out).connect(master);
    for (const [start, len] of [[0, 0.13], [0.2, 0.22]]) {
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now + start);
      env.gain.linearRampToValueAtTime(1, now + start + 0.015);
      env.gain.setValueAtTime(1, now + start + len - 0.04);
      env.gain.linearRampToValueAtTime(0, now + start + len);
      env.connect(tone);
      // Two notes a third apart, like a real car horn.
      for (const f of [392, 494]) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        o.connect(env);
        o.start(now + start);
        o.stop(now + start + len + 0.02);
      }
    }
  }

  async function setEnabled(on) {
    enabled = on;
    if (on) {
      if (!ctx) build();
      await ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
    } else if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => !enabled && ctx.suspend(), 600);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx || !enabled) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  // Called every frame with how bendy the road is, how dark it is and the nearest plane.
  function update(t, yawRate, nightness, plane = { level: 0, pan: 0 }) {
    if (!ctx || !enabled || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    // Engine works a little harder through bends and wanders naturally.
    const load = Math.min(1, Math.abs(yawRate) * 1.5);
    const rpm = 44 + Math.sin(t * 0.37) * 1.2 + load * 4;
    engineOsc.frequency.setTargetAtTime(rpm, now, 0.4);
    engineSub.frequency.setTargetAtTime(rpm * 2, now, 0.4);
    engineFilter.frequency.setTargetAtTime(190 + load * 60, now, 0.4);

    planeBus.gain.setTargetAtTime(plane.level * 0.09, now, 0.3);
    planePan.pan.setTargetAtTime(plane.pan, now, 0.3);

    birdBus.gain.setTargetAtTime(1 - nightness, now, 0.5);
    cricketBus.gain.setTargetAtTime(nightness, now, 0.5);

    if (now >= nextBird) {
      if (nightness < 0.85) chirp(now + 0.05);
      nextBird = now + 0.6 + Math.random() * 2.8;
    }
    if (now >= nextCricket) {
      if (nightness > 0.15) cricket(now + 0.05);
      nextCricket = now + 0.25 + Math.random() * 0.9;
    }
  }

  return { setEnabled, update, horn, get enabled() { return enabled; } };
}
