#!/usr/bin/env python3
"""Rink Rat Mayhem sound pack generator.

Builds every sound effect procedurally (modal synthesis, filtered noise, formant
voices) and runs it through a generated arena reverb, then encodes MP3s into
assets/sfx/. Seeded, so the output is reproducible.

    python3 tools/gen_sfx.py            # needs numpy, scipy and ffmpeg
"""
import os, subprocess, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx')
rng = np.random.default_rng(1977)


# ------------------------------------------------------------------ building blocks
def T(dur):
    return np.arange(int(dur * SR)) / SR

def noise(dur):
    return rng.standard_normal(int(dur * SR))

def sos(kind, f, order=2):
    if kind == 'bp':
        return signal.butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], 'bandpass', output='sos')
    return signal.butter(order, f / (SR / 2), {'lp': 'lowpass', 'hp': 'highpass'}[kind], output='sos')

def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x)

def sweep_bp(x, f0, f1, q=1.2, blocks=64):
    """Band-pass with a centre frequency that glides exponentially from f0 to f1."""
    out = np.zeros_like(x); n = len(x); edges = np.linspace(0, n, blocks + 1).astype(int)
    zi = None
    for i in range(blocks):
        fc = f0 * (f1 / f0) ** (i / max(1, blocks - 1)); bw = fc / q
        s = sos('bp', (max(30, fc - bw / 2), min(SR / 2 - 100, fc + bw / 2)))
        if zi is None: zi = np.zeros((s.shape[0], 2))
        out[edges[i]:edges[i + 1]], zi = signal.sosfilt(s, x[edges[i]:edges[i + 1]], zi=zi)
    return out

def env_exp(dur, tau, attack=0.002):
    t = T(dur); e = np.exp(-t / tau)
    a = int(attack * SR)
    if a > 1: e[:a] *= np.linspace(0, 1, a)
    return e

def env_adsr(dur, a, d, s, r):
    n = int(dur * SR); e = np.zeros(n); A, D, R = int(a * SR), int(d * SR), int(r * SR)
    S = max(0, n - A - D - R)
    e[:A] = np.linspace(0, 1, A, endpoint=False)
    e[A:A + D] = np.linspace(1, s, D, endpoint=False)
    e[A + D:A + D + S] = s
    e[A + D + S:] = np.linspace(s, 0, n - (A + D + S))
    return e

def modal(dur, modes):
    """modes: (freq, decay seconds, amp). Damped sines with random phase."""
    t = T(dur); y = np.zeros_like(t)
    for f, tau, a in modes:
        y += a * np.exp(-t / tau) * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))
    n = min(len(y), int(0.08 * SR)); y[-n:] *= np.linspace(1, 0, n) ** 2      # never cut a ringing mode off hard
    return y

def click(dur=0.006, hp=1500):
    return filt(noise(dur) * env_exp(dur, dur / 4, 0.0003), 'hp', hp)

def pad_to(x, dur):
    n = int(dur * SR)
    return np.pad(x, (0, max(0, n - len(x))))[:n]

def mix(*parts, dur=None):
    n = max(len(p) for p in parts) if dur is None else int(dur * SR)
    out = np.zeros(n)
    for p in parts: out[:min(n, len(p))] += p[:n]
    return out

def at(x, t0, dur):
    """Place x starting at t0 inside a buffer of length dur."""
    out = np.zeros(int(dur * SR)); i = int(t0 * SR); j = min(len(out), i + len(x))
    if i < len(out): out[i:j] += x[:j - i]
    return out

def sat(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)

# arena reverb: decorrelated exponentially decaying noise, darker as it decays
def arena_ir(rt60=1.9, seed=0):
    r = np.random.default_rng(seed); dur = rt60 * 1.1; t = T(dur)
    base = r.standard_normal(len(t)) * np.exp(-6.9 * t / rt60)
    early = np.zeros(len(t))
    for _ in range(14):
        early[int(r.uniform(0.008, 0.07) * SR)] += r.uniform(-0.8, 0.8)
    ir = signal.sosfilt(sos('lp', 6500), base) * 0.6 + signal.sosfilt(sos('lp', 1800), base) * 0.6 + early
    ir[0] = 0
    return ir / np.sqrt(np.sum(ir ** 2))

IR_L, IR_R = arena_ir(seed=1), arena_ir(seed=2)
IR_SHORT = arena_ir(rt60=0.5, seed=3)

def verb(x, wet=0.25, stereo=False, short=False, tail=1.0):
    x = np.pad(x, (0, int(tail * SR)))
    if short:
        w = signal.fftconvolve(x, IR_SHORT)[:len(x)]
        return x * (1 - wet * 0.5) + w * wet
    l = signal.fftconvolve(x, IR_L)[:len(x)]
    if not stereo:
        return x * (1 - wet * 0.5) + l * wet
    r = signal.fftconvolve(x, IR_R)[:len(x)]
    return np.stack([x * (1 - wet * 0.5) + l * wet, x * (1 - wet * 0.5) + r * wet], 1)

def finish(x, peak_db=-1.0, fade=0.03, loop=False):
    x = np.asarray(x, dtype=np.float64)
    if loop:   # loops keep their exact length: no trim, no fade
        x = x - x.mean(axis=0); return x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)
    # trim trailing near-silence
    mono = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    thr = mono.max() * 10 ** (-60 / 20); idx = np.nonzero(mono > thr)[0]
    if len(idx): x = x[:min(len(x), idx[-1] + int(0.02 * SR))]
    n = int(fade * SR)
    if n and len(x) > n:
        ramp = np.linspace(1, 0, n)
        x[-n:] = (x[-n:].T * ramp).T
    # remove DC, normalise
    x = x - x.mean(axis=0)
    return x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)

def write(name, x, br='96k', loop=False):
    os.makedirs(OUT, exist_ok=True)
    x = finish(x, loop=loop)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        wavfile.write(f.name, SR, (x * 32767).astype(np.int16))
        tmp = f.name
    dst = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', br, dst], check=True)
    os.unlink(tmp)
    print(f'{name:12s} {len(x)/SR:5.2f}s  {"stereo" if x.ndim == 2 else "mono"}  {os.path.getsize(dst)//1024} KB')

j = lambda a, b: rng.uniform(a, b)


# ------------------------------------------------------------------ hockey sounds
def stick_tap():
    """Blade on puck: a short composite 'tock' with a little ice."""
    d = 0.16; f = j(0.9, 1.15)
    body = modal(d, [(1150 * f, 0.022, 1.0), (2380 * f, 0.012, 0.55), (3900 * f, 0.007, 0.3), (640 * f, 0.03, 0.35)])
    ice = filt(noise(d) * env_exp(d, 0.018), 'bp', (1800, 7000)) * 0.25
    return verb(mix(click(0.004, 2500) * 0.8, body, ice), wet=0.18, short=True, tail=0.15)

def wrist_shot():
    d = 0.4; f = j(0.92, 1.08)
    sweep = sweep_bp(noise(0.09), 2500, 6500, q=1.5) * env_adsr(0.09, 0.06, 0.02, 0.6, 0.01) * 0.35
    crack = click(0.006, 1200) * 1.6
    body = modal(0.25, [(720 * f, 0.045, 1.0), (1650 * f, 0.03, 0.6), (2950 * f, 0.016, 0.4), (230 * f, 0.05, 0.5)])
    hiss = filt(noise(0.3) * env_exp(0.3, 0.06), 'bp', (3000, 9000)) * 0.12
    x = mix(at(sweep, 0, d), at(crack, 0.085, d), at(body, 0.085, d), at(hiss, 0.09, d))
    return verb(x, wet=0.28, tail=0.9)

def slap_shot():
    d = 0.6; f = j(0.92, 1.06)
    chips = filt(noise(0.06) * env_exp(0.06, 0.02), 'bp', (1500, 6000)) * 0.6          # blade hits the ice first
    crack = click(0.009, 600) * 2.2
    body = modal(0.4, [(560 * f, 0.07, 1.0), (1320 * f, 0.05, 0.75), (2480 * f, 0.03, 0.5), (4100 * f, 0.015, 0.3), (160 * f, 0.08, 0.6)])
    thump = np.sin(2 * np.pi * 95 * T(0.12)) * env_exp(0.12, 0.03) * 0.5
    x = mix(at(chips, 0, d), at(crack, 0.05, d), at(body, 0.05, d), at(thump, 0.05, d))
    return verb(sat(x, 1.3), wet=0.32, tail=1.2)

def boards():
    d = 0.9; f = j(0.85, 1.15)
    thud = filt(noise(0.35) * env_exp(0.35, 0.06), 'lp', 220 * f) * 2.4
    sub = np.sin(2 * np.pi * 80 * f * T(0.3)) * env_exp(0.3, 0.09) * 0.9
    rattle_env = env_exp(0.6, 0.16) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * j(22, 30) * T(0.6))))
    rattle = filt(noise(0.6), 'bp', (500 * f, 1600 * f)) * rattle_env * 0.45
    glass = modal(0.7, [(780 * f, 0.18, 0.25), (1310 * f, 0.12, 0.18), (2170 * f, 0.08, 0.1)])
    return verb(mix(click(0.006, 400) * 0.8, thud, sub, rattle, glass), wet=0.38, tail=1.4)

def post():
    d = 3.2; f0 = j(920, 1080)
    ring = modal(d, [(f0, 1.4, 1.0), (f0 * 2.76, 0.9, 0.55), (f0 * 5.40, 0.5, 0.3), (f0 * 8.93, 0.28, 0.15), (f0 * 13.3, 0.12, 0.08)])
    return verb(mix(click(0.004, 3000) * 1.2, ring * 0.8), wet=0.3, tail=1.4)

def pad_save():
    d = 0.35; f = j(0.88, 1.12)
    thud = filt(noise(d) * env_exp(d, 0.05), 'lp', 520 * f) * 2.2
    body = np.sin(2 * np.pi * 135 * f * T(d)) * env_exp(d, 0.06) * 0.8
    slap = filt(noise(0.03) * env_exp(0.03, 0.006), 'bp', (900, 2600)) * 0.7
    return verb(mix(thud, body, slap), wet=0.25, tail=0.8)

def body_check():
    d = 0.7; f = j(0.85, 1.1)
    t = T(0.4); low = np.sin(2 * np.pi * np.cumsum(90 * f * np.exp(-t / 0.12) + 45) / SR) * env_exp(0.4, 0.11) * 1.4
    crunch = filt(noise(0.25) * env_exp(0.25, 0.05), 'bp', (250, 1100)) * 1.3
    crackle = np.zeros(int(0.25 * SR))
    for _ in range(int(j(8, 16))):
        i = int(j(0, 0.14) * SR); crackle[i:i + 60] += rng.standard_normal(60) * j(0.4, 1.0)
    crackle = filt(crackle, 'hp', 1800) * 0.45
    pads = filt(noise(0.12) * env_exp(0.12, 0.025), 'lp', 900) * 1.2
    x = mix(click(0.008, 300), low, crunch, crackle, pads, at(boards() * 0.35, 0.0, d))
    return verb(sat(x, 1.4), wet=0.3, tail=1.0)

def skate_stride():
    d = 0.24
    s = sweep_bp(noise(d), j(2600, 3400), j(5200, 6800), q=1.6) * env_adsr(d, 0.03, 0.05, 0.55, 0.15)
    return verb(s * 0.9, wet=0.12, short=True, tail=0.1)

def hockey_stop():
    d = 0.6
    grain = 1 + 0.5 * np.sign(np.sin(2 * np.pi * j(70, 95) * T(d))) * rng.uniform(0.3, 1, int(d * SR))
    s = sweep_bp(noise(d) * grain, 5500, 2200, q=0.9) * env_adsr(d, 0.02, 0.1, 0.7, 0.35)
    spray = filt(noise(d) * env_exp(d, 0.18), 'hp', 6000) * 0.25
    return verb(mix(s, spray), wet=0.15, short=True, tail=0.2)

def whistle():
    d = 0.55; t = T(d)
    pea = filt(rng.standard_normal(len(t)), 'lp', 45) * 40                     # the pea rattling in the chamber
    am = 0.65 + 0.35 * np.sin(2 * np.pi * np.cumsum(36 + pea * 0.2) / SR)
    fm = 2950 + 35 * np.sin(2 * np.pi * 34 * t) + pea * 1.5
    tone = np.sin(2 * np.pi * np.cumsum(fm) / SR) * am
    breath = filt(noise(d), 'bp', (2500, 6000)) * 0.08
    e = env_adsr(d, 0.02, 0.05, 0.85, 0.07)
    return verb((tone + 0.12 * np.sin(2 * np.pi * np.cumsum(fm * 2) / SR) + breath) * e, wet=0.3, tail=0.9)

def goal_horn():
    d = 3.0; t = T(d); y = np.zeros_like(t)
    for f0, det in ((130.8, 0.6), (164.8, -0.5), (196.0, 0.4)):
        ph = 2 * np.pi * np.cumsum(f0 + det + 0.8 * np.sin(2 * np.pi * 4.3 * t)) / SR
        for n in range(1, 16):
            y += np.sin(n * ph) / n ** 1.15
    y = filt(sat(y * 0.25, 2.2), 'lp', 2600, 4)
    y *= env_adsr(d, 0.14, 0.2, 0.85, 0.5)
    return verb(y, wet=0.45, stereo=True, tail=2.0)

def buzzer():
    d = 1.4; t = T(d); y = np.zeros_like(t)
    for f0 in (200.0, 203.2):
        for n in range(1, 24, 2):
            y += np.sin(2 * np.pi * f0 * n * t) / n
    y = filt(sat(y * 0.4, 1.8), 'lp', 3500) * env_adsr(d, 0.01, 0.05, 0.9, 0.08)
    return verb(y, wet=0.45, stereo=True, tail=1.8)


# ------------------------------------------------------------------ mayhem sounds
def boom():
    d = 2.6; t = T(d)
    crack = filt(noise(0.03) * env_exp(0.03, 0.008), 'hp', 300) * 2.0
    rumble = filt(noise(d) * env_exp(d, 0.45), 'lp', 160) * 3.2
    sub = np.sin(2 * np.pi * np.cumsum(55 * np.exp(-t / 0.5) + 30) / SR) * env_exp(d, 0.5) * 1.3
    debris = np.zeros(len(t))
    for _ in range(40):
        i = int(j(0.05, 1.2) * SR); n = int(j(40, 300)); debris[i:i + n] += rng.standard_normal(min(n, len(t) - i)) * np.exp(-i / SR / 0.5) * j(0.2, 0.8)
    debris = filt(debris, 'bp', (900, 5000)) * 0.6
    return verb(sat(mix(crack, rumble, sub, debris), 1.6), wet=0.42, stereo=True, tail=1.5)

def splash():
    d = 1.4; t = T(d)
    hit = filt(noise(0.4) * env_exp(0.4, 0.09, 0.004), 'bp', (700, 5200)) * 1.4
    body = filt(noise(0.6) * env_exp(0.6, 0.18), 'lp', 900) * 0.8
    bubbles = np.zeros(len(t))
    for _ in range(34):
        t0 = j(0.04, 1.0); f = j(380, 1500); bd = j(0.02, 0.06); bt = T(bd)
        b = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.9 * bt / bd)) / SR) * np.exp(-bt / (bd / 3)) * j(0.15, 0.5) * np.exp(-t0 / 0.6)
        bubbles += at(b, t0, d)
    return verb(mix(hit, body, bubbles), wet=0.28, tail=0.8)

def fire():
    d = 1.3; t = T(d)
    whoosh = sweep_bp(noise(d), 260, 2600, q=0.8) * env_adsr(d, 0.12, 0.3, 0.55, 0.6) * 1.6
    roar = filt(noise(d), 'lp', 300) * env_adsr(d, 0.08, 0.3, 0.6, 0.6) * 1.2
    crack = np.zeros(len(t))
    for _ in range(45):
        i = int(j(0.05, 1.15) * SR); crack[i:i + 25] += rng.standard_normal(min(25, len(t) - i)) * j(0.3, 1.0)
    crack = filt(crack, 'hp', 2200) * 0.5
    return verb(mix(whoosh, roar, crack), wet=0.25, tail=0.8)

def zap():
    d = 0.55; t = T(d)
    car = signal.sawtooth(2 * np.pi * np.cumsum(120 + 80 * rng.standard_normal(len(t)).clip(-2, 2)) / SR)
    buzz = filt(car, 'bp', (900, 4500)) * env_exp(d, 0.14, 0.003)
    arc = np.zeros(len(t))
    for _ in range(30):
        i = int(j(0, 0.35) * SR); arc[i:i + 30] += rng.standard_normal(min(30, len(t) - i))
    arc = filt(arc, 'hp', 3000) * env_exp(d, 0.2) * 0.6
    sw = np.sin(2 * np.pi * np.cumsum(np.geomspace(2400, 300, len(t))) / SR) * env_exp(d, 0.12) * 0.25
    return verb(mix(buzz, arc, sw), wet=0.25, tail=0.6)

def thunder():
    d = 3.2; t = T(d)
    crack = filt(noise(0.08) * env_exp(0.08, 0.02, 0.001), 'hp', 1200) * 2.4
    roll_am = 0.4 + 0.6 * np.abs(filt(rng.standard_normal(len(t)), 'lp', 5)) * 6
    roll = filt(noise(d), 'lp', 380) * env_exp(d, 0.9, 0.05) * roll_am * 2.2
    sub = filt(noise(d), 'lp', 70) * env_exp(d, 1.0, 0.1) * 3
    return verb(sat(mix(crack, roll, sub), 1.3), wet=0.5, stereo=True, tail=1.5)

def freeze():
    d = 1.6; t = T(d)
    y = np.zeros(len(t))
    for _ in range(26):
        t0 = j(0, 0.7); f = j(2200, 6400); y += at(modal(0.5, [(f, 0.12, 1), (f * 2.01, 0.06, 0.4)]) * j(0.2, 0.6), t0, d)
    shimmer = sweep_bp(noise(d), 9000, 2500, q=3) * env_adsr(d, 0.05, 0.3, 0.4, 1.0) * 0.6
    crunch = filt(noise(0.2) * env_exp(0.2, 0.05), 'bp', (1500, 5000)) * 0.8
    return verb(mix(crunch, y, shimmer), wet=0.45, stereo=True, tail=1.4)

def grow():
    d = 1.7; t = T(d)
    f0 = 62 + 48 * (1 - np.exp(-t / 0.4)) + 6 * filt(rng.standard_normal(len(t)), 'lp', 12) * 8
    src = signal.sawtooth(2 * np.pi * np.cumsum(f0) / SR) * (0.7 + 0.3 * np.sin(2 * np.pi * 28 * t))
    voc = filt(src, 'bp', (380, 700)) * 1.4 + filt(src, 'bp', (950, 1500)) * 0.8 + filt(src, 'lp', 250)
    rumble = filt(noise(d), 'lp', 120) * 1.5
    y = sat((voc + rumble) * env_adsr(d, 0.12, 0.3, 0.8, 0.5), 2.0)
    return verb(y, wet=0.35, stereo=True, tail=1.2)

def rocket():
    d = 1.5; t = T(d)
    pop_ = filt(noise(0.05) * env_exp(0.05, 0.012), 'lp', 2500) * 1.6
    roar = filt(noise(d), 'lp', 1400) * env_adsr(d, 0.06, 0.2, 0.75, 0.6) * 1.6
    hiss = sweep_bp(noise(d), 2000, 7000, q=0.9) * env_adsr(d, 0.15, 0.3, 0.5, 0.6) * 0.8
    rum = np.sin(2 * np.pi * 58 * t) * env_adsr(d, 0.05, 0.3, 0.6, 0.6) * 0.6
    return verb(sat(mix(pop_, roar, hiss, rum), 1.4), wet=0.25, tail=0.8)

def saw():
    d = 0.8; t = T(d)
    f = 310 + 60 * np.sin(2 * np.pi * 3 * t)
    blade = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 42 * t))
    grind = filt(noise(d), 'bp', (2500, 8000)) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 42 * t))) * 0.6
    y = filt(blade, 'bp', (300, 4000)) + grind
    return verb(y * env_adsr(d, 0.02, 0.1, 0.8, 0.3), wet=0.25, tail=0.6)


# ------------------------------------------------------------------ game / UI
def bell(f, d=0.7, amp=1.0):
    return modal(d, [(f, 0.28, 1.0 * amp), (f * 2.0, 0.16, 0.45 * amp), (f * 3.01, 0.09, 0.25 * amp), (f * 4.2, 0.05, 0.12 * amp)])

def pickup():
    d = 0.9
    x = mix(*[at(bell(f, 0.6), i * 0.06, d) for i, f in enumerate((1047, 1319, 1568, 2093))])
    return verb(x, wet=0.3, stereo=True, tail=0.8)

def ko():
    d = 1.1; t = T(d)
    bonk = modal(0.3, [(420, 0.07, 1.0), (1130, 0.04, 0.6), (2050, 0.02, 0.3)])
    slide = np.sin(2 * np.pi * np.cumsum(np.geomspace(1500, 260, int(0.7 * SR)) * (1 + 0.03 * np.sin(2 * np.pi * 9 * T(0.7)))) / SR) * env_adsr(0.7, 0.02, 0.1, 0.7, 0.2) * 0.35
    return verb(mix(click(0.005, 600), bonk, at(slide, 0.08, d)), wet=0.3, tail=0.8)

def brass(f, d, amp=1.0):
    t = T(d); ph = 2 * np.pi * np.cumsum(f * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t))) / SR
    y = sum(np.sin(n * ph) / n ** 1.3 for n in range(1, 12))
    bright = env_adsr(d, 0.04, 0.08, 0.7, 0.1)
    return filt(y, 'lp', 2400) * bright * amp

def level():
    d = 1.6
    notes = [(523.3, 0.0, 0.16), (659.3, 0.12, 0.16), (784.0, 0.24, 0.16), (1046.5, 0.36, 0.7)]
    x = mix(*[at(brass(f, dd), t0, d) for f, t0, dd in notes], at(brass(659.3, 0.7, 0.6), 0.36, d), at(brass(784.0, 0.7, 0.6), 0.36, d))
    return verb(x, wet=0.35, stereo=True, tail=1.0)


# ------------------------------------------------------------------ crowd (stereo)
VOWELS = [(730, 1090), (530, 1840), (270, 2290), (570, 840), (300, 870), (660, 1720), (490, 1350)]

def voice(dur, f0=None, vowel=None, syl=None):
    t = T(dur)
    f0 = f0 or j(95, 240); F1, F2 = vowel or VOWELS[rng.integers(len(VOWELS))]
    src = signal.sawtooth(2 * np.pi * np.cumsum(f0 * (1 + 0.04 * filt(rng.standard_normal(len(t)), 'lp', 3) * 10)) / SR)
    src = src * 0.6 + rng.standard_normal(len(t)) * 0.4
    v = filt(src, 'bp', (F1 * 0.8, F1 * 1.25)) + 0.6 * filt(src, 'bp', (F2 * 0.85, F2 * 1.18))
    syl = syl or j(2.5, 5.5)
    am = np.clip(np.sin(2 * np.pi * syl * t + j(0, 6.28)) + j(-0.2, 0.5), 0, None)
    return v * am

def crowd_bed(dur, voices=70, gain=1.0):
    L = np.zeros(int(dur * SR)); R = np.zeros_like(L)
    for _ in range(voices):
        vd = j(0.6, 2.2); t0 = j(-0.5, dur); v = voice(vd) * env_adsr(vd, 0.15, 0.1, 0.8, 0.35) * j(0.05, 0.25)
        pan = j(0, 1); L += at(v, max(0, t0), dur) * np.cos(pan * np.pi / 2); R += at(v, max(0, t0), dur) * np.sin(pan * np.pi / 2)
    bed = filt(noise(dur), 'bp', (200, 2200)) * 0.12
    bed2 = filt(noise(dur), 'bp', (200, 2200)) * 0.12
    return np.stack([L + bed, R + bed2], 1) * gain

def crowd_loop():
    dur, xf = 10.0, 1.5
    raw = crowd_bed(dur + xf, voices=110)
    n, m = int(dur * SR), int(xf * SR)
    loop = raw[:n].copy(); fade = np.linspace(0, 1, m)[:, None]
    loop[:m] = raw[:m] * fade + raw[n:n + m] * (1 - fade)       # seamless loop point
    wet = np.stack([signal.fftconvolve(loop[:, 0], IR_L)[:n], signal.fftconvolve(loop[:, 1], IR_R)[:n]], 1)
    return loop * 0.6 + wet * 0.5

def cheer():
    d = 5.0; bed = crowd_bed(d, voices=180, gain=1.6)
    t = T(d); swell = env_adsr(d, 0.25, 0.6, 0.75, 2.6)
    roar = np.stack([filt(noise(d), 'bp', (300, 3000)), filt(noise(d), 'bp', (300, 3000))], 1) * 0.5
    claps = np.zeros((len(t), 2))
    for _ in range(260):
        i = int(j(0.3, 4.2) * SR); n = 220; c = filt(rng.standard_normal(n), 'bp', (800, 3500)) * np.exp(-np.arange(n) / 40) * j(0.2, 0.6); p = j(0, 1)
        claps[i:i + n, 0] += c * np.cos(p * np.pi / 2); claps[i:i + n, 1] += c * np.sin(p * np.pi / 2)
    whistles = np.zeros(len(t))
    for _ in range(5):
        wd = j(0.4, 0.9); f = j(1800, 2900); wt = T(wd)
        whistles += at(np.sin(2 * np.pi * np.cumsum(f * (1 + 0.06 * np.sin(2 * np.pi * 2 * wt))) / SR) * env_adsr(wd, 0.05, 0.1, 0.8, 0.2) * 0.12, j(0.3, 2.5), d)
    x = (bed + roar + claps + whistles[:, None]) * swell[:, None]
    return np.stack([verb(x[:, 0], 0.4, tail=1.0), verb(x[:, 1], 0.4, tail=1.0)], 1)

def aww():
    d = 3.0; t = T(d)
    L = np.zeros(len(t)); R = np.zeros(len(t))
    for _ in range(90):
        f0 = j(100, 220); vd = j(1.4, 2.4)
        v = voice(vd, f0=f0, vowel=(570, 840), syl=0.4) * env_adsr(vd, 0.25, 0.3, 0.7, 0.8) * j(0.06, 0.2)
        vt = T(vd); v = v * (1 - 0.25 * vt / vd)
        p = j(0, 1); t0 = j(0, 0.4)
        L += at(v, t0, d) * np.cos(p * np.pi / 2); R += at(v, t0, d) * np.sin(p * np.pi / 2)
    x = np.stack([L, R], 1)
    return np.stack([verb(x[:, 0], 0.45, tail=1.0), verb(x[:, 1], 0.45, tail=1.0)], 1)



# ------------------------------------------------------------------ arena organ (the only music in the game)
# A drawbar organ (16' 8' 5 1/3' 4' footages, percussion, key click) through a rotary speaker and a big arena,
# playing original stadium-organ cues. Scores are lists of (beat, length in beats, midi notes).
ORNG = np.random.default_rng(1966)
DRAW = [(0.5, 0.75), (1.0, 1.0), (1.5, 0.75), (2.0, 0.85), (3.0, 0.35), (4.0, 0.3), (6.0, 0.12), (8.0, 0.12)]
mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def organ_voice(f, dur):
    t = T(dur + 0.04); y = np.zeros_like(t)
    for ratio, amp in DRAW:
        fr = f * ratio
        if fr < SR / 2 - 500: y += amp * np.sin(2 * np.pi * fr * t + ORNG.uniform(0, 6.28))
    perc = np.sin(2 * np.pi * f * 3 * t) * np.exp(-t / 0.18) * 0.55          # third-harmonic percussion
    n = len(t); e = np.ones(n); a = int(0.004 * SR); r = int(0.035 * SR)
    e[:a] = np.linspace(0, 1, a); e[-r:] = np.linspace(1, 0, r)
    clk = np.zeros(n); clk[:220] = ORNG.standard_normal(220) * np.exp(-np.arange(220) / 30) * 0.25   # key click
    return (y + perc) * e + filt(clk, 'hp', 1500)

def organ_render(score, bpm, total_beats, tail=2.4, wet=0.5):
    spb = 60 / bpm; dur = total_beats * spb + 0.3
    x = np.zeros(int(dur * SR))
    for beat, length, notes in score:
        for m in (notes if isinstance(notes, (list, tuple)) else [notes]):
            v = organ_voice(mtof(m), length * spb * 0.92)
            i = int(beat * spb * SR); j = min(len(x), i + len(v)); x[i:j] += v[:j - i] * 0.16
    # rotary speaker: horn and drum spin at slightly different speeds, opposite phase left/right
    t = np.arange(len(x)) / SR
    l = x * (1 + 0.22 * np.sin(2 * np.pi * 6.6 * t)) ; r = x * (1 + 0.22 * np.sin(2 * np.pi * 6.6 * t + np.pi))
    def dop(sig, ph):
        d = (0.00045 * (1 + np.sin(2 * np.pi * 6.1 * t + ph))) * SR
        idx = np.clip(np.arange(len(sig)) - d, 0, len(sig) - 1); i0 = idx.astype(int); fr = idx - i0
        return sig[i0] * (1 - fr) + sig[np.minimum(i0 + 1, len(sig) - 1)] * fr
    l, r = dop(l, 0), dop(r, np.pi)
    l, r = sat(filt(l, 'lp', 6500), 1.6), sat(filt(r, 'lp', 6500), 1.6)
    out = np.stack([verb(l, wet, tail=tail), verb(r, wet, tail=tail)], 1)
    return out

def chord(root, kind='maj', inv=0):
    iv = {'maj':[0,4,7], 'min':[0,3,7], 'dom7':[0,4,7,10], 'sus':[0,5,7], 'dim':[0,3,6]}[kind]
    n = [root + i for i in iv]
    for _ in range(inv): n = n[1:] + [n[0] + 12]
    return n

def org_intro():      # period start: a rising call and a big held chord (original)
    sc = [(0, .5, 72), (.5, .5, 76), (1, .5, 79), (1.5, .5, 81), (2, .5, 79), (2.5, .5, 76), (3, .5, 72), (3.5, .5, 74),
          (4, 2.5, chord(64, 'maj') + [76]), (4, 2.5, [48, 55]),
          (6.75, .25, chord(65)), (7, 3, chord(67, 'maj') + [79]), (7, 3, [43, 55])]
    return organ_render(sc, 140, 10)

def org_rally():      # chromatic build then the two-and-three clap rhythm
    sc = [(i * .5, .45, 60 + i) for i in range(8)]
    for k, b in enumerate([4, 5, 6, 6.5, 7, 8, 9, 10, 10.5, 11]):
        sc.append((b, .4, chord(67, 'dom7') if k < 5 else chord(72)))
    sc += [(4, 4, [43]), (8, 4, [48])]
    return organ_render(sc, 150, 12.5)

def org_goal():       # celebration: walking boogie bass, bright stabs, a run to the top
    sc = []
    prog = [(48, 'maj'), (53, 'maj'), (48, 'maj'), (55, 'dom7')]
    for bar, (root, kind) in enumerate(prog):
        for q, step in enumerate([0, 4, 7, 9, 10, 9, 7, 4]):
            sc.append((bar * 4 + q * .5, .45, root - 12 + step))
        for q in (0.5, 1.5, 2.5, 3.5): sc.append((bar * 4 + q, .3, chord(root + 12, kind)))
    sc += [(16 + i * .25, .24, 72 + s) for i, s in enumerate([0, 2, 4, 5, 7, 9, 11, 12])]
    sc += [(18, 3, chord(72) + [84]), (18, 3, [36, 48])]
    return organ_render(sc, 160, 21.5)

def org_sad():        # the other team scored: a drooping 'wah wah'
    sc = [(0, .9, [70, 58]), (1, .9, [69, 57]), (2, .9, [68, 56]), (3, 3, [67, 55, 63])]
    x = organ_render(sc, 108, 6.2, wet=0.45)
    t = np.arange(len(x)) / SR; return x * (1 + 0.25 * np.sin(2 * np.pi * 5.2 * t))[:, None]

def org_noodle(k):    # stoppage filler (three originals)
    if k == 0:   # oom-pah-pah waltz in F
        mel = [(0, 77), (1, 81), (2, 84), (3, 82), (4, 81), (5, 79), (6, 77), (7, 79), (8, 81)]
        sc = [(b, .9, m) for b, m in mel] + [(9, 2.5, chord(65) + [77])]
        for bar in range(4): sc += [(bar * 3, .9, [41 if bar % 2 == 0 else 48]), (bar * 3 + 1, .8, chord(57, 'maj', 1)), (bar * 3 + 2, .8, chord(57, 'maj', 1))]
        return organ_render(sc, 168, 12)
    if k == 1:   # walk-up and a wink
        sc = [(i * .5, .45, [55 + i, 67 + i]) for i in range(6)] + [(3.5, .4, chord(72)), (4.5, .4, chord(72)), (5, 2, chord(67, 'dom7')), (7, 2, chord(72) + [84])]
        return organ_render(sc, 132, 9)
    mel = [(0, 67), (.5, 69), (1, 71), (1.5, 74), (2, 71), (3, 67), (4, 69), (4.5, 71), (5, 72), (6, 76), (7, 74)]   # ballpark bounce
    sc = [(b, .45, m) for b, m in mel] + [(8, 2.5, chord(67) + [79])] + [(b, .4, [43 if int(b) % 2 == 0 else 50]) for b in range(8)]
    return organ_render(sc, 144, 10.5)

def org_end():        # buzzer flourish and a long final chord
    sc = [(i * .25, .24, 60 + s) for i, s in enumerate([0, 4, 7, 12, 16, 19, 24])] + [(2, 1, chord(65, 'maj')), (3, 4, chord(72) + [84]), (3, 4, [36, 48])]
    return organ_render(sc, 120, 7.2)

def org_loop():       # locker room / intermission: an easy 16-bar organ swing that loops cleanly
    bpm, bars = 112, 16
    prog = [65, 65, 70, 65, 72, 70, 65, 72, 65, 65, 70, 70, 65, 72, 65, 72]
    kinds = ['maj', 'maj', 'maj', 'maj', 'dom7', 'maj', 'maj', 'dom7', 'maj', 'maj', 'maj', 'maj', 'maj', 'dom7', 'maj', 'dom7']
    mel = [77, 81, 84, 81, 82, 79, 77, 76, 77, 81, 84, 86, 84, 82, 81, 79]
    sc = []
    for b in range(bars):
        root, kind, m = prog[b], kinds[b], mel[b]
        sc += [(b * 4, .9, [root - 24]), (b * 4 + 2, .9, [root - 17])]
        sc += [(b * 4 + 1, .45, chord(root - 12, kind)), (b * 4 + 3, .45, chord(root - 12, kind))]
        sc += [(b * 4, 1.4, m), (b * 4 + 1.5, .45, m - 3 if b % 2 else m + 2), (b * 4 + 2, 1.8, m - 5 if b % 4 == 3 else m)]
    x = organ_render(sc, bpm, bars * 4, tail=2.4, wet=0.42)
    n = int(bars * 4 * 60 / bpm * SR)
    loop = x[:n].copy(); tail = x[n:]
    loop[:len(tail)] += tail[:n]                    # wrap the reverb tail onto the start so the loop is seamless
    return loop

ORGAN = {'org_intro': org_intro, 'org_rally': org_rally, 'org_goal': org_goal, 'org_sad': org_sad, 'org_end': org_end,
         'org_noodle_0': lambda: org_noodle(0), 'org_noodle_1': lambda: org_noodle(1), 'org_noodle_2': lambda: org_noodle(2)}


# ------------------------------------------------------------------ ice resurfacer
def zam_engine():     # a lumpy diesel idle; every frequency is a multiple of 1/3 Hz so the 3 s file loops seamlessly
    d = 6.0; t = T(d); y = np.zeros_like(t)               # render two cycles and keep the second, once the filters have settled
    fire = 26.0 + 2/3                                   # firing rate
    for n in range(1, 40):
        amp = 1 / n ** 0.9 * (1.4 if n % 2 == 0 else 1.0)
        y += amp * np.sin(2 * np.pi * fire * n * t + rng.uniform(0, 2 * np.pi))
    lump = 1 + 0.35 * np.sin(2 * np.pi * (fire / 4) * t) + 0.15 * np.sin(2 * np.pi * (fire / 2) * t + 1.1)
    y = filt(sat(y * lump * 0.18, 2.6), 'lp', 900, 3)
    # tappet and exhaust rattle: noise gated by the firing pulses (periodic, so it loops)
    gate = np.clip(np.sin(2 * np.pi * fire * t), 0, 1) ** 6
    n = filt(noise(d), 'bp', (1400, 4200)) * gate * 0.22
    y = y + n + 0.08 * filt(noise(d), 'lp', 140)
    return y[int(3.0 * SR):]

def zam_horn():       # a tinny two-tone truck honk: beep beep
    d = 0.95; t = T(d); y = np.zeros_like(t)
    for t0, dur in ((0.0, 0.28), (0.38, 0.42)):
        seg = (t >= t0) & (t < t0 + dur); tt = t[seg] - t0
        tone = np.zeros_like(tt)
        for f0 in (392.0, 494.0):
            for n in range(1, 14):
                tone += np.sin(2 * np.pi * f0 * n * tt) / n
        e = np.minimum(1, tt / 0.012) * np.minimum(1, (dur - tt) / 0.03)
        y[seg] += sat(tone * 0.3, 2.4) * e
    y = filt(filt(y, 'hp', 300), 'lp', 3800, 3)
    return verb(y, wet=0.35, stereo=True, tail=1.2)

# ------------------------------------------------------------------ render the pack
if __name__ == '__main__':
    import sys
    if '--zam' in sys.argv:
        write('zamhorn_0', zam_horn()); write('zamengine_0', zam_engine(), br='80k', loop=True)
        sys.exit(0)
    if '--organ' in sys.argv:
        for name, fn in ORGAN.items(): write(name, fn(), br='128k')
        write('org_loop', org_loop(), br='112k', loop=True)
        sys.exit(0)
    variants = {
        'stick': (stick_tap, 4), 'shot': (wrist_shot, 3), 'slap': (slap_shot, 3), 'board': (boards, 3),
        'post': (post, 2), 'pad': (pad_save, 3), 'check': (body_check, 3), 'skate': (skate_stride, 4), 'stop': (hockey_stop, 2),
    }
    for name, (fn, n) in variants.items():
        for i in range(n):
            write(f'{name}_{i}', fn())
    singles = {
        'whistle': whistle, 'horn': goal_horn, 'buzzer': buzzer, 'boom': boom, 'splash': splash, 'fire': fire, 'zap': zap,
        'thunder': thunder, 'freeze': freeze, 'grow': grow, 'rocket': rocket, 'saw': saw, 'pickup': pickup, 'ko': ko, 'level': level,
        'cheer': cheer, 'aww': aww,
    }
    for name, fn in singles.items():
        write(f'{name}_0', fn(), br='112k' if name in ('horn', 'cheer') else '96k')
    write('crowd_0', crowd_loop(), br='80k')
    write('zamhorn_0', zam_horn()); write('zamengine_0', zam_engine(), br='80k', loop=True)
    for name, fn in ORGAN.items(): write(name, fn(), br='128k')
    write('org_loop', org_loop(), br='112k', loop=True)
