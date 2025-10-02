import os
import sys
from pathlib import Path
import torch
import torchaudio
from tortoise.api import TextToSpeech

cache_path = 'cache/'
os.makedirs(cache_path, exist_ok=True)

# Variabili configurabili
_script_dir = Path(__file__).resolve().parent
_default_voice_dir = _script_dir / 'voices' / 'sounds'
env_voice_dir = os.environ.get('VOICE_DIR')
if env_voice_dir:
    candidate = Path(os.path.expanduser(env_voice_dir)).expanduser()
    if candidate.is_dir():
        voice_dir = str(candidate)
    else:
        print(f"[WARN] VOICE_DIR '{env_voice_dir}' non trovata, uso default relativa {_default_voice_dir}")
        voice_dir = str(_default_voice_dir)
else:
    voice_dir = str(_default_voice_dir)
use_mps_env = os.environ.get('USE_MPS', '1') == '1'
voice = 'sounds'
preset = os.environ.get('TTS_PRESET', 'ultra_fast')  # più rapido

# Testo input
text = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else 'Ciao, sono Sounds, assistente di Arte Registrazioni'

# Cache filename deterministico
file_name = os.path.join(cache_path, str(hash(text)) + '.wav')

def _play(path: str):
    # Usa afplay su macOS, altrimenti stampa solo
    if sys.platform == 'darwin':
        os.system(f'afplay "{path}"')
    else:
        print('File pronto:', path)

if os.path.exists(file_name):
    print('[CACHE] Parlo dalla cache:', file_name)
    _play(file_name)
    sys.exit(0)

device = 'cpu'
if use_mps_env and torch.backends.mps.is_available():
    device = 'mps'
elif torch.cuda.is_available():
    device = 'cuda'

print(f'[INFO] Genero audio (device={device}) preset={preset}')
tts = TextToSpeech(device=device)

# Prova API con parametro voice (vecchia modalità). Se fallisce, carica campioni.
audio_out = None
try:
    audio_out = tts.tts_with_preset(text, voice=voice, preset=preset)
except Exception as e:
    print('[WARN] voice param fallito o non supportato:', e)
    # Carica campioni come tensori
    samples = []
    vd_expanded = os.path.expanduser(voice_dir)
    if not os.path.isdir(vd_expanded):
        raise SystemExit(f'Cartella voce non trovata: {vd_expanded}')
    wavs = sorted([f for f in os.listdir(vd_expanded) if f.lower().endswith('.wav')])[:3]
    if not wavs:
        raise SystemExit('Nessun wav trovato per voice_samples')
    for w in wavs:
        path = os.path.join(vd_expanded, w)
        try:
            wav_tensor, sr = torchaudio.load(path)
            if wav_tensor.dim() == 2 and wav_tensor.size(0) > 1:
                wav_tensor = wav_tensor.mean(0, keepdim=True)
            if sr != 22050:
                wav_tensor = torchaudio.functional.resample(wav_tensor, sr, 22050)
            samples.append(wav_tensor)
        except Exception as ie:
            print('[WARN] errore caricando sample', w, ie)
    if not samples:
        raise SystemExit('Impossibile preparare voice_samples')
    try:
        # NON togliere la dimensione canale: format_conditioning indicizza clip[:, start:end]
        audio_out = tts.tts_with_preset(text, voice_samples=[s for s in samples], preset=preset)
    except Exception as e2:
        raise SystemExit(f'Generazione fallita (voice_samples): {e2}')

if isinstance(audio_out, list):
    audio_out = audio_out[0]

# audio_out atteso (1, N) oppure (N,). Rende mono
if audio_out.dim() == 2:
    if audio_out.size(0) > 1:
        audio_out = audio_out.mean(0)
    else:
        audio_out = audio_out.squeeze(0)

# Tortoise normalmente a 24000 o 22050 -> salviamo a 44100 per compatibilità
target_sr = 44100
orig_sr = 22050
try:
    audio_out = torchaudio.functional.resample(audio_out.unsqueeze(0), orig_sr, target_sr).squeeze(0)
except Exception:
    target_sr = orig_sr  # fallback

peak = audio_out.abs().max().item()
if peak > 0.99:
    audio_out = audio_out * (0.99 / peak)

torchaudio.save(file_name, audio_out.unsqueeze(0), sample_rate=target_sr, format='wav')
print('[OK] Audio salvato in cache:', file_name)
_play(file_name)
