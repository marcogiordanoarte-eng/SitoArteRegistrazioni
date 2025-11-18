import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PlayerProvider, usePlayer } from '../components/PlayerContext';

function TestPlayButton({ src }) {
  const player = usePlayer();
  return (
    <button data-testid="play" onClick={() => player.play({ src, title: 'Test Track', cover: '', artistId: 'test', trackId: 'track-test-1' })}>Play</button>
  );
}

function TestPage({ src }) {
  return (
    <PlayerProvider>
      <TestPlayButton src={src} />
    </PlayerProvider>
  );
}

// NOTE: JSDOM can't actually play audio; we test state transitions instead.

test('global player state persists after second render (simulating route change)', async () => {
  // Usa un data URI silenzioso per evitare fetch/head in test
  const TEST_SRC = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAABAAAAACAAACaGwAAAAA';
  const { getByTestId, rerender } = render(<TestPage src={TEST_SRC} />);
  const btn = getByTestId('play');
  fireEvent.click(btn);
  // After click, state should indicate playing
  // We access internal context via a second component
  let playingFlag = false;
  function ReadState() { const p = usePlayer(); playingFlag = p.state.playing; return null; }
  render(<PlayerProvider><ReadState /></PlayerProvider>);
  expect(playingFlag).toBe(true);
  // Rerender simulating navigating to another page still inside provider
  rerender(<TestPage src={TEST_SRC} />);
  // Simulate second component reading state again
  playingFlag = false;
  render(<PlayerProvider><ReadState /></PlayerProvider>);
  expect(playingFlag).toBe(true);
});
