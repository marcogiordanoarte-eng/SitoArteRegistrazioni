import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import ArtistForm from '../ArtistForm';

describe('ArtistForm restricted mode', () => {
  it('hides tracks and stripe sections, shows only basic fields', () => {
    const init = {
      name: 'Mario',
      bio: 'Bio',
      imageArtista: 'https://example.com/photo.jpg',
      imagePrimaPaginaA: 'https://example.com/first.jpg',
      imageSecondaPaginaA: 'https://example.com/second.jpg',
      stripeLink: 'https://stripe.link',
      cover: [{ titolo: 'T1', genere: 'G', linkSpotify: 's', linkYouTube: 'y', prezzo: '1.00' }],
    };
    render(<ArtistForm initialData={init} onSave={() => {}} restrictToBioAndPhoto={true} />);

    // Basic fields present
    expect(screen.getByLabelText(/Nome artista/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Biografia/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Carica immagine Artista/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Salva$/i })).toBeInTheDocument();

    // Hidden sections (not rendered)
    expect(screen.queryByText(/Immagine PrimaPaginaA/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Immagine SecondaPaginaA/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Brani e cover/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Link pagamento Stripe/i)).not.toBeInTheDocument();
  });
});
