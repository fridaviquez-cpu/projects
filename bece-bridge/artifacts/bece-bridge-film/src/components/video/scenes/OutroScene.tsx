import { motion } from 'framer-motion';
import { CREAM, EMBLEM, ORANGE, ease } from './shared';

export function OutroScene() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: '#13284a' }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ duration: 0.7, ease: [0.7, 0, 0.3, 1] }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      <div className="absolute inset-0 grid-paper-dark" />
      <motion.img
        src={EMBLEM}
        alt=""
        style={{ width: '22vmin', height: '22vmin', position: 'relative' }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 120, damping: 14 }}
      />
      <motion.div
        className="f-display relative"
        style={{ fontSize: '13vmin', color: CREAM, lineHeight: 1, marginTop: '2vmin' }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.7, ease }}
      >
        BECE <span style={{ color: ORANGE }}>Bridge</span>
      </motion.div>
      <motion.div
        className="relative"
        style={{ height: '0.8vmin', width: '60vmin', background: ORANGE, transformOrigin: 'center', marginTop: '2.4vmin' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 1.4, duration: 0.8, ease }}
      />
      <motion.div
        className="relative f-display"
        style={{ fontSize: '4.6vmin', color: '#9fb4d6', marginTop: '2.6vmin', fontWeight: 500 }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.9, duration: 0.7, ease }}
      >
        Your bridge to success in ECE.
      </motion.div>
    </motion.div>
  );
}
