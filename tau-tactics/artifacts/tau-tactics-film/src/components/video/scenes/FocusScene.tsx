import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Leo } from '../Leo';
import { Rise, Step, ease, sceneExit } from '../ui';
export function FocusScene() {
  const [s, setS] = useState(0);
  useSceneTimer(Array.from({ length: 5 }, (_, i) => ({ time: 600 + i * 1000, callback: () => setS(i + 1) })));
  const left = 45 * 60 - s - 1;
  const r = 44, C = 2 * Math.PI * r;
  return (
    <motion.div className="absolute inset-0 flex items-center" style={{ padding: '0 7vw', gap: '4vw', color: 'var(--paper)' }} exit={sceneExit}>
      <motion.div style={{ width: '30vw', height: '30vw' }} initial={{ opacity: 0, y: '10vh' }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }}><Leo mode="focus" /></motion.div>
      <div style={{ flex: 1 }}>
        <Step n="02" label="FOCUS" dark />
        <Rise d={0.3} className="fd" style={{ fontSize: '5.4vw', lineHeight: 1.02, fontWeight: 600, marginTop: '1.2vw' }}>Here with you.<br /><span style={{ fontStyle: 'italic', color: 'var(--gold-soft)' }}>No rush.</span></Rise>
        <Rise d={0.8} style={{ fontSize: '1.8vw', marginTop: '1.6vw', opacity: 0.75 }}>One block. One subject. Leo keeps you company.</Rise>
      </div>
      <motion.div className="relative" style={{ width: '24vw', height: '24vw' }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.9, ease }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(240,215,140,.15)" strokeWidth="3" />
          <motion.circle cx="50" cy="50" r={r} fill="none" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C * 0.02 }} animate={{ strokeDashoffset: C * 0.35 }} transition={{ duration: 5.4, ease: 'linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="fm" style={{ fontSize: '4.2vw', fontWeight: 500 }}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>
          <div className="fm" style={{ fontSize: '1vw', letterSpacing: '0.25em', color: 'var(--gold-soft)', marginTop: '0.4vw' }}>ORGANIC CHEM · 1/3</div>
        </div>
      </motion.div>
    </motion.div>
  );
}
