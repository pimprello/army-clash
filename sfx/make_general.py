# Builds Army Clash's war general (Rellz, 2026-11-21: "make the voice sound like a war general and have a fade and blend in with
# the music"). The commentator becomes a battle-hardened general barking orders and calling the moments: Piper text-to-speech
# (en_GB-alan-medium, a deep British voice, not the war cry's), spoken a touch slower and lower, with chest, grit and a little
# outdoor slap, so it sounds like a commander shouting across a field. The long hall tail that blends it into the music is added
# at mix time (commentary.js), so it stays dry here. Run once by hand:
#   python3 sfx/make_general.py <folder with en_GB-alan-medium.onnx and .onnx.json>
# (the voice is in https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_GB-alan-medium.tar.bz2)
# Needs numpy, scipy and piper. Writes sfx/general/gen-*.wav; commentary.js (with `lines: 'general'`) reads them.
import os, sys, subprocess, tempfile, numpy as np, scipy.io.wavfile as wf, scipy.signal as ss
SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'general')
VOICE = sys.argv[1] if len(sys.argv) > 1 else '.'
NAME = 'en_GB-alan-medium'
# what the general says, per file id (commentary.js GENERAL knows which moment each one answers)
LINES = {
    'engage': 'Engage! Engage!', 'first-blood': 'First blood! Press the attack!', 'open-fire': 'Open fire!',
    'keep-pressure': 'Keep the pressure on!', 'cut-them-down': 'Cut them down!', 'magnificent': 'Magnificent! Keep going!',
    'titan-fallen': 'Their titan has fallen!', 'beast-down': 'The beast is down! Advance!',
    'direct-hit': 'Direct hit!', 'what-a-blow': 'What a blow!', 'thats-how': "That's how it's done!",
    'hold-the-line': 'Hold the line! Hold!', 'stand-your-ground': 'Stand your ground!', 'make-it-count': 'One soldier left. Make it count!',
    'steady': 'It splits in two! Steady!', 'traitor': 'Traitor in the ranks!', 'turned': "He's turned on us!",
    'gate-broken': 'The gate is broken! Charge!', 'brace': 'Magic on the field! Brace yourselves!', 'unbelievable': 'Unbelievable!',
    'swallowed': 'Swallowed by the void!', 'nothing-left': 'Nothing left of them!',
    'victory': 'Victory is ours!', 'battle-won': 'The battle is won!', 'stand-down': "It's over. Stand down!",
}
def lowpass(x, hz, o=2): b, a = ss.butter(o, hz / (SR / 2)); return ss.lfilter(b, a, x).astype(np.float32)
def highpass(x, hz, o=2): b, a = ss.butter(o, hz / (SR / 2), 'high'); return ss.lfilter(b, a, x).astype(np.float32)
def band(x, lo, hi): b, a = ss.butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band'); return ss.lfilter(b, a, x).astype(np.float32)
def comp(x, thr=0.25, ratio=4.0, att=0.004, rel=0.12):
    # a simple feed-forward compressor, so every word lands with the same weight
    a1, r1 = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR)); env = 0.0; out = np.empty_like(x)
    for i, v in enumerate(np.abs(x)):
        env = a1 * env + (1 - a1) * v if v > env else r1 * env + (1 - r1) * v
        g = 1.0 if env <= thr else (thr + (env - thr) / ratio) / env
        out[i] = x[i] * g
    return out
def say(text, out):
    with tempfile.TemporaryDirectory() as d:
        raw = os.path.join(d, 'v.wav')
        subprocess.run(['piper', '-m', f'{VOICE}/{NAME}.onnx', '-c', f'{VOICE}/{NAME}.onnx.json', '--length-scale', '0.95', '--noise-scale', '0.5', '-f', raw],
                       input=text.encode(), check=True, capture_output=True)
        sr, x = wf.read(raw)
    x = x.astype(np.float32) / 32768.0
    if x.ndim > 1: x = x.mean(1)
    # a touch lower and weightier: 1.6 semitones down (played a little slower, like a man who doesn't hurry)
    x = ss.resample(x, int(len(x) * SR * 2 ** (1.6 / 12) / sr)).astype(np.float32)
    x = highpass(x, 70); x /= np.abs(x).max() + 1e-9
    # chest (150-350 Hz) and bite (1.8-3.5 kHz), grit from a soft drive, the fizz rolled off
    x = x + 0.55 * band(x, 140, 360) + 0.35 * band(x, 1800, 3500)
    x = np.tanh(x * 2.4) / np.tanh(2.4)
    x = lowpass(x, 7000)
    x = comp(x)
    # the open air: a slap off the field (70 ms) and a short room, kept small (the big tail comes at mix time)
    d = int(0.07 * SR); slap = np.zeros_like(x); slap[d:] = lowpass(x[:-d], 2500) * 0.18
    x = x + slap
    on = np.where(np.abs(x) > 0.02 * np.abs(x).max())[0]
    if len(on): x = x[max(0, on[0] - int(0.02 * SR)):on[-1] + int(0.18 * SR)]
    f = int(0.015 * SR); x[:f] *= np.linspace(0, 1, f); g = int(0.12 * SR); x[-g:] *= np.linspace(1, 0, g) ** 1.5
    x *= 0.9 / (np.abs(x).max() + 1e-9)
    wf.write(out, SR, (np.stack([x, x], 1) * 32767).astype(np.int16))
os.makedirs(OUT, exist_ok=True)
for k, text in LINES.items(): say(text, os.path.join(OUT, f'gen-{k}.wav'))
print('ok', len(LINES), 'lines')
