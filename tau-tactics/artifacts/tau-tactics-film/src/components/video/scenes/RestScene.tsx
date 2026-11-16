import { motion } from 'framer-motion';
import { Leo } from '../Leo';
import { Rise, ease, sceneExit } from '../ui';
export function RestScene() {
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center" style={{ gap: '5vw', color: 'var(--paper)' }} exit={sceneExit}>
      <motion.div style={{ width: '32vw', height: '32vw' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease }}><Leo mode="rest" /></motion.div>
      <div>
        <Rise className="fm" style={{ fontSize: '1.5vw', letterSpacing: '0.25em', color: 'var(--gold-soft)' }}>BREAK · 10:00</Rise>
        <Rise d={0.3} className="fd" style={{ fontSize: '5.6vw', lineHeight: 1.02, fontWeight: 600, marginTop: '1.2vw' }}>Breaks are<br /><span style={{ fontStyle: 'italic', color: 'var(--gold-soft)' }}>part of the work.</span></Rise>
        <Rise d={0.9} style={{ fontSize: '1.8vw', marginTop: '1.6vw', opacity: 0.75 }}>Leo rests too. Stand up, stretch, come back sharp.</Rise>
      </div>
    </motion.div>
  );
}
