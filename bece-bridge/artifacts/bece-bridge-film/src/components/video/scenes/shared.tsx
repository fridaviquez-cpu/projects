import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';

export const NAVY = '#13284a';
export const ORANGE = '#ff6a10';
export const BLUE = '#3b78d8';
export const CREAM = '#f3ece0';
export const EMBLEM = `${import.meta.env.BASE_URL}images/kingfisher-emblem.svg`;

export const ease = [0.2, 0.7, 0.2, 1] as const;

/** Returns the index of the latest phase whose time has passed. */
export function usePhase(times: number[]) {
  const [phase, setPhase] = useState(0);
  useSceneTimer(times.map((time, i) => ({ time, callback: () => setPhase(i + 1) })));
  return phase;
}

export function Caption({ kicker, lines, tone = 'dark' }: { kicker: string; lines: string[]; tone?: 'dark' | 'light' }) {
  const color = tone === 'dark' ? NAVY : CREAM;
  return (
    <div>
      <motion.div
        className="f-mono"
        style={{ color: ORANGE, fontSize: '1.9vmin', letterSpacing: '0.35em', marginBottom: '2vmin' }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        {kicker}
      </motion.div>
      {lines.map((l, i) => (
        <div key={l} style={{ overflow: 'hidden' }}>
          <motion.div
            className="f-display"
            style={{ color, fontSize: '7.4vmin', lineHeight: 1.0 }}
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, delay: 0.12 + i * 0.12, ease }}
          >
            {l}
          </motion.div>
        </div>
      ))}
    </div>
  );
}

export const sceneExit = { opacity: 0, x: '-6vw', transition: { duration: 0.5, ease } };
