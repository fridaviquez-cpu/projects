import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Rise, Step, ease, sceneExit } from '../ui';
function Chip({ on, children }: { on: boolean; children: string }) {
  return <motion.div className="fm" animate={{ scale: on ? 1.06 : 1 }} transition={{ duration: 0.35, ease }} style={{ padding: '0.7vw 1.4vw', borderRadius: 999, fontSize: '1.5vw', border: '2px solid', borderColor: on ? 'var(--ink)' : '#d5cbb2', background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--gold-soft)' : '#5a5040' }}>{children}</motion.div>;
}
export function PlanScene() {
  const [focus, setFocus] = useState(25); const [brk, setBrk] = useState(5);
  useSceneTimer([{ time: 2200, callback: () => setFocus(45) }, { time: 3200, callback: () => setBrk(10) }]);
  return (
    <motion.div className="absolute inset-0 flex items-center" style={{ padding: '0 7vw', gap: '5vw', color: 'var(--ink)' }} exit={sceneExit}>
      <div style={{ flex: 1 }}>
        <Step n="01" label="PLAN" />
        <Rise d={0.3} className="fd" style={{ fontSize: '6.4vw', lineHeight: 1, fontWeight: 600, marginTop: '1.5vw' }}>Set the rhythm<br /><span style={{ fontStyle: 'italic', color: 'var(--brown)' }}>that fits you.</span></Rise>
        <Rise d={0.8} style={{ fontSize: '1.9vw', marginTop: '2vw', color: '#5a5040', maxWidth: '32vw' }}>Pick a subject, a focus length and a break. Your plan, your pace.</Rise>
      </div>
      <motion.div initial={{ opacity: 0, y: '6vh', rotate: 3 }} animate={{ opacity: 1, y: 0, rotate: -1.5 }} transition={{ delay: 0.4, duration: 1, ease }}
        style={{ width: '40vw', background: '#fbf8ef', borderRadius: '1.6vw', padding: '2.6vw', boxShadow: '0 3vw 5vw -2vw rgba(60,40,0,.35)', border: '1px solid #ddd2b8' }}>
        <div className="fm" style={{ fontSize: '1.1vw', letterSpacing: '0.2em', color: '#8a7a5a' }}>TODAY'S PLAN</div>
        <div className="fd" style={{ fontSize: '2.8vw', fontWeight: 600, marginTop: '0.6vw' }}>Organic Chemistry</div>
        <div style={{ height: 1, background: '#e3d8bd', margin: '1.6vw 0' }} />
        <div className="fm" style={{ fontSize: '1.1vw', color: '#8a7a5a', letterSpacing: '0.15em' }}>FOCUS</div>
        <div className="flex" style={{ gap: '0.8vw', marginTop: '0.8vw' }}>{[25, 45, 50].map(m => <Chip key={m} on={focus === m}>{`${m} min`}</Chip>)}</div>
        <div className="fm" style={{ fontSize: '1.1vw', color: '#8a7a5a', letterSpacing: '0.15em', marginTop: '1.6vw' }}>BREAK</div>
        <div className="flex" style={{ gap: '0.8vw', marginTop: '0.8vw' }}>{[5, 10, 15].map(m => <Chip key={m} on={brk === m}>{`${m} min`}</Chip>)}</div>
        <div className="fm" style={{ marginTop: '2vw', padding: '1vw', borderRadius: '0.8vw', background: 'var(--ink)', color: 'var(--gold-soft)', fontSize: '1.4vw', textAlign: 'center' }}>3 blocks · {focus} / {brk}</div>
      </motion.div>
    </motion.div>
  );
}
