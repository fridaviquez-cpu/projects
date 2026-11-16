import { motion } from 'framer-motion';
import { BLUE, Caption, NAVY, ORANGE, ease, usePhase } from './shared';

const W = 600;
const H = 320;
const TAUS = [0.5, 1.0, 2.0];

function curve(tau: number) {
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * 6;
    const v = 1 - Math.exp(-t / tau);
    pts.push(`${i === 0 ? 'M' : 'L'}${((t / 6) * W).toFixed(1)},${(H - v * (H - 30)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const SAVED = ['Step response · τ sweep', 'Pole location notes', 'Laplace pairs cheat sheet'];

export function GraphScene() {
  const phase = usePhase([1200, 2300, 3400]);
  const tauIdx = Math.min(phase, 2);
  const tau = TAUS[tauIdx];
  return (
    <motion.div
      className="absolute inset-0 grid-paper"
      initial={{ scale: 1.1, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <div className="absolute flex flex-col justify-center" style={{ left: '7vw', top: 0, bottom: 0, width: '32vw' }}>
        <Caption kicker="04 — VISUALIZE" lines={phase >= 3 ? ['Save what', 'clicks.'] : ['Tune the', 'visual.']} key={phase >= 3 ? 's' : 't'} />
      </div>
      <motion.div
        className="panel absolute"
        style={{ left: '42vw', top: '13vh', width: '40vw', padding: '3vmin' }}
        animate={{ x: phase >= 3 ? '-3vw' : 0 }}
        transition={{ duration: 0.6, ease }}
      >
        <div className="flex justify-between items-baseline">
          <div className="f-display" style={{ fontSize: '3vmin', color: NAVY, fontWeight: 600 }}>RC step response</div>
          <div className="f-mono" style={{ fontSize: '1.8vmin', color: BLUE }}>v(t) = 1 − e^(−t/τ)</div>
        </div>
        <svg viewBox={`-10 0 ${W + 20} ${H + 10}`} style={{ width: '100%', marginTop: '2vmin' }}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1="0" x2={W} y1={H - f * (H - 30)} y2={H - f * (H - 30)} stroke="rgba(19,40,74,0.1)" />
          ))}
          <line x1="0" x2={W} y1={H} y2={H} stroke={NAVY} strokeWidth="2" />
          <line x1="0" x2="0" y1="10" y2={H} stroke={NAVY} strokeWidth="2" />
          <motion.path
            d={curve(tau)}
            fill="none"
            stroke={ORANGE}
            strokeWidth="5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1, d: curve(tau) }}
            transition={{ pathLength: { duration: 1, ease }, d: { duration: 0.7, ease } }}
          />
        </svg>
        <div style={{ marginTop: '2.4vmin' }}>
          <div className="flex justify-between f-mono" style={{ fontSize: '1.8vmin', color: NAVY }}>
            <span>τ = RC</span>
            <span style={{ color: ORANGE, fontWeight: 500 }}>{tau.toFixed(1)} ms</span>
          </div>
          <div style={{ position: 'relative', height: '0.8vmin', background: 'rgba(19,40,74,0.12)', borderRadius: 99, marginTop: '1.4vmin' }}>
            <motion.div
              style={{ position: 'absolute', top: '50%', width: '3vmin', height: '3vmin', marginTop: '-1.5vmin', marginLeft: '-1.5vmin', borderRadius: 99, background: NAVY, border: `0.5vmin solid ${ORANGE}` }}
              animate={{ left: `${(tauIdx / 2) * 80 + 10}%` }}
              transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            />
          </div>
        </div>
      </motion.div>
      <div className="absolute" style={{ left: '78vw', top: '30vh', width: '18vw' }}>
        {SAVED.map((s, i) => (
          <motion.div
            key={s}
            className="panel"
            style={{ padding: '1.8vmin', marginBottom: '1.4vmin', borderLeft: `0.7vmin solid ${i ? BLUE : ORANGE}` }}
            initial={{ opacity: 0, y: -60, rotate: -4 }}
            animate={phase >= 3 ? { opacity: 1, y: 0, rotate: 0 } : {}}
            transition={{ delay: i * 0.12, type: 'spring', stiffness: 200, damping: 18 }}
          >
            <div className="f-mono" style={{ fontSize: '1.4vmin', color: '#4a5a75', letterSpacing: '0.15em' }}>{i ? 'SAVED' : 'JUST SAVED'}</div>
            <div style={{ fontSize: '2vmin', color: NAVY, fontWeight: 600, marginTop: '0.4vmin' }}>{s}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
