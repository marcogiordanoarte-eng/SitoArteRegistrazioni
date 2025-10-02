import React from 'react';

export default function Icon({ name = '', size = 22, color = '#ffd700' }) {
  const n = (name || '').toLowerCase();
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' };

  if (n.includes('spotify')) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" fill="#1DB954" />
        <path d="M7 10c3-1 7-.8 10 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M7.5 13c2.6-.7 5.8-.5 8 .8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 15.5c2-.5 4.2-.3 5.8.6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    );
  }
  if (n.includes('youtube')) {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="3" fill="#FF0000" />
        <path d="M10 9.5v5l5-2.5-5-2.5z" fill="#fff" />
      </svg>
    );
  }
  if (n.includes('apple')) {
    return (
      <svg {...common}>
        <path d="M15.5 7.5c-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.9-.9 2.9 1 .1 2.1-.6 2.8-1.3.7-.7 1.2-1.8.7-2.9zM17.8 12c-.6-.7-1.5-1.1-2.4-1.1-1.1 0-1.5.5-2.3.5-.8 0-1.3-.5-2.4-.5-1 0-2 .6-2.6 1.5-1.1 1.6-.9 4 .2 5.8.6.9 1.4 2 2.4 2 .9 0 1.2-.6 2.4-.6 1.2 0 1.4.6 2.4.6 1 0 1.8-1 2.4-1.9.4-.6.6-1 .9-1.7-2.1-.9-2.4-3.8-1-5.6z" fill={color}/>
      </svg>
    );
  }
  if (n.includes('download')) {
    return (
      <svg {...common}>
        <path d="M12 3v10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <path d="M8 10l4 4 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="5" y="18" width="14" height="2" rx="1" fill={color}/>
      </svg>
    );
  }
  if (n.includes('play')) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
        <path d="M10 8l6 4-6 4V8z" fill={color} />
      </svg>
    );
  }

  if (n.includes('hand')) {
    // Mano puntatore stile cursore
    return (
      <svg {...common}>
        <path d="M7 12.5V9.8a1.3 1.3 0 0 1 2.6 0v1.2-4.2a1.3 1.3 0 1 1 2.6 0V11V7.2a1.3 1.3 0 1 1 2.6 0V12V9.4a1.3 1.3 0 1 1 2.6 0v4.9c0 .9-.2 1.7-.7 2.5l-1.5 2.5c-.5.9-1.5 1.4-2.6 1.4H11c-1.2 0-2.2-.7-2.6-1.8l-1.1-2.7A4 4 0 0 1 7 12.5Z" stroke={color} strokeWidth="1.6" fill="rgba(0,0,0,0.15)" strokeLinejoin="round"/>
        <circle cx="12" cy="5" r="0.4" fill={color} />
      </svg>
    );
  }

  // default generic note icon
  return (
    <svg {...common}>
      <path d="M10 4v10.5a2.5 2.5 0 1 1-2-2.45V6h8V4h-6z" fill={color}/>
    </svg>
  );
}
