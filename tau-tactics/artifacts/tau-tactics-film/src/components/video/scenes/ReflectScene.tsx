import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Rise, Step, ease, sceneExit } from '../ui';
const TEXT = 'Mechanisms make sense when I draw the arrows first.';
export function ReflectScene() {
  const [n, setN] = useState(0); const [dots, setDots] = useState(0);
  useSceneTimer([...Array.from({ length: 26 }, (_, i) => ({ time: 900 + i * 70, callback: () => setN(Math.min(TEXT.length, (i + 1) * 2)) })),
    ...[1, 2, 3, 4].map(k => ({ time: 2900 + k * 180, callback: () => setDots(k) }))]);
  return (
    <motion.div className="absolute inset-0 flex items-center" style={{ padding: '0 7vw', gap: '5vw', color: 'var(--ink)' }} exit={sceneExit}>
      <motion.div initial={{ opacity: 0, x: '-6vw' }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9, ease }}
        style={{ width: '44vw', background: '#fbf8ef', borderRadius: '1.6vw', padding: '2.6vw', boxShadow: '0 3vw 5vw -2vw rgba(60,40,0,.35)', border: '1px solid #ddd2b8' }}>
        <div className="fm" style={{ fontSize: '1.1vw', letterSpacing: '0.2em', color: '#8a7a5a' }}>QUICK REFLECTION · BLOCK 1</div>
        <div className="fd" style={{ fontSize: '2.4vw', fontWeight: 600, marginTop: '1vw' }}>What clicked?</div>
        <div style={{ marginTop: '1vw', fontSize: '1.9vw', minHeight: '5.4vw', borderLeft: '3px solid var(--gold)', paddingLeft: '1vw', color: '#3a3226' }}>{TEXT.slice(0, n)}<span style={{ opacity: n < TEXT.length ? 1 : 0 }}>|</span></div>
        <div className="fd" style={{ fontSize: '2vw', fontWeight: 600, marginTop: '1.6vw' }}>How confident?</div>
        <div className="flex" style={{ gap: '0.8vw', marginTop: '0.8vw' }}>{[1, 2, 3, 4, 5].map(k => <motion.div key={k} animate={{ scale: k <= dots ? 1 : 0.8 }} style={{ width: '2.2vw', height: '2.2vw', borderRadius: 999, border: '2px solid var(--ink)', background: k <= dots ? 'var(--gold)' : 'transparent' }} />)}</div>
      </motion.div>
      <div style={{ flex: 1 }}>
        <Step n="03" label="REFLECT" />
        <Rise d={0.3} className="fd" style={{ fontSize: '5.6vw', lineHeight: 1.02, fontWeight: 600, marginTop: '1.4vw' }}>Two minutes.<br /><span style={{ fontStyle: 'italic', color: 'var(--brown)' }}>Honest notes.</span></Rise>
        <Rise d={0.8} style={{ fontSize: '1.8vw', marginTop: '1.6vw', color: '#5a5040' }}>Name what worked and what's still fuzzy.</Rise>
      </div>
    </motion.div>
  );
}
