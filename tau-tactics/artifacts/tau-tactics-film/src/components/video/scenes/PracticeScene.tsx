import { motion } from 'framer-motion';
import { Rise, Step, ease, sceneExit } from '../ui';
export function PracticeScene() {
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center" style={{ color: 'var(--ink)' }} exit={sceneExit}>
      <Step n="04" label="PRACTICE" />
      <Rise d={0.15} className="fd" style={{ fontSize: '4.4vw', fontWeight: 600, marginTop: '1vw' }}>A ready-made <span style={{ fontStyle: 'italic', color: 'var(--brown)' }}>study prompt.</span></Rise>
      <motion.div initial={{ opacity: 0, y: '5vh', scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.3, duration: 0.8, ease }}
        className="relative" style={{ width: '62vw', marginTop: '2.4vw', background: 'var(--ink)', color: 'var(--paper)', borderRadius: '1.4vw', padding: '2.2vw 2.6vw' }}>
        <div className="fm" style={{ fontSize: '1vw', letterSpacing: '0.2em', color: 'var(--gold-soft)' }}>PROMPT · BUILT FROM YOUR REFLECTION</div>
        <div className="fm" style={{ fontSize: '1.6vw', lineHeight: 1.5, marginTop: '0.9vw' }}>"Quiz me on SN1 vs SN2, one question at a time. Ask me to draw the arrows before you check my answer."</div>
        <motion.div className="fm absolute" initial={{ opacity: 0, scale: 1.6, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: -6 }} transition={{ delay: 1.2, duration: 0.35, ease }}
          style={{ right: '-2vw', bottom: '-2.2vw', background: 'var(--gold)', color: 'var(--ink)', padding: '0.7vw 1.3vw', borderRadius: '0.6vw', fontSize: '1.3vw', fontWeight: 600 }}>COPY → YOUR AI TOOL</motion.div>
      </motion.div>
      <Rise d={1.5} style={{ fontSize: '1.6vw', marginTop: '3.4vw', color: '#5a5040' }}>TAU Tactics writes the prompt. You bring the tool and the thinking.</Rise>
    </motion.div>
  );
}
