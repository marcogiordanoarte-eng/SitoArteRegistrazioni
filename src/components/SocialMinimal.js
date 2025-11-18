import React from 'react';

// Minimal inline SVG social icons unified style (stroke-only)
export default function SocialMinimal({
  facebook = 'https://www.facebook.com/arteregistrazionilabel/',
  youtube = 'https://www.youtube.com/@arteregistrazioni',
  instagram = 'https://www.instagram.com/arte.registrazioni/',
  gap = 12,
  size = 22,
  style = {}
}) {
  const baseStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap,
    margin: '8px 0 12px',
    ...style
  };
  const stroke = '#94a3b8';
  return (
    <div className="social-minimal" style={baseStyle}>
      {facebook && (
        <a href={facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="social-link">
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 8h-2.2c-.4 0-.8.4-.8.8V11h3v2h-3v6h-2v-6H8v-2h2V8.8A2.8 2.8 0 0 1 12.8 6H15v2Z" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3" y="3" width="18" height="18" rx="4" stroke={stroke} strokeWidth="1.5" />
          </svg>
        </a>
      )}
      {youtube && (
        <a href={youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="social-link">
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="7" width="18" height="10" rx="3" stroke={stroke} strokeWidth="1.5" />
            <path d="M11 10v4l4-2-4-2Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </a>
      )}
      {instagram && (
        <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="social-link">
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="5" stroke={stroke} strokeWidth="1.5" />
            <circle cx="12" cy="12" r="4" stroke={stroke} strokeWidth="1.5" />
            <circle cx="17.5" cy="6.5" r="1" fill={stroke} />
          </svg>
        </a>
      )}
    </div>
  );
}
