import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { api } from "../services/api";
import type { GhostEvent, TierLevel } from "../types";

const WS_URL = "http://localhost:3000";
const DEBOUNCE_MS = 200;

export interface GhostScoreState {
  score: number;
  tier: TierLevel;
  events: GhostEvent[];
  connected: boolean;
}

export type GhostScoreHook = GhostScoreState & { pushEvent: (evt: GhostEvent) => void };

export function useGhostScoreEvents(
  agentAddress: string | null
): GhostScoreState & { pushEvent: (evt: GhostEvent) => void } {
  const [state, setState] = useState<GhostScoreState>({
    score: 0,
    tier: 0,
    events: [],
    connected: false,
  });
  const socketRef = useRef<Socket | null>(null);
  const bufferRef = useRef<GhostEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(() => {
    if (bufferRef.current.length === 0) return;
    const batch = [...bufferRef.current];
    bufferRef.current = [];
    setState((prev) => ({
      ...prev,
      events: [...batch, ...prev.events].slice(0, 100),
    }));
  }, []);

  const enqueue = useCallback(
    (evt: GhostEvent) => {
      bufferRef.current.push(evt);
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [flush]
  );

  const pushEvent = useCallback(
    (evt: GhostEvent) => {
      enqueue(evt);
      if (evt.type === "score:updated") {
        const d = evt.data as { newScore?: number; newTier?: number };
        setState((prev) => ({
          ...prev,
          score: d.newScore ?? prev.score,
          tier: (d.newTier as TierLevel) ?? prev.tier,
        }));
      }
    },
    [enqueue]
  );

  useEffect(() => {
    if (!agentAddress) return;

    api.getScore(agentAddress).then((data) => {
      setState((prev) => ({
        ...prev,
        score: data.score ?? prev.score,
        tier: (data.tier as TierLevel) ?? prev.tier,
      }));
    }).catch(() => {});

    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setState((prev) => ({ ...prev, connected: true }));
      const room = agentAddress.toLowerCase();
      socket.emit("join", room);
      console.log("[useGhostScoreEvents] Connected, joined room", room);
    });

    socket.on("disconnect", () => {
      setState((prev) => ({ ...prev, connected: false }));
    });

    const uid = () =>
      `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    socket.on("score:updated", (data: Record<string, unknown>) => {
      console.log("[useGhostScoreEvents] Received score:updated", data);
      setState((prev) => ({
        ...prev,
        score: (data.newScore as number) ?? prev.score,
        tier: ((data.newTier as TierLevel) ?? prev.tier) as TierLevel,
      }));
      enqueue({ id: uid(), type: "score:updated", timestamp: Date.now(), data });
    });

    socket.on("tier:changed", (data: Record<string, unknown>) => {
      enqueue({ id: uid(), type: "tier:changed", timestamp: Date.now(), data });
    });

    socket.on("api:called", (data: Record<string, unknown>) => {
      enqueue({ id: uid(), type: "api:called", timestamp: Date.now(), data });
    });

    socket.on("validation:new", (data: Record<string, unknown>) => {
      enqueue({ id: uid(), type: "validation:new", timestamp: Date.now(), data });
    });

    socket.on("payment:made", (data: Record<string, unknown>) => {
      console.log("[useGhostScoreEvents] Received payment:made", data);
      enqueue({ id: uid(), type: "payment:made", timestamp: Date.now(), data });
      const newScore = data.newScore as number | undefined;
      const newTier = data.newTier as TierLevel | undefined;
      if (newScore !== undefined || newTier !== undefined) {
        setState((prev) => ({
          ...prev,
          score: newScore ?? prev.score,
          tier: (newTier ?? prev.tier) as TierLevel,
        }));
      }
    });

    return () => {
      clearTimeout(flushTimerRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [agentAddress, enqueue]);

  return { ...state, pushEvent };
}
