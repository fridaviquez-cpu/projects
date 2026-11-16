import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Leo } from '../Leo';
import { Rise, Rule, ease } from '../ui';
export function EndScene() {
  const [p, setP] = useState(0);
  useSceneTimer([{ time: 1500, callback: () => setP(1) }]);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center" style={{ color: 'var(--paper)' }} exit={{ opacity: 0, transition: { duration: 0.4 } }}>
      <AnimatePresence mode="wait">{p === 0 ? (
        <motion.div key="a" className="flex flex-col items-center" exit={{ opacity: 0 }}>
          <Rise className="fm" style={{ fontSize: '1.5vw', letterSpacing: '0.25em', color: 'var(--gold-soft)' }}>STEP 05 · IMPROVE</Rise>
          <Rise d={0.2} className="fd" style={{ fontSize: '6vw', fontWeight: 600, marginTop: '1vw' }}>Better sessions, <span style={{ fontStyle: 'italic', color: 'var(--gold-soft)' }}>not longer ones.</span></Rise>
        </motion.div>
      ) : (
        <motion.div key="b" className="flex flex-col items-center" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease }}>
          <div style={{ width: '9vw', height: '9vw' }}><Leo mode="idle" /></div>
          <div className="fd" style={{ fontSize: '6.2vw', fontWeight: 600, lineHeight: 1.05, textAlign: 'center', marginTop: '1vw' }}>Study intentionally.<br /><span style={{ fontStyle: 'italic', color: 'var(--gold)' }}>Learn independently.</span></div>
          <div style={{ marginTop: '1.6vw' }}><Rule d={0.3} dark /></div>
          <div className="fm" style={{ fontSize: '1.3vw', letterSpacing: '0.35em', marginTop: '1.2vw', color: 'var(--gold-soft)' }}>TAU TACTICS</div>
        </motion.div>
      )}</AnimatePresence>
    </motion.div>
  );
}
