import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface GhostRevealProps {
  animationSrc: string
  onComplete: () => void
  walletConnected: boolean
}

export function GhostReveal({
  animationSrc,
  onComplete,
  walletConnected,
}: GhostRevealProps) {
  const [videoEnded, setVideoEnded] = useState(false)
  const [visible, setVisible] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const isGif = animationSrc.endsWith(".gif")
  const onCompleteRef = useRef(onComplete)

  // Keep the ref up-to-date so the exit callback never captures a stale closure
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // For gifs, simulate a "video ended" after ~3.5s
  useEffect(() => {
    if (!isGif) return
    const timer = setTimeout(() => setVideoEnded(true), 3500)
    return () => clearTimeout(timer)
  }, [isGif])

  const handleVideoEnded = useCallback(() => {
    setVideoEnded(true)
  }, [])

  // Once both conditions are met, trigger the exit fade
  useEffect(() => {
    if (videoEnded && walletConnected) {
      setVisible(false)
    }
  }, [videoEnded, walletConnected])

  return (
    <AnimatePresence
      onExitComplete={() => {
        onCompleteRef.current()
      }}
    >
      {visible && (
        <motion.div
          key="ghost-reveal-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "#000" }}
        >
          <div className="flex flex-col items-center gap-6">
            {/* Video / GIF */}
            {isGif ? (
              <img
                src={animationSrc}
                alt="Ghost reveal animation"
                className="w-[250px] h-auto object-contain"
              />
            ) : (
              <video
                ref={videoRef}
                src={animationSrc}
                autoPlay
                muted
                playsInline
                onEnded={handleVideoEnded}
                className="w-[250px] h-auto object-contain"
                style={{ background: "transparent" }}
              />
            )}

            {/* Branding text */}
            <div className="flex flex-col items-center gap-2">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1, ease: "easeOut" }}
                className="text-3xl font-bold tracking-wide"
                style={{ color: "#fff" }}
              >
                GhostScore
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.3, ease: "easeOut" }}
                className="text-xs font-medium tracking-[0.3em] uppercase"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                Private Agent Reputation
              </motion.p>
            </div>

            {/* Connecting indicator — shows only when video is done but wallet isn't connected yet */}
            <AnimatePresence>
              {videoEnded && !walletConnected && (
                <motion.div
                  key="connecting-indicator"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center gap-3 mt-2"
                >
                  {/* Pulsing emerald dot */}
                  <span className="relative flex h-3 w-3">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                      style={{ backgroundColor: "#34d399" }}
                    />
                    <span
                      className="relative inline-flex h-3 w-3 rounded-full"
                      style={{ backgroundColor: "#10b981" }}
                    />
                  </span>

                  <p
                    className="text-sm font-medium tracking-wide"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    Connecting...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
