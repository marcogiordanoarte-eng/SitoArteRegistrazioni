import React from 'react';
import { usePlayer } from './PlayerContext';

export default function MiniPlayer() {
  const { state, pause, play } = usePlayer();
  // Se non abbiamo sorgente né errore, non mostrare nulla
  if (!state.src && !state.error) return null;
  const hasError = !!state.error;
  return (
    <div style={{ position:'fixed', bottom:12, right:12, zIndex:12000, background: hasError ? 'rgba(60,0,0,0.75)' : 'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', border: hasError ? '1px solid #ff4d4f' : '1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'8px 12px', display:'flex', alignItems:'center', gap:12, boxShadow: hasError ? '0 0 18px rgba(255,0,0,0.55)' : '0 4px 18px rgba(0,0,0,0.45)' }}>
      {state.cover && !hasError && (
        <img src={state.cover} alt={state.title || 'cover'} style={{ width:46, height:46, objectFit:'cover', borderRadius:10, boxShadow:'0 0 8px rgba(255,215,0,0.5)' }} />
      )}
      <div style={{ maxWidth:180 }}>
        {hasError ? (
          <div style={{ fontSize:12, fontWeight:700, color:'#ffb3b3', lineHeight:1.25 }}>{state.error}</div>
        ) : (
          <div style={{ fontSize:12, fontWeight:700, color:'#ffd700', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{state.title || 'In riproduzione'}</div>
        )}
      </div>
      {!hasError && (
        <button
          type='button'
          onClick={() => state.playing ? pause() : play({ src: state.src, title: state.title, cover: state.cover, artistId: state.artistId, trackId: state.trackId })}
          aria-label={state.playing ? 'Pausa' : 'Play'}
          style={{ width:44, height:44, borderRadius:'50%', background:'#111', border:'1px solid #ffd700', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
        >
          {state.playing ? (
            <svg width='24' height='24' viewBox='0 0 64 64'>
              <rect x='16' y='12' width='10' height='40' rx='2' fill='#ffd700' />
              <rect x='38' y='12' width='10' height='40' rx='2' fill='#ffd700' />
            </svg>
          ) : (
            <svg width='24' height='24' viewBox='0 0 64 64'>
              <polygon points='20,16 48,32 20,48' fill='#ffd700' />
            </svg>
          )}
        </button>
      )}
      {hasError && (
        <button
          type='button'
          onClick={() => pause()}
          aria-label='Chiudi'
          style={{ width:32, height:32, borderRadius:'50%', background:'#330000', border:'1px solid #ff4d4f', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#ff4d4f', fontWeight:700, fontSize:12 }}
        >×</button>
      )}
    </div>
  );
}
