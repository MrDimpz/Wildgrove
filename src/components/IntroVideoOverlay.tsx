/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { SkipForward, Volume2, VolumeX } from 'lucide-react';

interface IntroVideoOverlayProps {
  onComplete: () => void;
}

const INTRO_VIDEO_SRC = '/assets/aistudio/gemini_generated_video_dd358b0e_1b0a2e95.mp4';
const POST_VIDEO_HOLD_MS = 3000;

export function IntroVideoOverlay({ onComplete }: IntroVideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  const finishIntro = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setFadingOut(true);
    fadeTimerRef.current = window.setTimeout(() => {
      onComplete();
    }, 320);
  }, [onComplete]);

  const handleVideoEnded = useCallback(() => {
    if (completedRef.current || holdTimerRef.current !== null) return;
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      finishIntro();
    }, POST_VIDEO_HOLD_MS);
  }, [finishIntro]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
      }
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    video.muted = false;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Browser blocked unmuted autoplay: immediately fall back to muted autoplay so the video plays right away
        if (!videoRef.current) return;
        videoRef.current.muted = true;
        setMuted(true);
        void videoRef.current.play().catch(() => {
          // If playback is completely disallowed, gracefully advance to the title screen
          finishIntro();
        });
      });
    }
  }, [finishIntro]);

  const handleToggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
    if (video.paused && !video.ended) {
      void video.play().catch(() => {});
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
        playsInline
        autoPlay
        preload="auto"
        onEnded={handleVideoEnded}
        onError={finishIntro}
        className="w-full h-full object-contain"
      />

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
