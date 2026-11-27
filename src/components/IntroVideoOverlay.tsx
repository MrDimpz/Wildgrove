/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, SkipForward, Volume2, VolumeX } from 'lucide-react';

interface IntroVideoOverlayProps {
  onComplete: () => void;
}

const INTRO_VIDEO_SRC = '/assets/aistudio/gemini_generated_video_dd358b0e_1b0a2e95.mp4';
const POST_VIDEO_HOLD_MS = 3000;

export function IntroVideoOverlay({ onComplete }: IntroVideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const completedRef = useRef(false);
  const hasEndedRef = useRef(false);
  const playInFlightRef = useRef(false);
  const mutedRef = useRef(true);
  const holdTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  // Start muted so browsers in live/deployed environments reliably allow instant autoplay on cold load
  const [muted, setMuted] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [needsUserTap, setNeedsUserTap] = useState(false);

  const finishIntro = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setFadingOut(true);
    fadeTimerRef.current = window.setTimeout(() => {
      onCompleteRef.current();
    }, 320);
  }, []);

  const attemptPlay = useCallback((preferUnmuted = false) => {
    const video = videoRef.current;
    if (!video || completedRef.current || hasEndedRef.current) return;
    if (!video.paused && !video.ended) {
      setNeedsUserTap(false);
      setIsBuffering(false);
      return;
    }
    if (playInFlightRef.current) return;

    if (preferUnmuted) {
      mutedRef.current = false;
      video.muted = false;
      setMuted(false);
    } else {
      video.defaultMuted = mutedRef.current;
      video.muted = mutedRef.current;
    }

    playInFlightRef.current = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          playInFlightRef.current = false;
          setNeedsUserTap(false);
        })
        .catch((err: unknown) => {
          playInFlightRef.current = false;
          const errorName = err instanceof DOMException ? err.name : '';

          // Cold network load or concurrent media load interrupted play(); wait for canplay/loadeddata
          if (errorName === 'AbortError') {
            return;
          }

          // If unmuted autoplay was rejected, immediately retry muted
          if (!video.muted) {
            mutedRef.current = true;
            video.defaultMuted = true;
            video.muted = true;
            setMuted(true);
            playInFlightRef.current = true;
            void video
              .play()
              .then(() => {
                playInFlightRef.current = false;
                setNeedsUserTap(false);
              })
              .catch((retryErr: unknown) => {
                playInFlightRef.current = false;
                const retryName = retryErr instanceof DOMException ? retryErr.name : '';
                if (retryName === 'NotAllowedError') {
                  setIsBuffering(false);
                  setNeedsUserTap(true);
                }
              });
            return;
          }

          // Even muted autoplay blocked (e.g. iOS Low Power Mode): show a clean tap-to-play button
          if (errorName === 'NotAllowedError') {
            setIsBuffering(false);
            setNeedsUserTap(true);
          }
        });
    } else {
      playInFlightRef.current = false;
    }
  }, []);

  const handleVideoEnded = useCallback(() => {
    if (completedRef.current || holdTimerRef.current !== null) return;
    hasEndedRef.current = true;
    setIsBuffering(false);
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      finishIntro();
    }, POST_VIDEO_HOLD_MS);
  }, [finishIntro]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // Ensure DOM attributes are present before initial browser autoplay evaluation
      video.defaultMuted = true;
      video.muted = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      attemptPlay(false);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        attemptPlay(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
      }
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }
    };
  }, [attemptPlay]);

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
      <video
        ref={videoRef}
        src={INTRO_VIDEO_SRC}
        muted={muted}
        playsInline
        autoPlay
        preload="auto"
        onClick={handleVideoSurfaceClick}
        onLoadedMetadata={() => attemptPlay(false)}
        onLoadedData={() => attemptPlay(false)}
        onCanPlay={() => attemptPlay(false)}
        onPlaying={() => {
          setIsBuffering(false);
          setNeedsUserTap(false);
        }}
        onWaiting={() => {
          if (!hasEndedRef.current) {
            setIsBuffering(true);
          }
        }}
        onEnded={handleVideoEnded}
        onError={finishIntro}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Subtle Loading Indicator during Cold Live Network Buffering */}
      {isBuffering && !needsUserTap && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#162119]/80 border border-[#FAF6EE]/15 text-[#FAF6EE]/85 text-xs sm:text-sm font-medium backdrop-blur-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8DE0A5] animate-pulse" />
            <span>Loading Wildgrove Sanctuary...</span>
          </div>
        </div>
      )}

      {/* Fallback Play Button only if the browser strictly blocks even muted autoplay (e.g. Low Power Mode) */}
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
