import { useEffect, useRef, useState } from "react";
import GlobeSatellites from "./Globesatellites";
import zafraLogo from "./zafra_logo_branca.png";

/* ---------------------------------------------------------
   Landing — tela de entrada com scroll: o globo aparece
   sozinho, o scroll revela "Zafra Operations Center", e mais
   scroll revela o login. É uma "scrollytelling" simples: uma
   faixa alta (300vh) com um palco fixo (position: sticky) por
   dentro, cujo conteúdo muda de opacidade/posição conforme o
   progresso do scroll dentro dessa faixa.
--------------------------------------------------------- */

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);

export default function Landing({ onLogin }) {
  const trackRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const rafRef = useRef(null);

  useEffect(() => {
    function computeProgress() {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = -rect.top;
      setProgress(clamp(total > 0 ? scrolled / total : 0, 0, 1));
    }
    function onScroll() {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        computeProgress();
        rafRef.current = null;
      });
    }
    computeProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Três fases dentro dos 0..1 do progresso do scroll.
  const globeOpacity = 1 - clamp((progress - 0.28) / 0.18, 0, 1);
  const globeScale = lerp(1, 0.62, clamp(progress / 0.45, 0, 1));
  const globeY = lerp(0, -40, clamp(progress / 0.45, 0, 1));

  const titleOpacity = clamp((progress - 0.12) / 0.2, 0, 1) * (1 - clamp((progress - 0.62) / 0.16, 0, 1));
  const titleY = lerp(24, 0, clamp((progress - 0.12) / 0.2, 0, 1)) - lerp(0, 30, clamp((progress - 0.62) / 0.16, 0, 1));

  const loginOpacity = clamp((progress - 0.68) / 0.22, 0, 1);
  const loginY = lerp(28, 0, loginOpacity);
  const loginActive = progress > 0.82;

  function handleSubmit(e) {
    e.preventDefault();
    onLogin?.();
  }

  return (
    <div className="landing">
      <button className="landing-skip" onClick={() => onLogin?.()}>Pular intro →</button>

      <div className="landing-track" ref={trackRef} style={{ height: "300vh" }}>
        <div className="landing-stage">
          <div className="stage-globe" style={{ opacity: globeOpacity, transform: `translateY(${globeY}px) scale(${globeScale})` }}>
            <GlobeSatellites size={640} />
          </div>

          <div className="stage-title" style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)` }}>
            <img src={zafraLogo} alt="Zafra" className="stage-logo" />
            <h1>Operations Center</h1>
            <p>Automatize. Monitore. Cresça.</p>
          </div>

          <form className="stage-login" style={{ opacity: loginOpacity, transform: `translateY(${loginY}px)`, pointerEvents: loginActive ? "auto" : "none" }} onSubmit={handleSubmit}>
            <span className="login-eyebrow">Entrar</span>
            <h2>Bem-vindo de volta</h2>
            <input type="email" placeholder="voce@zafra.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="submit" className="login-btn">Entrar</button>
            <p className="login-hint">Login ilustrativo por enquanto — qualquer coisa entra.</p>
          </form>

          <div className="stage-scroll-hint" style={{ opacity: 1 - clamp(progress / 0.1, 0, 1) }}>
            <span>role para continuar</span>
            <div className="scroll-hint-line" />
          </div>
        </div>
      </div>

      <style>{`
        html, body, #root {
          width: 100%; min-height: 100vh; margin: 0; padding: 0;
          max-width: none; display: block; text-align: left; color-scheme: light;
        }
        .landing { background: #fafafa; }
        .landing-skip {
          position: fixed; top: 20px; right: 22px; z-index: 20;
          background: none; border: none; color: #a9a9ae; font-size: 12.5px;
          font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif;
          cursor: pointer; padding: 6px 10px;
        }
        .landing-skip:hover { color: #131314; }

        .landing-track { position: relative; }
        .landing-stage {
          position: sticky; top: 0; height: 100vh; width: 100%;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }

        .stage-globe { position: absolute; will-change: transform, opacity; max-width: 82vw; max-height: 70vh; }
        .stage-globe > div { width: 100% !important; height: 100% !important; max-width: min(640px, 82vw); max-height: min(640px, 70vh); }

        .stage-title {
          position: absolute; text-align: center; will-change: transform, opacity;
          font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif;
          pointer-events: none; max-width: 90vw;
        }
        .stage-logo { width: 230px; height: auto; filter: brightness(0); margin: 0 auto; display: block; }
        .stage-title h1 { font-size: 68px; font-weight: 700; letter-spacing: -1.5px; color: #131314; margin: 14px 0 10px; }
        .stage-title p { font-size: 19px; color: #75757a; margin: 0; }

        .stage-login {
          position: absolute; width: 440px; max-width: 88vw; text-align: center;
          will-change: transform, opacity; display: flex; flex-direction: column; gap: 14px;
          font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif;
        }
        .login-eyebrow { font-size: 14px; letter-spacing: 3px; color: #75757a; font-weight: 700; }
        .stage-login h2 { font-size: 32px; font-weight: 700; color: #131314; margin: 6px 0 18px; }
        .stage-login input {
          border: 1px solid #e7e7e9; border-radius: 10px; padding: 15px 17px;
          font-size: 17px; background: #fff; color: #131314; text-align: left;
        }
        .login-btn {
          background: #131314; color: #fff; border: none; padding: 15px; border-radius: 10px;
          font-size: 17px; font-weight: 600; cursor: pointer; margin-top: 6px;
        }
        .login-btn:hover { background: #2a2a2c; }
        .login-hint { font-size: 13px; color: #a9a9ae; margin: 6px 0 0; }

        .stage-scroll-hint {
          position: absolute; bottom: 34px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif;
          font-size: 11px; letter-spacing: 1.5px; color: #a9a9ae; text-transform: uppercase;
        }
        .scroll-hint-line { width: 1px; height: 26px; background: linear-gradient(#a9a9ae, transparent); animation: hint-bounce 1.8s ease-in-out infinite; }
        @keyframes hint-bounce { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}