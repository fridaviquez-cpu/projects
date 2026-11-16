import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { VideoCanvas, VideoPausedContext, type VideoAspectRatio, useVideoPlayer } from '@/lib/video';
import { OpenScene } from './scenes/OpenScene';
import { PlanScene } from './scenes/PlanScene';
import { FocusScene } from './scenes/FocusScene';
import { RestScene } from './scenes/RestScene';
import { ReflectScene } from './scenes/ReflectScene';
import { PracticeScene } from './scenes/PracticeScene';
import { EndScene } from './scenes/EndScene';

export const SCENE_DURATIONS = {
  open: 4750,
  plan: 5450,
  focus: 5450,
  rest: 3450,
  reflect: 4500,
  practice: 2900,
  end: 3500,
};
const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';
const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  open: OpenScene, plan: PlanScene, focus: FocusScene, rest: RestScene, reflect: ReflectScene, practice: PracticeScene, end: EndScene,
};
const BG = ['#0b0a08', '#f1ebdc', '#0b0a08', '#1a2033', '#f1ebdc', '#ece4cf', '#0b0a08'];
const STEPS = ['Plan', 'Focus', 'Reflect', 'Practice', 'Improve'];
const STEP_FOR = [-1, 0, 1, 1, 2, 3, -1];
const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {}; let c = 0;
  for (const [k, ms] of Object.entries(SCENE_DURATIONS)) { out[k] = c / 1000; c += ms; }
  return out;
})();

export default function VideoTemplate({
  durations = SCENE_DURATIONS, loop = true, paused = false, muted = false, onSceneChange,
}: { durations?: Record<string, number>; loop?: boolean; paused?: boolean; muted?: boolean; onSceneChange?: (k: string) => void } = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  useEffect(() => { onSceneChange?.(currentSceneKey); }, [currentSceneKey, onSceneChange]);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Math.max(0, Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey));
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];
  const dark = [0, 2, 3, 6].includes(sceneIndex);
  const step = STEP_FOR[sceneIndex];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    a.volume = 0.5;
    if (paused) { a.pause(); return; }
    if (lastKey.current !== currentSceneKey) {
      lastKey.current = currentSceneKey;
      const t = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(a.currentTime - t) > 0.18) a.currentTime = t;
    }
    a.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas aspectRatio={VIDEO_ASPECT_RATIO} style={{ backgroundColor: '#0b0a08' }}>
        <motion.div className="absolute inset-0" animate={{ backgroundColor: BG[sceneIndex] }} transition={{ duration: 0.6 }} />
        <motion.div className="absolute inset-0 pointer-events-none" animate={{ opacity: dark ? 1 : 0.5 }}
          style={{ background: 'radial-gradient(circle at 85% -10%, rgba(212,175,55,.22), transparent 45%)' }} />
        <motion.div className="absolute left-0 right-0 flex justify-center" style={{ top: '4.5vh', gap: '2.2vw', zIndex: 20 }}
          animate={{ opacity: step >= 0 ? 1 : 0, y: step >= 0 ? 0 : -20 }} transition={{ duration: 0.5 }}>
          {STEPS.map((s, i) => (
            <div key={s} className="fm flex items-center" style={{ gap: '0.6vw', fontSize: '1vw', letterSpacing: '0.2em', color: dark ? 'var(--paper)' : 'var(--ink)', opacity: i === step ? 1 : i < step ? 0.6 : 0.3 }}>
              <motion.span animate={{ scale: i === step ? 1.3 : 1 }} style={{ width: '0.7vw', height: '0.7vw', borderRadius: 999, background: i <= step ? 'var(--gold)' : 'transparent', border: '1.5px solid var(--gold)' }} />
              {s.toUpperCase()}
            </div>
          ))}
        </motion.div>
        <AnimatePresence mode="popLayout">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
        <div className="grain" />
        <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`} preload="auto" autoPlay muted={muted} />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
