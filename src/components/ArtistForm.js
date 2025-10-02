import React, { useState } from "react";
import { Box, TextField, Button, Typography, IconButton, Divider } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

export default function ArtistForm({ onSave, initialData }) {
  const [name, setName] = useState(initialData?.name || "");

  // Funzione handleSubmit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) {
      onSave({
        name,
        bio,
        imageArtista,
        imagePrimaPaginaA,
        imageSecondaPaginaA,
        paypalLink,
        stripeLink,
        cover,
      });
    }
  };
  const [bio, setBio] = useState(initialData?.bio || "");
  // Immagini principali artista
  const [imageArtista, setImageArtista] = useState(initialData?.imageArtista || "");
  const [imageArtistaFile, setImageArtistaFile] = useState(null);
  const [imagePrimaPaginaA, setImagePrimaPaginaA] = useState(initialData?.imagePrimaPaginaA || "");
  const [imagePrimaPaginaAFile, setImagePrimaPaginaAFile] = useState(null);
  const [imageSecondaPaginaA, setImageSecondaPaginaA] = useState(initialData?.imageSecondaPaginaA || "");
  const [imageSecondaPaginaAFile, setImageSecondaPaginaAFile] = useState(null);
  const [paypalLink, setPaypalLink] = useState(initialData?.paypalLink || "");
  const [stripeLink, setStripeLink] = useState(initialData?.stripeLink || "");
  // Cover: solo dati brani
  const [cover, setCover] = useState(initialData?.cover || []);
  // ...existing code...
  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
  <Typography variant="h6" mb={2}>Dati artista</Typography>
  <TextField label="Nome artista" fullWidth required value={name} onChange={e => setName(e.target.value)} sx={{ mb: 2 }} />
  <TextField label="Biografia" fullWidth required multiline rows={3} value={bio} onChange={e => setBio(e.target.value)} sx={{ mb: 2 }} />

      <Divider sx={{ my: 2 }} />
      <Typography variant="h6" mb={2}>Immagini artista</Typography>
      {/* Immagine Artista */}
      {imageArtista && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <img src={imageArtista} alt="artista" width={80} />
          <IconButton onClick={() => setImageArtista("")}> <DeleteIcon /> </IconButton>
        </Box>
      )}
      <Button variant="outlined" component="label" sx={{ mb: 2 }}>
        Carica immagine Artista
        <input type="file" hidden accept="image/*" onChange={e => setImageArtistaFile(e.target.files[0])} />
      </Button>
      {imageArtistaFile && <Typography variant="body2">File selezionato: {imageArtistaFile.name}</Typography>}

      {/* Immagine PrimaPaginaA */}
      {imagePrimaPaginaA && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <img src={imagePrimaPaginaA} alt="prima" width={80} />
          <IconButton onClick={() => setImagePrimaPaginaA("")}> <DeleteIcon /> </IconButton>
        </Box>
      )}
      <Button variant="outlined" component="label" sx={{ mb: 2 }}>
        Carica immagine PrimaPaginaA
        <input type="file" hidden accept="image/*" onChange={e => setImagePrimaPaginaAFile(e.target.files[0])} />
      </Button>
      {imagePrimaPaginaAFile && <Typography variant="body2">File selezionato: {imagePrimaPaginaAFile.name}</Typography>}

      {/* Immagine SecondaPaginaA */}
      {imageSecondaPaginaA && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <img src={imageSecondaPaginaA} alt="seconda" width={80} />
          <IconButton onClick={() => setImageSecondaPaginaA("")}> <DeleteIcon /> </IconButton>
        </Box>
      )}
      <Button variant="outlined" component="label" sx={{ mb: 2 }}>
        Carica immagine SecondaPaginaA
        <input type="file" hidden accept="image/*" onChange={e => setImageSecondaPaginaAFile(e.target.files[0])} />
      </Button>
      {imageSecondaPaginaAFile && <Typography variant="body2">File selezionato: {imageSecondaPaginaAFile.name}</Typography>}

      <Divider sx={{ my: 2 }} />
      <Typography variant="h6" mb={2}>Brani e cover</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
  <img src="/spotify1.png" alt="Spotify" style={{ width: 32, height: 32 }} />
  <img src="/apple3.png" alt="Apple Music" style={{ width: 32, height: 32 }} />
  <img src="/youtube2.png" alt="YouTube Music" style={{ width: 32, height: 32 }} />
  <img src="/paypal.png" alt="PayPal" style={{ width: 32, height: 32 }} />
  <img src="/stripe.png" alt="Stripe" style={{ width: 32, height: 32 }} />
      </Box>
      {cover.map((c, idx) => (
        <Box key={idx} sx={{ mb: 3, p: 2, border: '1px solid #eee', borderRadius: 2 }}>
          <Typography variant="subtitle1">Brano #{idx + 1}</Typography>
          <TextField label="Titolo" fullWidth required value={c.titolo || ""} onChange={e => {
            const updated = [...cover];
            updated[idx].titolo = e.target.value;
            setCover(updated);
          }} sx={{ mb: 2 }} />
          <TextField label="Genere" fullWidth required value={c.genere || ""} onChange={e => {
            const updated = [...cover];
            updated[idx].genere = e.target.value;
            setCover(updated);
          }} sx={{ mb: 2 }} />
          <TextField label="Anno" fullWidth value={c.anno || ""} onChange={e => {
            const updated = [...cover];
            updated[idx].anno = e.target.value;
            setCover(updated);
          }} sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
            {/* Pulsante Play: solo se file audio Play */}
            <Button disabled={!c.fileAudioPlay} sx={{ p: 0, minWidth: 0 }} onClick={() => {
              if (c.fileAudioPlay) {
                const audio = new Audio(c.fileAudioPlay);
                try {
                  const p = audio.play();
                  if (p && typeof p.catch === 'function') p.catch(() => {});
                } catch {}
              }
            }}>
              <img src="/play4.png" alt="Play" style={{ width: 28, height: 28, opacity: c.fileAudioPlay ? 1 : 0.5 }} />
            </Button>
            <Button variant="outlined" component="label" sx={{ mb: 2 }}>
              Carica audio Play
              <input type="file" hidden accept="audio/*" onChange={e => {
                const updated = [...cover];
                updated[idx].playAudioFile = e.target.files[0];
                setCover(updated);
              }} />
            </Button>
            {c.playAudioFile && <Typography variant="body2">File selezionato: {c.playAudioFile.name}</Typography>}

            {/* Pulsante Apple: solo se link Apple Music */}
            <Button disabled={!c.linkAppleMusic} sx={{ p: 0, minWidth: 0 }} onClick={() => {
              if (c.linkAppleMusic) window.open(c.linkAppleMusic, '_blank');
            }}>
              <img src="/apple3.png" alt="Apple Music" style={{ width: 28, height: 28, opacity: c.linkAppleMusic ? 1 : 0.5 }} />
            </Button>
            <TextField label="Link Apple Music" fullWidth value={c.linkAppleMusic || ""} onChange={e => {
              const updated = [...cover];
              updated[idx].linkAppleMusic = e.target.value;
              setCover(updated);
            }} sx={{ mb: 2 }} />

            {/* Pulsante Spotify: solo se link Spotify */}
            <Button disabled={!c.linkSpotify} sx={{ p: 0, minWidth: 0 }} onClick={() => {
              if (c.linkSpotify) window.open(c.linkSpotify, '_blank');
            }}>
              <img src="/spotify1.png" alt="Spotify" style={{ width: 28, height: 28, opacity: c.linkSpotify ? 1 : 0.5 }} />
            </Button>
            <TextField label="Link Spotify" fullWidth required value={c.linkSpotify || ""} onChange={e => {
              const updated = [...cover];
              updated[idx].linkSpotify = e.target.value;
              setCover(updated);
            }} sx={{ mb: 2 }} />

            {/* Pulsante YouTube: solo se link YouTube */}
            <Button disabled={!c.linkYouTube} sx={{ p: 0, minWidth: 0 }} onClick={() => {
              if (c.linkYouTube) window.open(c.linkYouTube, '_blank');
            }}>
              <img src="/youtube2.png" alt="YouTube Music" style={{ width: 28, height: 28, opacity: c.linkYouTube ? 1 : 0.5 }} />
            </Button>
            <TextField label="Link YouTube Music" fullWidth required value={c.linkYouTube || ""} onChange={e => {
              const updated = [...cover];
              updated[idx].linkYouTube = e.target.value;
              setCover(updated);
            }} sx={{ mb: 2 }} />

            {/* Pulsante Download: solo se file audio Download */}
            <Button disabled={!c.fileAudioDownload} sx={{ p: 0, minWidth: 0 }} onClick={() => {
              if (c.fileAudioDownload) window.open(c.fileAudioDownload, '_blank');
            }}>
              <img src="/download5.png" alt="Download" style={{ width: 28, height: 28, opacity: c.fileAudioDownload ? 1 : 0.5 }} />
            </Button>
            <Button variant="outlined" component="label" sx={{ mb: 2 }}>
              Carica audio Download
              <input type="file" hidden accept="audio/*" onChange={e => {
                const updated = [...cover];
                updated[idx].downloadAudioFile = e.target.files[0];
                setCover(updated);
              }} />
            </Button>
            {c.downloadAudioFile && <Typography variant="body2">File selezionato: {c.downloadAudioFile.name}</Typography>}

            {/* Pulsante PayPal: solo se link PayPal */}
            <Button disabled={!c.linkPaypal} sx={{ p: 0, minWidth: 0 }} onClick={() => {
              if (c.linkPaypal) window.open(c.linkPaypal, '_blank');
            }}>
              <img src="/paypal.png" alt="PayPal" style={{ width: 28, height: 28, opacity: c.linkPaypal ? 1 : 0.5 }} />
            </Button>
            <TextField label="Link PayPal" fullWidth value={c.linkPaypal || ""} onChange={e => {
              const updated = [...cover];
              updated[idx].linkPaypal = e.target.value;
              setCover(updated);
            }} sx={{ mb: 2 }} />

            {/* Pulsante Stripe: solo se link Stripe */}
            <Button disabled={!c.linkStripe} sx={{ p: 0, minWidth: 0 }} onClick={() => {
              if (c.linkStripe) window.open(c.linkStripe, '_blank');
            }}>
              <img src="/stripe.png" alt="Stripe" style={{ width: 28, height: 28, opacity: c.linkStripe ? 1 : 0.5 }} />
            </Button>
            <TextField label="Link Stripe" fullWidth value={c.linkStripe || ""} onChange={e => {
              const updated = [...cover];
              updated[idx].linkStripe = e.target.value;
              setCover(updated);
            }} sx={{ mb: 2 }} />

            {/* Prezzo */}
            <TextField label="Prezzo (€)" fullWidth required value={c.prezzo || ""} onChange={e => {
              const updated = [...cover];
              updated[idx].prezzo = e.target.value;
              setCover(updated);
            }} sx={{ mb: 2 }} />
          </Box>
          <Button color="error" variant="outlined" startIcon={<DeleteIcon />} sx={{ mt: 1 }} onClick={() => {
            setCover(cover.filter((_, i) => i !== idx));
          }}>Rimuovi brano</Button>
        </Box>
      ))}
      <Button variant="contained" startIcon={<AddIcon />} sx={{ mb: 2 }} onClick={() => setCover([...cover, {}])}>Aggiungi brano</Button>

      <Divider sx={{ my: 2 }} />
      {/* Link PayPal */}
      <TextField label="Link pagamento PayPal (sandbox)" fullWidth required value={paypalLink} onChange={e => setPaypalLink(e.target.value)} sx={{ mb: 2 }} />
      {/* Link Stripe */}
      <TextField label="Link pagamento Stripe (test)" fullWidth required value={stripeLink} onChange={e => setStripeLink(e.target.value)} sx={{ mb: 2 }} />

      <Button type="submit" variant="contained">Salva</Button>
    </Box>
  );
}
