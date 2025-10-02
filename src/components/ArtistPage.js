import React from "react";
import "./Artisti.css";

export default function ArtistPage({
  name,
  bio,
  photo,
  cover,
  title,
  year,
  genre
}) {
  return (
    <div className="container">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ color: "#ffd700", marginBottom: 12 }}>{name}</h1>
        <div className="artist-description" style={{ fontSize: "1.2em", lineHeight: 1.5, marginBottom: 24 }}>{bio}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 32, marginBottom: 32 }}>
        <img src={photo} alt={name} className="artist-photo" style={{ aspectRatio: "1/1", width: 275, height: 275, objectFit: "cover", borderRadius: 16, boxShadow: "0 0 12px #ffd700" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 24 }}>
        <img src={cover} alt="Cover" className="cover-img-lg" style={{ marginBottom: 18 }} />
        <div className="cover-info" style={{ textAlign: "center", fontSize: "1.1em", marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 48 }}>
            <span><strong>Titolo:</strong> {title}</span>
            <span><strong>Anno:</strong> {year}</span>
            <span><strong>Genere:</strong> {genre}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
