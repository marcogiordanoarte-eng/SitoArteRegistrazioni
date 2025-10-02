import React, { useState, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function ContactForm(){
  const [sending,setSending] = useState(false);
  const [done,setDone] = useState(false);
  const [error,setError] = useState('');
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const msgRef = useRef(null);
  async function onSubmit(e){
    e.preventDefault();
    setError('');
    if(sending) return;
    const name = nameRef.current.value.trim();
    const email = emailRef.current.value.trim();
    const message = msgRef.current.value.trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError('Email non valida'); return; }
    if(message.length < 5) { setError('Messaggio troppo breve'); return; }
    setSending(true);
    try {
      const fn = httpsCallable(getFunctions(), 'sendContactAutoReply');
      await fn({ email, name, message });
      setDone(true);
      nameRef.current.value=''; emailRef.current.value=''; msgRef.current.value='';
    } catch (e){
      setError('Invio non riuscito. Riprova.');
    } finally {
      setSending(false);
    }
  }
  if(done){
    return <div style={{ color:'#ffd700', fontSize:'1.1em', lineHeight:1.5 }}>Grazie! Ti abbiamo inviato un'email di conferma e ti risponderemo presto.</div>;
  }
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width:'100%' }}>
      <input ref={nameRef} name="name" placeholder="Nome" style={{ width:'100%', maxWidth:520, padding:14, borderRadius:12, border:'2px solid #ffd700', fontSize:'1.05em', background:'#222', color:'#ffd700' }} />
      <input ref={emailRef} name="email" type="email" placeholder="Email" required style={{ width:'100%', maxWidth:520, padding:14, borderRadius:12, border:'2px solid #ffd700', fontSize:'1.05em', background:'#222', color:'#ffd700' }} />
      <textarea ref={msgRef} name="message" rows={8} placeholder="Scrivi qui il tuo messaggio..." required style={{ width:'100%', maxWidth:520, minHeight:120, padding:24, borderRadius:14, border:'2px solid #ffd700', fontSize:'1.05em', background:'#222', color:'#ffd700' }} />
      {error && <div style={{ color:'#ff6b6b', fontSize:'0.85em' }}>{error}</div>}
      <button disabled={sending} className="glow-btn" type="submit" style={{ background:'#ffd700', opacity: sending?0.6:1, color:'#222', fontWeight:'bold', border:'none', borderRadius:12, padding:'16px 48px', fontSize:'1.1em', boxShadow:'0 0 8px #ffd700', cursor:'pointer', textShadow:'0 0 4px #ffd700' }}>{sending ? 'Invio...' : 'Invia'}</button>
    </form>
  );
}