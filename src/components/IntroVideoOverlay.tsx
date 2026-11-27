/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, SkipForward, Volume2, VolumeX } from 'lucide-react';

interface IntroVideoOverlayProps {
  onStarted?: () => void;
  onComplete: () => void;
}

const INTRO_VIDEO_SRC = '/assets/aistudio/gemini_generated_video_dd358b0e_1b0a2e95.mp4';
const POST_VIDEO_HOLD_MS = 3000;
const MAX_FETCH_RETRIES = 3;

export function IntroVideoOverlay({ onStarted, onComplete }: IntroVideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onStartedRef = useRef(onStarted);
  onStartedRef.current = onStarted;

  const completedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const hasEndedRef = useRef(false);
  const playInFlightRef = useRef(false);
  const mutedRef = useRef(true);
  const holdTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const watchdogTimerRef = useRef<number | null>(null);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [muted, setMuted] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsUserTap, setNeedsUserTap] = useState(false);

  const finishIntro = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (watchdogTimerRef.current !== null) {
      window.clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    setFadingOut(true);
    fadeTimerRef.current = window.setTimeout(() => {
      onCompleteRef.current();
    }, 320);
  }, []);

  // Step 1: Force-download the entire MP4 into an in-memory Blob first (with retries)
  // so live servers/proxies/Range requests never stall or fail on cold initial open.
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    async function preloadVideoBlob() {
      for (let attempt = 0; attempt < MAX_FETCH_RETRIES; attempt++) {
        if (cancelled) return;
        try {
          const response = await fetch(INTRO_VIDEO_SRC, {
            credentials: 'same-origin',
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const contentLengthHeader = response.headers.get('content-length');
          const totalBytes = contentLengthHeader ? Number(contentLengthHeader) : 0;

          let blob: Blob;
          if (response.body && totalBytes > 0) {
            const reader = response.body.getReader();
            const chunks: Uint8Array<ArrayBuffer>[] = [];
            let receivedBytes = 0;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                const copy = new Uint8Array(value.byteLength);
                copy.set(value);
                chunks.push(copy);
                receivedBytes += value.byteLength;
                if (!cancelled) {
                  setLoadProgress(Math.min(99, Math.round((receivedBytes / totalBytes) * 100)));
                }
              }
            }
            blob = new Blob(chunks, { type: 'video/mp4' });
          } else {
            const rawBuffer = await response.arrayBuffer();
            blob = new Blob([rawBuffer], { type: 'video/mp4' });
          }

          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setLoadProgress(100);
          setVideoSrc(objectUrl);
          return;
        } catch (err) {
          if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) {
            return;
          }
          if (attempt < MAX_FETCH_RETRIES - 1) {
            await new Promise((r) => window.setTimeout(r, 350 * (attempt + 1)));
          }
        }
      }

      // Fallback to direct URL if fetch retries failed
      if (!cancelled) {
        setLoadProgress(100);
        setVideoSrc(INTRO_VIDEO_SRC);
      }
    }

    void preloadVideoBlob();

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

  const attemptPlay = useCallback((preferUnmuted = false) => {
    const video = videoRef.current;
    if (!video || completedRef.current || hasEndedRef.current) return;

    if (!video.paused && !video.ended) {
      setIsPlaying(true);
      setNeedsUserTap(false);
      return;
    }

    if (playInFlightRef.current) return;

    if (preferUnmuted) {
      mutedRef.current = false;
      video.defaultMuted = false;
      video.muted = false;
      setMuted(false);
    } else {
      video.defaultMuted = mutedRef.current;
      video.muted = mutedRef.current;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
    }

    playInFlightRef.current = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          playInFlightRef.current = false;
          setIsPlaying(true);
          setNeedsUserTap(false);
        })
        .catch((err: unknown) => {
          playInFlightRef.current = false;
          const errorName = err instanceof DOMException ? err.name : '';

          if (errorName === 'AbortError') {
            return;
          }

          // If unmuted was rejected, fall back to muted playback immediately
          if (!video.muted) {
            mutedRef.current = true;
            video.defaultMuted = true;
            video.muted = true;
            video.setAttribute('muted', '');
            setMuted(true);
            playInFlightRef.current = true;
            void video
              .play()
              .then(() => {
                playInFlightRef.current = false;
                setIsPlaying(true);
                setNeedsUserTap(false);
              })
              .catch(() => {
                playInFlightRef.current = false;
                setNeedsUserTap(true);
              });
            return;
          }

          // Strict autoplay block (e.g. iOS Low Power Mode): show manual Play Intro button
          setNeedsUserTap(true);
        });
    } else {
      playInFlightRef.current = false;
    }
  }, []);

  // Step 2: Once the Blob URL is ready, force load and trigger playback immediately
  useEffect(() => {
    if (!videoSrc) return;
    const video = videoRef.current;
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.load();

    // Watchdog: if the video is loaded but still paused after 450ms, retry or show Tap to Play
    watchdogTimerRef.current = window.setTimeout(() => {
      const current = videoRef.current;
      if (!current || completedRef.current || hasEndedRef.current) return;
      if (current.paused) {
        attemptPlay(false);
        window.setTimeout(() => {
          const stillVideo = videoRef.current;
          if (stillVideo && stillVideo.paused && !stillVideo.ended && !completedRef.current) {
            setNeedsUserTap(true);
          }
        }, 500);
      }
    }, 450);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        attemptPlay(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (watchdogTimerRef.current !== null) {
        window.clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    };
  }, [videoSrc, attemptPlay]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
      }
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }
      if (watchdogTimerRef.current !== null) {
        window.clearTimeout(watchdogTimerRef.current);
      }
    };
  }, []);

  const handleVideoPlaying = useCallback(() => {
    setIsPlaying(true);
    setNeedsUserTap(false);
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      onStartedRef.current?.();
    }
  }, []);

  const handleVideoEnded = useCallback(() => {
    if (completedRef.current || holdTimerRef.current !== null) return;
    hasEndedRef.current = true;
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      onStartedRef.current?.();
    }
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      finishIntro();
    }, POST_VIDEO_HOLD_MS);
  }, [finishIntro]);

  const handleToggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    mutedRef.current = nextMuted;
    video.muted = nextMuted;
    setMuted(nextMuted);
    if (video.paused && !video.ended && !hasEndedRef.current) {
      attemptPlay(!nextMuted);
    }
  };

  const handleVideoSurfaceClick = () => {
    const video = videoRef.current;
    if (!video || hasEndedRef.current) return;
    if (needsUserTap || video.paused) {
      attemptPlay(true);
      return;
    }
    if (video.muted) {
      mutedRef.current = false;
      video.muted = false;
      setMuted(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#0F1711] flex items-center justify-center transition-opacity duration-300 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          muted={muted}
          playsInline
          autoPlay
          preload="auto"
          onClick={handleVideoSurfaceClick}
          onLoadedData={() => attemptPlay(false)}
          onCanPlay={() => attemptPlay(false)}
          onCanPlayThrough={() => attemptPlay(false)}
          onPlaying={handleVideoPlaying}
          onEnded={handleVideoEnded}
          onError={() => {
            // If a blob URL ever failed to decode on a quirky device, fall back once to direct URL
            if (videoSrc !== INTRO_VIDEO_SRC) {
              setVideoSrc(INTRO_VIDEO_SRC);
            } else {
              finishIntro();
            }
          }}
          className="w-full h-full object-contain cursor-pointer"
        />
      )}

      {/* Preload Status while forcing the video to download into memory first */}
      {!isPlaying && !needsUserTap && (
        <div className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center gap-3 px-6">
          <div className="w-48 sm:w-56 h-1.5 rounded-full bg-[#FAF6EE]/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#8DE0A5] transition-all duration-150"
              style={{ width: `${Math.max(8, loadProgress)}%` }}
            />
          </div>
          <span className="text-[#FAF6EE]/80 text-xs sm:text-sm font-medium tracking-wide">
            {loadProgress < 100
              ? `Loading Wildgrove Sanctuary... ${loadProgress}%`
              : 'Starting intro...'}
          </span>
        </div>
      )}

      {/* Fallback Play Button only if the browser strictly blocks even muted autoplay */}
      {needsUserTap && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0F1711]/55">
          <button
            type="button"
            onClick={() => attemptPlay(true)}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-[#FAF6EE] hover:bg-white text-[#1D2B20] text-sm sm:text-base font-bold shadow-xl cursor-pointer transition-transform active:scale-95"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Play Intro</span>
          </button>
        </div>
      )}

      {/* Subtle Bottom Controls: Sound Toggle + Skip Intro */}
      <div className="fixed bottom-4 sm:bottom-6 inset-x-4 sm:inset-x-6 flex items-center justify-between pointer-events-none">
        {videoSrc ? (
          <button
            type="button"
            onClick={handleToggleMute}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#162119]/75 hover:bg-[#1E2E22]/90 border border-[#FAF6EE]/20 text-[#FAF6EE] text-xs sm:text-sm font-semibold backdrop-blur-sm cursor-pointer transition-colors"
            aria-label={muted ? 'Unmute intro video' : 'Mute intro video'}
          >
            {muted ? (
              <>
                <VolumeX className="w-4 h-4 text-[#F5C969]" />
                <span>Tap for Sound</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-[#8DE0A5]" />
                <span>Sound On</span>
              </>
            )}
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={finishIntro}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF6EE]/90 hover:bg-[#FAF6EE] text-[#1D2B20] text-xs sm:text-sm font-semibold shadow-md cursor-pointer transition-colors"
        >
          <span>Skip Intro</span>
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
