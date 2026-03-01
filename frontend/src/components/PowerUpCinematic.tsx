import { useState, useEffect, useRef, useCallback } from "react";
import "./PowerUpCinematic.css";

interface PowerUpCinematicProps {
  triggered: boolean;
  videoSrc: string;
  onComplete: () => void;
}

type Phase =
  | "idle"
  | "dim-in"
  | "playing"
  | "fade-out"
  | "flash"
  | "done";

export function PowerUpCinematic({
  triggered,
  videoSrc,
  onComplete,
}: PowerUpCinematicProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevTriggeredRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const onCompleteRef = useRef(onComplete);

  onCompleteRef.current = onComplete;

  const playChime = useCallback(() => {
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const notes = [520, 660, 784, 1046];
      const noteDuration = 0.08;
      const startTime = ctx.currentTime;

      notes.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(freq, startTime + i * noteDuration);

        gainNode.gain.setValueAtTime(0.15, startTime + i * noteDuration);
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          startTime + (i + 1) * noteDuration
        );

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(startTime + i * noteDuration);
        oscillator.stop(startTime + (i + 1) * noteDuration);
      });
    } catch {
      // Web Audio API not available
    }
  }, []);

  // Detect triggered rising edge
  useEffect(() => {
    if (triggered && !prevTriggeredRef.current) {
      setPhase("dim-in");
    }
    prevTriggeredRef.current = triggered;
  }, [triggered]);

  // Phase transitions
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (phase === "dim-in") {
      timer = setTimeout(() => {
        setPhase("playing");
        playChime();
        const video = videoRef.current;
        if (video) {
          video.currentTime = 0;
          video.play().catch(() => {});
        }
      }, 400);
    }

    if (phase === "fade-out") {
      timer = setTimeout(() => {
        setPhase("flash");
      }, 600);
    }

    if (phase === "flash") {
      timer = setTimeout(() => {
        setPhase("done");
        onCompleteRef.current();
      }, 300);
    }

    if (phase === "done") {
      timer = setTimeout(() => {
        setPhase("idle");
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
      }, 50);
    }

    return () => clearTimeout(timer);
  }, [phase, playChime]);

  const handleVideoEnded = useCallback(() => {
    setPhase("fade-out");
  }, []);

  if (phase === "idle") return null;

  return (
    <div className="powerup-cinematic-root">
      {/* Dark overlay */}
      <div
        className={`powerup-overlay ${
          phase === "dim-in" || phase === "playing"
            ? "powerup-overlay--visible"
            : ""
        } ${phase === "fade-out" ? "powerup-overlay--fading" : ""}`}
      />

      {/* Video container */}
      <div
        className={`powerup-video-wrapper ${
          phase === "playing" ? "powerup-video-wrapper--visible" : ""
        } ${phase === "fade-out" ? "powerup-video-wrapper--fading" : ""}`}
      >
        <div
          className={`powerup-glow ${
            phase === "playing" ? "powerup-glow--active" : ""
          }`}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            playsInline
            onEnded={handleVideoEnded}
            className="powerup-video"
          />
        </div>
      </div>

      {/* Green flash */}
      {phase === "flash" && <div className="powerup-flash" />}
    </div>
  );
}
