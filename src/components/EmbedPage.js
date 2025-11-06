import React from 'react';

export default function EmbedPage({ src, title }) {
  const style = {
    position: 'relative',
    width: '100%',
    height: '100vh',
    border: '0',
    background: '#000',
  };
  return (
    <div style={{ position:'relative', minHeight:'100vh' }}>
      <iframe src={src} title={title || src} style={style} allow="autoplay; fullscreen; clipboard-read; clipboard-write" />
    </div>
  );
}
