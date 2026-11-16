import { motion } from 'framer-motion';
import { BLUE, Caption, NAVY, ORANGE, ease, sceneExit, usePhase } from './shared';

const COURSES = [
  ['ECE 110', 'Intro to Electronics'],
  ['ECE 120', 'Intro to Computing'],
  ['ECE 210', 'Analog Signal Processing'],
  ['ECE 220', 'Computer Systems & Prog.'],
  ['ECE 310', 'Digital Signal Processing'],
  ['ECE 342', 'Electronic Circuits'],
];

export function DiscoverScene() {
  const phase = usePhase([1400, 2600, 4200]);
  return (
    <motion.div className="absolute inset-0 grid-paper" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={sceneExit}>
      <div className="absolute flex flex-col justify-center" style={{ left: '7vw', top: 0, bottom: 0, width: '36vw' }}>
        <Caption kicker="01 — DISCOVER" lines={['Find your course.', 'Bring your', 'own lectures.']} />
      </div>
      <div className="absolute" style={{ left: '47vw', top: '14vh', width: '46vw', height: '72vh' }}>
        <motion.div
          className="grid grid-cols-2"
          style={{ gap: '1.6vmin' }}
          animate={phase >= 2 ? { scale: 0.86, opacity: 0.35, y: '-4vh' } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease }}
        >
          {COURSES.map(([code, name], i) => {
            const active = i === 2 && phase >= 1;
            return (
              <motion.div
                key={code}
                className="panel"
                style={{ padding: '2.2vmin', background: active ? NAVY : undefined }}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0, scale: active ? 1.04 : 1 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.55, ease }}
              >
                <div className="f-mono" style={{ fontSize: '1.9vmin', color: active ? ORANGE : BLUE, letterSpacing: '0.1em' }}>{code}</div>
                <div className="f-display" style={{ fontSize: '2.8vmin', color: active ? '#f3ece0' : NAVY, marginTop: '0.6vmin', fontWeight: 600 }}>{name}</div>
              </motion.div>
            );
          })}
        </motion.div>
        <motion.div
          className="panel absolute"
          style={{ left: '4vw', right: '4vw', top: '22vh', padding: '3.2vmin' }}
          initial={{ opacity: 0, y: '30vh' }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : {}}
          transition={{ type: 'spring', stiffness: 110, damping: 17 }}
        >
          <div className="f-mono" style={{ fontSize: '1.7vmin', color: '#4a5a75', letterSpacing: '0.2em' }}>ECE 210 · UPLOAD LECTURE</div>
          <div className="flex items-center" style={{ gap: '2vmin', marginTop: '2vmin' }}>
            <div style={{ width: '6vmin', height: '7.5vmin', background: ORANGE, borderRadius: '0.6vmin', display: 'grid', placeItems: 'center' }}>
              <span className="f-mono" style={{ color: NAVY, fontSize: '1.6vmin', fontWeight: 500 }}>PDF</span>
            </div>
            <div style={{ flex: 1 }}>
              <div className="f-display" style={{ fontSize: '3.2vmin', color: NAVY, fontWeight: 600 }}>Lec14_Laplace_Transforms.pdf</div>
              <div style={{ height: '1vmin', background: 'rgba(19,40,74,0.1)', borderRadius: 99, marginTop: '1.2vmin', overflow: 'hidden' }}>
                <motion.div
                  style={{ height: '100%', background: BLUE, transformOrigin: 'left' }}
                  initial={{ scaleX: 0 }}
                  animate={phase >= 2 ? { scaleX: 1 } : {}}
                  transition={{ delay: 0.4, duration: 1.2, ease: 'easeInOut' }}
                />
              </div>
              <div className="f-mono" style={{ fontSize: '1.6vmin', color: '#4a5a75', marginTop: '0.8vmin' }}>38 pages · indexed for citations</div>
            </div>
          </div>
          <motion.div
            className="f-mono inline-flex items-center"
            style={{ marginTop: '2.4vmin', gap: '1vmin', background: NAVY, color: '#f3ece0', padding: '1vmin 2vmin', borderRadius: 99, fontSize: '1.8vmin', letterSpacing: '0.1em' }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={phase >= 3 ? { opacity: 1, scale: 1 } : {}}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
          >
            <svg width="1.8vmin" height="1.8vmin" viewBox="0 0 16 16" style={{ width: '1.8vmin', height: '1.8vmin' }}>
              <rect x="3" y="7" width="10" height="8" rx="1.5" fill={ORANGE} />
              <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke={ORANGE} strokeWidth="1.8" fill="none" />
            </svg>
            PRIVATE TO YOU
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
