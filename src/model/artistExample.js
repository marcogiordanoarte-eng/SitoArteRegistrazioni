// Struttura dati per coverartista e brani multipli
// coverartista: [{ image, fileAudioPlay, fileAudioDownload, linkSpotify, linkYouTube, prezzo }]
// Esempio:
const artistExample = {
  name: "Nome artista",
  title: "Titolo",
  genre: "Genere",
  bio: "Biografia",
  coverartista: [
    {
      titolo: "Urlo",
      image: "/loghi/spotify1.png",
  fileAudioPlay: "/audio/Urlo.wav",
  fileAudioDownload: "/audio/Urlo.wav.zip",
      linkSpotify: "https://open.spotify.com/album/5tglExKefh0tAMNPHElVnx",
      linkYouTube: "https://youtu.be/On5PFc0DsuQ?si=mv5JZv5VL0TeqXFU",
      linkAppleMusic: "http://itunes.apple.com/album/id/1810964427",
    prezzo: "9.99",
    linkStripe: "https://buy.stripe.com/test_urlo"
    },
    {
      image: "url_immagine_2",
      fileAudioPlay: "url_audio_play_2",
      fileAudioDownload: "url_audio_download_2",
      linkSpotify: "https://...",
      linkYouTube: "https://...",
      linkAppleMusic: "http://itunes.apple.com/album/id/1810964427",
      prezzo: "7.99"
    }
  ],
  stripeLink: "https://..."
};

export default artistExample;
