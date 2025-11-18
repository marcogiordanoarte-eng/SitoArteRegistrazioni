import React from 'react';
import { Link } from 'react-router-dom';

export default function EnterNowButton({ style = {}, className = '', to = '/sounds', label = 'Entra ora', size = 'lg' }) {
  const pad = size === 'lg' ? '14px 22px' : size === 'md' ? '10px 16px' : '8px 12px';
  const font = size === 'lg' ? '1.05rem' : '1rem';
  return (
    <>
      <style>{`
        .enter-now-btn {
          display:inline-block;
          padding:${pad};
          border:1px solid #00FF00;
          color:#00FF00;
          background:rgba(0,0,0,0.35);
          border-radius:12px;
          text-decoration:none;
          font-weight:700;
          letter-spacing:0.3px;
          text-shadow:0 0 10px rgba(0,255,0,0.65);
          box-shadow:0 0 8px rgba(0,255,0,0.25);
          transition: box-shadow 300ms ease, filter 300ms ease, opacity 600ms ease;
          font-size:${font};
          opacity: 0;
          animation: enterFade 900ms ease forwards;
        }
        @keyframes enterPulse {
          0% { box-shadow: 0 0 8px rgba(0,255,0,0.35), 0 0 0 rgba(0,255,0,0.0); }
          50% { box-shadow: 0 0 16px rgba(0,255,0,0.75), 0 0 32px rgba(0,255,0,0.25); }
          100% { box-shadow: 0 0 8px rgba(0,255,0,0.35), 0 0 0 rgba(0,255,0,0.0); }
        }
        @keyframes enterFade { from { opacity: 0 } to { opacity: 1 } }
        .enter-now-btn:hover { animation: enterPulse 2.2s ease-in-out infinite; filter: brightness(1.05); }
      `}</style>
      <Link to={to} className={`enter-now-btn ${className}`} style={style}>{label}</Link>
    </>
  );
}
