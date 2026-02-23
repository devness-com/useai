'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HeroHeadingProps {
  /** Called once all entrance animations have finished so the parent can fade-in subtitle / CTA. */
  onAnimationComplete?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Each entry becomes its own line in the heading. */
const TYPEWRITER_LINES = ['YOUR COMPLETE', 'STORY OF'];
const GLITCH_LINE = 'USING AI';
const FULL_TEXT = [...TYPEWRITER_LINES, GLITCH_LINE].join(' ');

/** Per-character stagger (seconds) */
const CHAR_STAGGER = 0.03;
/** Delay before the typewriter begins */
const TYPEWRITER_DELAY = 0.3;
/** Total character count across all typewriter lines (including spaces) */
const TYPEWRITER_CHAR_COUNT = TYPEWRITER_LINES.join(' ').length;
/** Total typewriter duration */
const TYPEWRITER_DURATION = TYPEWRITER_CHAR_COUNT * CHAR_STAGGER;
/** When USING AI starts its entrance (after typewriter finishes) */
const GLITCH_ENTRANCE_DELAY = TYPEWRITER_DELAY + TYPEWRITER_DURATION + 0.15;
/** How long the speed trails linger after the text lands (ms) */
const SPEED_TRAIL_MS = 800;
/** Pause (ms) after the full cycle before restarting */
const LOOP_PAUSE_MS = 2500;
/** Fade-out duration (ms) before restart */
const FADE_OUT_MS = 600;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HeroHeading({ onAnimationComplete }: HeroHeadingProps) {
  const prefersReduced = useReducedMotion();
  const [speedTrails, setSpeedTrails] = useState(false);
  const [settled, setSettled] = useState(false);
  const [loopKey, setLoopKey] = useState(0);
  const [fading, setFading] = useState(false);
  const [completedOnce, setCompletedOnce] = useState(false);

  const restartLoop = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setSpeedTrails(false);
      setSettled(false);
      setFading(false);
      setLoopKey((k) => k + 1);
    }, FADE_OUT_MS);
  }, []);

  const handleSpeedEntrance = useCallback(() => {
    // Show speed trails as soon as the text lands
    setSpeedTrails(true);
    setTimeout(() => {
      setSpeedTrails(false);
      setSettled(true);
      if (!completedOnce) {
        setCompletedOnce(true);
        onAnimationComplete?.();
      }
      setTimeout(restartLoop, LOOP_PAUSE_MS);
    }, SPEED_TRAIL_MS);
  }, [onAnimationComplete, completedOnce, restartLoop]);

  // For reduced-motion: fire completion immediately after mount
  useEffect(() => {
    if (prefersReduced) {
      const t = setTimeout(() => onAnimationComplete?.(), 400);
      return () => clearTimeout(t);
    }
  }, [prefersReduced, onAnimationComplete]);

  /* ── Reduced-motion: simple fade ── */
  if (prefersReduced) {
    return (
      <h1
        aria-label={FULL_TEXT}
        className="text-5xl sm:text-6xl md:text-7xl lg:text-7xl font-black tracking-tight text-text-primary leading-[1.05] sm:leading-[1.1] mb-5"
      >
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {TYPEWRITER_LINES.map((line, i) => (
            <span key={i}>
              {line}
              {i < TYPEWRITER_LINES.length - 1 && <br />}
            </span>
          ))}
        </motion.span>
        <br />
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="gradient-text-accent italic inline-block pr-6 text-6xl sm:text-7xl md:text-8xl lg:text-8xl"
        >
          {GLITCH_LINE}
        </motion.span>
      </h1>
    );
  }

  /* ── Full animation ── */
  return (
    <h1
      aria-label={FULL_TEXT}
      className="text-5xl sm:text-6xl md:text-7xl lg:text-7xl font-black tracking-tight text-text-primary italic leading-[1.05] sm:leading-[1.1] mb-5"
    >
      <span
        key={loopKey}
        style={{
          opacity: fading ? 0 : 1,
          transition: `opacity ${FADE_OUT_MS}ms ease-out`,
          display: 'inline',
        }}
      >
        {/* Typewriter lines — per-character blur→sharp, with explicit <br> between lines */}
        <motion.span
          aria-hidden
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: CHAR_STAGGER, delayChildren: TYPEWRITER_DELAY } },
          }}
          className="inline"
        >
          {TYPEWRITER_LINES.map((line, li) => (
            <span key={li} style={{ whiteSpace: 'nowrap' }} className="inline-block">
              {line.split(' ').map((word, wi, words) => (
                <span key={wi} className="inline">
                  <span style={{ display: 'inline-block' }}>
                    {word.split('').map((char, ci) => (
                      <motion.span
                        key={`${li}-${wi}-${ci}`}
                        variants={{
                          hidden: { opacity: 0, filter: 'blur(8px)' },
                          visible: {
                            opacity: 1,
                            filter: 'blur(0px)',
                            transition: { duration: 0.15, ease: 'easeOut' },
                          },
                        }}
                        className="inline-block"
                      >
                        {char}
                      </motion.span>
                    ))}
                  </span>
                  {wi < words.length - 1 && (
                    <motion.span
                      key={`space-${li}-${wi}`}
                      variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1, transition: { duration: 0.01 } },
                      }}
                      className="inline"
                    >
                      {' '}
                    </motion.span>
                  )}
                </span>
              ))}
              {li < TYPEWRITER_LINES.length - 1 && <br />}
            </span>
          ))}
        </motion.span>

        <br />

        {/* Speed line — "USING AI" rushes in from the left */}
        <span className="relative block overflow-visible">
          <motion.span
            aria-hidden
            initial={{ opacity: 0, x: '-100vw' }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: GLITCH_ENTRANCE_DELAY,
              duration: 0.35,
              ease: [0.0, 0.0, 0.1, 1],
            }}
            onAnimationComplete={handleSpeedEntrance}
            className={`gradient-text-accent italic inline-block pr-6 text-6xl sm:text-7xl md:text-8xl lg:text-8xl ${
              speedTrails ? 'speed-shake' : ''
            } ${settled ? 'hero-glow-settled' : ''}`}
          >
            {GLITCH_LINE}
          </motion.span>
          {/* Speed trail lines */}
          {speedTrails && (
            <span className="speed-trails" aria-hidden>
              <span className="speed-line speed-line-1" />
              <span className="speed-line speed-line-2" />
              <span className="speed-line speed-line-3" />
              <span className="speed-line speed-line-4" />
              <span className="speed-line speed-line-5" />
              <span className="speed-line speed-line-6" />
              <span className="speed-line speed-line-7" />
            </span>
          )}
          {/* Motion blur ghost that fades quickly */}
          {speedTrails && (
            <span className="speed-blur-ghost" aria-hidden>
              <span className="gradient-text-accent italic inline-block pr-6 text-6xl sm:text-7xl md:text-8xl lg:text-8xl">
                {GLITCH_LINE}
              </span>
            </span>
          )}
        </span>
      </span>
    </h1>
  );
}
