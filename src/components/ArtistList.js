import React, { useState } from "react";
import { Box } from "@mui/material";
import ArtistCard from "./ArtistCard";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

export default function ArtistList({ artists, onEdit, onDelete, onReorder }) {
  const [localArtists, setLocalArtists] = useState(artists);

  const moveArtist = (dragIndex, hoverIndex) => {
    const updated = [...localArtists];
    const [removed] = updated.splice(dragIndex, 1);
    updated.splice(hoverIndex, 0, removed);
    setLocalArtists(updated);
    if (onReorder) onReorder(updated);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {localArtists.map((artist, index) => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            onEdit={() => onEdit(artist)}
            onDelete={() => onDelete(artist)}
            index={index}
            moveArtist={moveArtist}
          />
        ))}
      </Box>
    </DndProvider>
  );
}
