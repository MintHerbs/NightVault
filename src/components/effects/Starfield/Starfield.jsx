import * as React from 'react';
import { motion, useAnimation } from 'motion/react';
import { useTheme } from '../../../hooks/useTheme';

function generateStars(count, starColor) {
  const shadows = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 4000) - 2000;
    const y = Math.floor(Math.random() * 4000) - 2000;
    shadows.push(`${x}px ${y}px ${starColor}`);
  }
  return shadows.join(', ');
}

function StarLayer({ count = 1000, size = 1, transition, starColor = '#fff' }) {
  const [boxShadow, setBoxShadow] = React.useState('');
  const controls = useAnimation();

  React.useEffect(() => {
    setBoxShadow(generateStars(count, starColor));
  }, [count, starColor]);

  React.useEffect(() => {
    controls.start({ y: [0, -2000] });
  }, []);

  React.useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        controls.stop();
      } else {
        controls.start({ y: [0, -2000] });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [controls]);

  return (
    <motion.div
      initial={false}
      animate={controls}
      transition={transition}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '2000px', pointerEvents: 'none' }}
    >
      <div style={{ position: 'absolute', background: 'transparent', borderRadius: '50%', width: `${size}px`, height: `${size}px`, boxShadow }} />
      <div style={{ position: 'absolute', background: 'transparent', borderRadius: '50%', width: `${size}px`, height: `${size}px`, boxShadow, top: '2000px' }} />
    </motion.div>
  );
}

function CometCanvas({ isLight = false }) {
  const canvasRef = React.useRef(null);
  const isLightRef = React.useRef(isLight);
  React.useEffect(() => { isLightRef.current = isLight; }, [isLight]);
  const cometsRef = React.useRef([]);
  const animationFrameRef = React.useRef(null);
  const lastCometTimeRef = React.useRef(0);
  const lastFrameTimeRef = React.useRef(0);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const spawnComet = () => {
      const side = Math.floor(Math.random() * 4);
      let startX, startY, angle;

      switch (side) {
        case 0:
          startX = Math.random() * canvas.width;
          startY = -20;
          angle = Math.random() * Math.PI / 3 + Math.PI / 3;
          break;
        case 1:
          startX = canvas.width + 20;
          startY = Math.random() * canvas.height;
          angle = Math.random() * Math.PI / 3 + 2 * Math.PI / 3;
          break;
        case 2:
          startX = Math.random() * canvas.width;
          startY = canvas.height + 20;
          angle = Math.random() * Math.PI / 3 + 4 * Math.PI / 3;
          break;
        default:
          startX = -20;
          startY = Math.random() * canvas.height;
          angle = Math.random() * Math.PI / 3 - Math.PI / 6;
          break;
      }

      cometsRef.current.push({
        x: startX,
        y: startY,
        angle,
        speed: Math.random() * 2.1 + 3.5,
        tailLength: Math.random() * 40 + 60,
        life: 1.0,
      });
    };

    const animate = (timestamp) => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const delta = timestamp - lastFrameTimeRef.current;
      if (delta < 16) return;
      lastFrameTimeRef.current = timestamp;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (timestamp - lastCometTimeRef.current > 10000) {
        const numComets = Math.random() < 0.5 ? 1 : 2;
        spawnComet();
        if (numComets === 2) {
          const delayStart = timestamp;
          const spawnSecond = (t) => {
            if (t - delayStart >= 500) { spawnComet(); return; }
            requestAnimationFrame(spawnSecond);
          };
          requestAnimationFrame(spawnSecond);
        }
        lastCometTimeRef.current = timestamp;
      }

      cometsRef.current = cometsRef.current.filter(comet => {
        comet.x += Math.cos(comet.angle) * comet.speed;
        comet.y += Math.sin(comet.angle) * comet.speed;
        comet.life -= 0.012;

        if (
          comet.life <= 0 ||
          comet.x < -100 || comet.x > canvas.width + 100 ||
          comet.y < -100 || comet.y > canvas.height + 100
        ) return false;

        const tailEndX = comet.x - Math.cos(comet.angle) * comet.tailLength;
        const tailEndY = comet.y - Math.sin(comet.angle) * comet.tailLength;

        // Tail — thin, smooth, more gradient stops for silky falloff.
        // Light mode inverts to ink-on-white; read through a ref because
        // this animate loop is created once and never re-closes over props.
        const light = isLightRef.current;
        const gradient = ctx.createLinearGradient(comet.x, comet.y, tailEndX, tailEndY);
        if (light) {
          gradient.addColorStop(0,   `rgba(20,20,30,${comet.life * 0.85})`);
          gradient.addColorStop(0.2, `rgba(40,50,80,${comet.life * 0.55})`);
          gradient.addColorStop(0.5, `rgba(60,75,110,${comet.life * 0.28})`);
          gradient.addColorStop(0.8, `rgba(80,95,130,${comet.life * 0.1})`);
          gradient.addColorStop(1,   'rgba(100,120,160,0)');
        } else {
          gradient.addColorStop(0,   `rgba(255,255,255,${comet.life * 0.9})`);
          gradient.addColorStop(0.2, `rgba(220,235,255,${comet.life * 0.6})`);
          gradient.addColorStop(0.5, `rgba(200,220,255,${comet.life * 0.3})`);
          gradient.addColorStop(0.8, `rgba(180,200,255,${comet.life * 0.1})`);
          gradient.addColorStop(1,   'rgba(150,180,255,0)');
        }

        ctx.save();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(comet.x, comet.y);
        ctx.lineTo(tailEndX, tailEndY);
        ctx.stroke();
        ctx.restore();

        // Head — soft radial glow instead of flat circle
        const headGlow = ctx.createRadialGradient(
          comet.x, comet.y, 0,
          comet.x, comet.y, 3
        );
        if (light) {
          headGlow.addColorStop(0,   `rgba(15,15,25,${comet.life})`);
          headGlow.addColorStop(0.4, `rgba(40,50,80,${comet.life * 0.6})`);
          headGlow.addColorStop(1,   'rgba(60,75,110,0)');
        } else {
          headGlow.addColorStop(0,   `rgba(255,255,255,${comet.life})`);
          headGlow.addColorStop(0.4, `rgba(220,235,255,${comet.life * 0.6})`);
          headGlow.addColorStop(1,   'rgba(200,220,255,0)');
        }

        ctx.save();
        ctx.fillStyle = headGlow;
        ctx.beginPath();
        ctx.arc(comet.x, comet.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        return true;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      } else {
        const now = performance.now();
        lastCometTimeRef.current = now;
        lastFrameTimeRef.current = now;
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    resize();
    animationFrameRef.current = requestAnimationFrame(animate);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    />
  );
}

function StarsBackground({
  children,
  speed = 90,
  starColor,
}) {
  // Light mode inverts the whole field: white sky, ink-dark stars and
  // comets (T-062). starColor stays overridable per-call site.
  const { resolvedMode } = useTheme();
  const isLight = resolvedMode === 'light';
  const resolvedStarColor = starColor ?? (isLight ? '#1a1a26' : '#fff');

  return (
    <>
      <div style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        // Themed tokens, not literal #fff/#000 — light mode uses the
        // tinted off-white surfaces (T-062), so the field matches whatever
        // theme is selected instead of glaring.
        background: isLight
          ? 'radial-gradient(ellipse at bottom, var(--md-surface-container) 0%, var(--color-bg) 100%)'
          : 'radial-gradient(ellipse at bottom, var(--md-surface-container-low) 0%, var(--color-bg) 100%)',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.6,
      }}>


        <StarLayer count={1000} size={1} transition={{ repeat: Infinity, duration: speed,     ease: 'linear' }} starColor={resolvedStarColor} />
        <StarLayer count={400}  size={2} transition={{ repeat: Infinity, duration: speed * 2, ease: 'linear' }} starColor={resolvedStarColor} />
        <StarLayer count={200}  size={3} transition={{ repeat: Infinity, duration: speed * 3, ease: 'linear' }} starColor={resolvedStarColor} />
      </div>

      <CometCanvas isLight={isLight} />

      {children}
    </>
  );
}

export default StarsBackground;