import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./Artisti.css";

export default function Artista3() {
  // Tracce demo: aggiungi qui i link audio reali
  const tracks = [
    {
      title: "Respirando un suono",
      genre: "Ambient",
      cover: "/coverArtista3/1.jpg",
      audio: "/audio/beppe1.mp3",
      spotify: "#",
      youtube: "#",
      apple: "#",
      download: "/audio/beppe1.mp3"
    },
    {
      title: "Seventeen",
      genre: "Ambient - Jazz",
      cover: "/coverArtista3/2.jpg",
      audio: "/audio/beppe2.mp3",
      spotify: "#",
      youtube: "#",
      apple: "#",
      download: "/audio/beppe2.mp3"
    }
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [playingIdx, setPlayingIdx] = useState(null);
  const audioRefs = useRef([]);

  const playTrack = idx => {
    // Stop all others
    audioRefs.current.forEach((a, i) => {
      if (a && i !== idx) { a.pause(); a.currentTime = 0; }
    });
    if (audioRefs.current[idx]) {
      audioRefs.current[idx].play();
      setPlayingIdx(idx);
    }
  };
  const pauseTrack = idx => {
    if (audioRefs.current[idx]) {
      audioRefs.current[idx].pause();
      setPlayingIdx(null);
    }
  };
  // On audio end, reset playingIdx
  const handleEnded = idx => setPlayingIdx(null);

  const goPrev = () => setCurrentIdx(i => (i > 0 ? i - 1 : tracks.length - 1));
  const goNext = () => setCurrentIdx(i => (i < tracks.length - 1 ? i + 1 : 0));

  return (
    <div className="container">
      <Link to="/artisti" className="back-link back-link-top">&larr; Torna agli Artisti</Link>
      <div className="artist-header">
        <img src="/fotoartista3/foto1.jpg" alt="Foto artista" className="artist-photo" />
        <div className="artist-info">
          <div className="artist-description">
            <div className="artist-name">BEPPE MARTINI</div>
            <div className="artist-bio">
              Beppe Martini chitarrista muove le sue prime esperienze<br />
              in tour con Giorgio Panariello. Nel 1986 entra a fare parte<br />
              della band di Zucchero Fornaciari e suona nei tour, anche <br />
              nel primo tour europeo. Nel 1989 suona live nel tour oro <br />
              incenso e birra fino alle soglie del 90 poi si dedica alla <br />
              musica ambient e suona nei club. Nel 2024 suona e<br />
              incide per Arte Registrazioni.
            </div>
          </div>
        </div>
      </div>
      <div className="gallery">
        <div className="gallery-row" style={{ display: 'flex', gap: 220, justifyContent: 'center', marginBottom: 48 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            {/* Frecce sopra i pulsanti */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 18 }}>
              <button onClick={goPrev} style={{ background: '#ffd700', color: '#222', borderRadius: 10, padding: '10px 22px', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '1.1em', boxShadow: '0 0 8px #ffd700' }} aria-label="Traccia precedente">◀</button>
              <span style={{ color: '#ffd700', fontWeight: 700, fontSize: '1.1em', minWidth: 220, textAlign: 'center' }}>{tracks[currentIdx].title}</span>
              <button onClick={goNext} style={{ background: '#ffd700', color: '#222', borderRadius: 10, padding: '10px 22px', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '1.1em', boxShadow: '0 0 8px #ffd700' }} aria-label="Traccia successiva">▶</button>
            </div>
            {/* Cover e pulsanti */}
            <div className="cover-box">
              <img src={tracks[currentIdx].cover} alt={`Cover ${currentIdx + 1}`} className="cover-img-lg" />
              <div className="cover-info">
                <strong>Titolo:</strong> {tracks[currentIdx].title}<br />
                <strong>Genere:</strong> {tracks[currentIdx].genre}<br />
                {/* Pulsanti sotto le frecce */}
                <span className="icon-row">
                  <a href={tracks[currentIdx].spotify} title="Spotify"><img src="/loghi/spotify.png" alt="Spotify" className="icon-btn-lg" /></a>
                  <a href={tracks[currentIdx].youtube} title="YouTube"><img src="/loghi/youtube.png" alt="YouTube" className="icon-btn-lg" /></a>
                  {/* Play/Pause custom icons */}
                  {playingIdx === currentIdx ? (
                    <button style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }} onClick={() => pauseTrack(currentIdx)} title="Pausa">
                      <img src="/loghi/pause.png" alt="Pause" className="icon-btn-lg" />
                    </button>
                  ) : (
                    <button style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }} onClick={() => playTrack(currentIdx)} title="Play">
                      <img src="/loghi/play.png" alt="Play" className="icon-btn-lg" />
                    </button>
                  )}
                  <a href={tracks[currentIdx].download} download title="Download"><img src="/loghi/download.png" alt="Download" className="icon-btn-lg" /></a>
                </span>
                <audio
                  ref={el => audioRefs.current[currentIdx] = el}
                  src={tracks[currentIdx].audio}
                  onEnded={() => handleEnded(currentIdx)}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <Link to="/artisti" className="back-link back-link-bottom">&larr; Torna agli Artisti</Link>
    </div>
  );
}
