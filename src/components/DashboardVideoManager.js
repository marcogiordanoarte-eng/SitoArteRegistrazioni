// Feature rimossa: gestione upload video Studio.
// Manteniamo un componente vuoto per evitare errori se referenziato da codice legacy.
export default function DashboardVideoManager() {
  return (
    <div style={{ padding:20, border:'1px solid #333', borderRadius:12, background:'#111', color:'#ffd700' }}>
      <h2 style={{ marginTop:0 }}>Gestione Video Studio rimossa</h2>
      <p style={{ fontSize:14, lineHeight:1.5 }}>La funzionalità di upload e overlay del video Studio è stata disattivata. Questo pannello è ora inattivo.</p>
    </div>
  );
}
