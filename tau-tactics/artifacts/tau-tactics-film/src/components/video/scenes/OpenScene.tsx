import { motion } from 'framer-motion';
import { Rise, Rule, ease, sceneExit } from '../ui';
export function OpenScene() {
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center" style={{ color: 'var(--paper)' }} exit={sceneExit}>
      <motion.div className="flex flex-col items-center" initial={{ scale: 0.94 }} animate={{ scale: 1.04 }} transition={{ duration: 4.8, ease: 'linear' }}>
        <Rise className="fm" style={{ fontSize: '1.4vw', letterSpacing: '0.4em', color: 'var(--gold-soft)' }} d={0.2}>A STUDY COMPANION</Rise>
        <div className="fd flex items-baseline" style={{ fontSize: '15vw', lineHeight: 1, fontWeight: 700, marginTop: '1vw' }}>
          {'TAU'.split('').map((c, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: '0.4em', rotate: -6 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.4 + i * 0.12, duration: 0.8, ease }}>{c}</motion.span>
          ))}
          <motion.span className="fd" style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--gold)', marginLeft: '2vw', fontSize: '0.7em' }} initial={{ opacity: 0, x: '-0.3em' }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.1, duration: 0.9, ease }}>Tactics</motion.span>
        </div>
        <div style={{ marginTop: '1.5vw' }}><Rule d={1.6} dark /></div>
        <Rise d={2.0} className="fd" style={{ fontSize: '3vw', marginTop: '1.8vw', fontStyle: 'italic', color: 'var(--paper)' }}>Study with a plan, not pressure.</Rise>
      </motion.div>
    </motion.div>
  );
}
