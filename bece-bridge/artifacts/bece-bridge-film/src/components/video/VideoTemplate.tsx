import { useEffect, useRef, type ComponentType } from 'react';
import {
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';

import { IntroScene } from './scenes/IntroScene';
import { DiscoverScene } from './scenes/DiscoverScene';
import { CiteScene } from './scenes/CiteScene';
import { GraphScene } from './scenes/GraphScene';
import { OutroScene } from './scenes/OutroScene';

export const SCENE_DURATIONS = {
  intro: 5250,
  discover: 6750,
  cite: 7900,
  graph: 6200,
  outro: 3900,
};

const SCENE_COMPONENTS: Record<string, ComponentType> = {
  intro: IntroScene,
  discover: DiscoverScene,
  cite: CiteScene,
  graph: GraphScene,
  outro: OutroScene,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

// Persistent progress trace: one owner (this layer), explicit width for every scene index.
const TRACE_WIDTH = ['0%', '25%', '50%', '75%', '100%'];

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.5;
    if (paused) {
      audio.pause();
      return;
    }
    if (lastSceneKeyRef.current !== currentSceneKey) {
      lastSceneKeyRef.current = currentSceneKey;
      const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
        audio.currentTime = targetTime;
      }
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas aspectRatio={VIDEO_ASPECT_RATIO} style={{ backgroundColor: 'var(--color-bg-light)' }}>
        <AnimatePresence mode="popLayout">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
        <div className="absolute left-0 right-0 bottom-0" style={{ height: '0.7vmin', background: 'rgba(59,120,216,0.25)', zIndex: 20 }}>
          <motion.div
            style={{ height: '100%', background: '#ff6a10' }}
            animate={{ width: TRACE_WIDTH[sceneIndex] ?? '0%' }}
            transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
          />
        </div>
        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
          preload="auto"
          autoPlay
          muted={muted}
        />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
