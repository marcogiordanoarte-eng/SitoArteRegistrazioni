// Manager disattivato: il video Logo è stato rimosso per scelta UX.
export default function DashboardLogoVideoManager() {
  return (
    <div style={{ padding:24, border:'1px solid #333', borderRadius:14, background:'#111', color:'#bbb' }}>
      <h2 style={{ marginTop:0, color:'#ffd700' }}>Video Logo disattivato</h2>
      <p style={{ lineHeight:1.5, fontSize:14 }}>La funzionalità di caricamento e gestione del video associato al logo è stata rimossa. Il logo rimane statico. Usa la sezione "Impostazioni Sito" per aggiornare il video della pagina Label (Home).</p>
    </div>
  );
}
