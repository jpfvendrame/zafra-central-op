import { useCallback, useEffect, useRef } from "react";
import createGlobe from "cobe";

/* ---------------------------------------------------------
   GlobeSatellites — globo 3D em WebGL via cobe, com pontos
   marcando "satélites". Adaptado de um componente TSX/Tailwind
   (21st.dev) para JS puro + CSS normal, já que este projeto
   não usa TypeScript nem Tailwind.
--------------------------------------------------------- */

const defaultMarkers = [
  { location: [45.0, -120.0] },
  { location: [30.0, 45.0] },
  { location: [-15.0, 100.0] },
  { location: [60.0, -30.0] },
  { location: [-40.0, -60.0] },
  { location: [10.0, 150.0] },
  { location: [55.0, 80.0] },
  { location: [-25.0, 20.0] },
  { location: [70.0, 25.0] },
  { location: [-5.0, -75.0] },
  { location: [35.0, -95.0] },
  { location: [-50.0, 140.0] },
  { location: [20.0, -20.0] },
  { location: [50.0, 120.0] },
  { location: [-30.0, 70.0] },
  { location: [5.0, -150.0] },
];

export default function GlobeSatellites({ markers = defaultMarkers, size = 420, speed = 0.003, className = "" }) {
  const canvasRef = useRef(null);
  const pointerInteracting = useRef(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);
  const phiRef = useRef(0);

  const handlePointerDown = useCallback((e) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    isPausedRef.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi;
      thetaOffsetRef.current += dragOffset.current.theta;
      dragOffset.current = { phi: 0, theta: 0 };
    }
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    isPausedRef.current = false;
  }, []);

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        };
      }
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerUp]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let globe = null;
    let disposed = false;
    let animationId = null;

    function init() {
      const width = canvas.offsetWidth;
      if (width === 0 || globe || disposed) return;
      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width: width * 2,
        height: width * 2,
        phi: 0,
        theta: 0.24,
        dark: 0.18,
        diffuse: 0.6,
        mapSamples: 16000,
        mapBrightness: 0.45,
        baseColor: [0.97, 0.97, 0.97],
        markerColor: [0.08, 0.08, 0.09], // preto/tinta, a pedido
        glowColor: [1, 1, 1],
        markerElevation: 0.14,
        markers: markers.map((m) => ({ location: m.location, size: 0.05 })),
        opacity: 0.95,
      });

      function animate() {
        if (disposed || !globe) return;
        if (!isPausedRef.current) phiRef.current += speed;
        globe.update({
          phi: phiRef.current + phiOffsetRef.current + dragOffset.current.phi,
          theta: 0.24 + thetaOffsetRef.current + dragOffset.current.theta,
        });
        animationId = requestAnimationFrame(animate);
      }
      animate();

      setTimeout(() => canvas && (canvas.style.opacity = "1"));
    }

    if (canvas.offsetWidth > 0) {
      init();
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect();
          init();
        }
      });
      ro.observe(canvas);
    }

    return () => {
      disposed = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (globe) globe.destroy();
    };
  }, [markers, speed]);

  return (
    <div className={`gsat ${className}`} style={{ width: size, height: size }}>
      <canvas ref={canvasRef} onPointerDown={handlePointerDown} className="gsat-canvas" />
      <style>{`
        .gsat { position: relative; user-select: none; aspect-ratio: 1 / 1; }
        .gsat::before {
          content: ""; position: absolute; inset: -12%; border-radius: 50%;
          background: radial-gradient(circle, rgba(200,81,46,0.10) 0%, rgba(200,81,46,0.03) 45%, transparent 70%);
          pointer-events: none;
        }
        .gsat-canvas { position: relative; width: 100%; height: 100%; cursor: grab; opacity: 0; transition: opacity 1.1s ease; touch-action: none; filter: drop-shadow(0 18px 40px rgba(19,19,20,0.18)); }
      `}</style>
    </div>
  );
}