// Basic player logic for artist pages
// Assumptions: Each .cover-box represents a track (sequential order)
// Enhancements planned: real audio sources per track

document.addEventListener('DOMContentLoaded', () => {
  const coverBoxes = [...document.querySelectorAll('.cover-box')];
  if (!coverBoxes.length) return;

  let currentIndex = 0;
  let isPlaying = false;
  // Placeholder audio element (replace src dynamically in future)
  const audio = new Audio();
  audio.preload = 'none';

  const updateVisual = () => {
    coverBoxes.forEach((box, i) => {
      if (i === currentIndex && isPlaying) {
        box.classList.add('playing');
      } else {
        box.classList.remove('playing');
      }
    });
  };

  const loadTrack = (index) => {
    const box = coverBoxes[index];
    // Future: dataset.audioUrl attribute
    const url = box.dataset.audio || '';
    if (url) {
      audio.src = url;
    } else {
      // Silent tiny wav data URI (1 second) fallback so play/pause UI works
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAABAAAAACAAACaGwAAAAA';
    }
  };

  const play = () => {
    isPlaying = true;
    audio.play().catch(()=>{});
    updateVisual();
  };
  const pause = () => {
    isPlaying = false;
    audio.pause();
    updateVisual();
  };

  const goTo = (next) => {
    currentIndex = (next + coverBoxes.length) % coverBoxes.length;
    loadTrack(currentIndex);
    if (isPlaying) play();
  };

  // Initialize first track
  loadTrack(currentIndex);
  updateVisual();

  // Event delegation for play/pause buttons inside cover boxes
  coverBoxes.forEach((box, idx) => {
    const btn = box.querySelector('.play-toggle');
    const prev = box.querySelector('.prev-btn');
    const next = box.querySelector('.next-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        if (currentIndex !== idx) {
          currentIndex = idx;
          loadTrack(currentIndex);
        }
        isPlaying ? pause() : play();
      });
    }
    if (prev) prev.addEventListener('click', () => goTo(currentIndex - 1));
    if (next) next.addEventListener('click', () => goTo(currentIndex + 1));
  });

  // Pause visual state when audio naturally ends
  audio.addEventListener('ended', () => {
    isPlaying = false;
    updateVisual();
  });
});
