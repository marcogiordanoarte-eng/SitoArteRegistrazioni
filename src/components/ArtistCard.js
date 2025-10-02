import React, { useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Card, CardContent, Typography, Box, IconButton, Avatar, Grid } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';

export default function ArtistCard({ artist, index, moveArtist, onEdit, onDelete }) {
  const ref = useRef(null);
  const [{ handlerId }, drop] = useDrop({
    accept: "ARTIST",
    collect: monitor => ({ handlerId: monitor.getHandlerId() }),
    hover(item, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      moveArtist(dragIndex, hoverIndex);
      item.index = hoverIndex;
    }
  });
  const [{ isDragging }, drag] = useDrag({
    type: "ARTIST",
    item: { id: artist.id, index },
    collect: monitor => ({ isDragging: monitor.isDragging() })
  });
  drag(drop(ref));

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }} data-handler-id={handlerId}>
      <Card sx={{ maxWidth: 480, margin: "0 auto", mb: 4, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={3}>
            <Avatar alt={artist.name} sx={{ width: 80, height: 80 }} />
          </Grid>
          <Grid item xs={9}>
            <Typography variant="h6" color="primary" gutterBottom>{artist.name}</Typography>
            <Typography variant="subtitle1" gutterBottom>{artist.title}</Typography>
            <Typography variant="body2" color="text.secondary">Genere: {artist.genre}</Typography>
          </Grid>
        </Grid>
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{artist.bio}</Typography>

          {/* Immagini principali artista */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            {artist.imageArtista && <img src={artist.imageArtista} alt="artista" width={100} style={{ borderRadius: 8 }} />}
            {artist.imagePrimaPaginaA && <img src={artist.imagePrimaPaginaA} alt="prima" width={100} style={{ borderRadius: 8 }} />}
            {artist.imageSecondaPaginaA && <img src={artist.imageSecondaPaginaA} alt="seconda" width={100} style={{ borderRadius: 8 }} />}
          </Box>

          {/* Visualizza tutti i brani/cover */}
          {artist.coverartista && artist.coverartista.map((c, idx) => (
            <Box key={idx} sx={{ mb: 3, p: 2, border: '1px solid #eee', borderRadius: 2 }}>
              <Typography variant="subtitle1">Brano #{idx + 1}</Typography>
              {c.fileAudioPlay && (
                <Box sx={{ mb: 2 }}>
                  <audio src={c.fileAudioPlay} controls style={{ width: '100%' }} />
                </Box>
              )}
            </Box>
          ))}

          <Box sx={{ mt: 2, display: "flex", justifyContent: "center", gap: 2 }}>
            <IconButton onClick={onDelete}><DeleteIcon /></IconButton>
          </Box>
        </CardContent>
      </Card>
    </div>
  );
}