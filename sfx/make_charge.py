# Builds the war cry heard when the battle starts (rules.charge): a commander's "CHARGE!", his army shouting it back,
# then a roar. The voices are Piper text-to-speech (en_US-ryan-high), made rougher, deeper and layered into a crowd here.
# Run once by hand (needs numpy, scipy and the voice takes t1..t6.wav made with piper); the videos only read the wavs.
import sys, numpy as np, scipy.io.wavfile as wf, scipy.signal as ss
SR = 48000
src = sys.argv[1] if len(sys.argv) > 1 else '.'
def load(n):
    sr, x = wf.read(f'{src}/{n}.wav'); x = x.astype(np.float32) / 32768.0
    if x.ndim > 1: x = x.mean(1)
    return sr, x
def pitched(n, p):
    sr, x = load(n)
    out = ss.resample_poly(x, SR, sr)                       # to 48 kHz
    m = len(out); idx = np.arange(0, m - 1, p)                # p < 1 = deeper and slower
    return np.interp(idx, np.arange(m), out).astype(np.float32)
def lowpass(x, hz): b, a = ss.butter(2, hz / (SR / 2)); return ss.lfilter(b, a, x).astype(np.float32)
def band(x, lo, hi): b, a = ss.butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band'); return ss.lfilter(b, a, x).astype(np.float32)
def put(L, R, x, t, g, pan):
    s = int(t * SR); n = min(len(x), len(L) - s)
    if n <= 0: return
    a = (pan + 1) * np.pi / 4; L[s:s + n] += x[:n] * g * np.cos(a); R[s:s + n] += x[:n] * g * np.sin(a)
def make(lead, lp, seed, out):
    rng = np.random.default_rng(seed); dur = 3.4; L = np.zeros(int(SR * dur), np.float32); R = np.zeros_like(L)
    # the commander: deeper, driven hard (a shout, not a reading), a little chest boost
    v = pitched(lead, lp); v = v / (np.abs(v).max() + 1e-9)
    v = np.tanh(v * 3.2) / np.tanh(3.2); v = v + 0.35 * lowpass(v, 260)
    put(L, R, v, 0.0, 0.95, 0.0)
    # his army shouts it back: eight voices, each a little higher or lower, later and further away
    for k in range(8):
        p = lp * (0.84 + 0.26 * rng.random()); e = pitched(lead, p); e = e / (np.abs(e).max() + 1e-9)
        e = lowpass(np.tanh(e * 2.5), 2600 + 1800 * rng.random())
        put(L, R, e, 0.10 + 0.22 * rng.random(), 0.30, rng.uniform(-0.85, 0.85))
    # then the roar: many soldiers yelling, rising and fading
    for k in range(12):
        n = ['t4', 't5', 't6'][k % 3]; e = pitched(n, 0.72 + 0.4 * rng.random()); e = e / (np.abs(e).max() + 1e-9)
        e = lowpass(np.tanh(e * 2.2), 1800 + 1500 * rng.random())
        put(L, R, e, 0.55 + 0.45 * rng.random(), 0.22, rng.uniform(-1, 1))
    # the crowd under it: band noise swelling and dying away
    t = np.arange(len(L)) / SR; env = np.clip((t - 0.5) / 0.35, 0, 1) * np.exp(-np.clip(t - 0.9, 0, None) / 0.8)
    for ch, s in ((L, 1), (R, 2)):
        nz = band(np.random.default_rng(seed + s).standard_normal(len(L)).astype(np.float32), 280, 1400)
        ch += nz * env * 0.09
    # a hall: decaying noise impulse, different on each side
    n_ir = int(SR * 1.7); ti = np.arange(n_ir) / SR
    for ch, s in ((L, 3), (R, 4)):
        ir = np.random.default_rng(seed + s).standard_normal(n_ir).astype(np.float32) * np.exp(-ti / 0.42)
        ir = lowpass(ir, 5000); ir /= np.sqrt((ir ** 2).sum())
        wet = ss.fftconvolve(ch, ir)[:len(ch)].astype(np.float32); ch += wet * 0.38
    st = np.stack([L, R], 1); st *= 0.92 / (np.abs(st).max() + 1e-9)
    fade = np.clip((dur - t) / 0.4, 0, 1)[:, None]; st *= fade
    wf.write(out, SR, (st * 32767).astype(np.int16))
for i, (lead, lp) in enumerate([('t1', 0.86), ('t2', 0.82), ('t3', 0.9)]):
    make(lead, lp, 101 + i, f'charge-{i + 1}.wav')
print('ok')
