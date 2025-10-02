import React from "react";
import "./PublicSite.css";

export default function PublicSite() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#000",
        backgroundImage: "url('/foto.png')",
        backgroundSize: "100vw auto",
        backgroundPosition: "center 20vh",
        backgroundRepeat: "no-repeat",
        padding: 40,
        position: "relative",
      }}
    >
      <div className="logo-wrapper">
        <div className="logo-stack">
          <img src="/disco.png" alt="Disco" className="disco-img" />
          <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
        </div>
      </div>
      <nav className="navbar">
        <ul>
          <li><a href="/" className="active">Home</a></li>
          <li><a href="/artisti">Artisti</a></li>
          <li><a href="/contatti">Contatti</a></li>
        </ul>
      </nav>
      <div className="container">
        <a href="/PaginaStudio/artestudio" className="glow-btn"><h1>Arte Registrazioni</h1></a>
      </div>
      <video src="/videopromo.mp4" autoPlay controls style={{maxWidth: "80vw", maxHeight: "60vh", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.2)"}} />
    </div>
  );
}