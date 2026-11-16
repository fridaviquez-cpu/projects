import { motion } from 'framer-motion';
import { CREAM, EMBLEM, ORANGE, ease, usePhase } from './shared';

const TAGS = ['COURSES', 'PRIVATE LECTURES', 'CITED TUTOR', 'VISUALS'];

export function IntroScene() {
  const phase = usePhase([2600, 3600]);
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ y: '-100%', transition: { duration: 0.7, ease: [0.7, 0, 0.3, 1] } }}
      style={{ background: '#13284a' }}
    >
      <div className="absolute inset-0 grid-paper-dark" />
      <div className="relative flex items-center" style={{ gap: '4vmin' }}>
        <motion.img
          src={EMBLEM}
          alt=""
          style={{ width: '30vmin', height: '30vmin' }}
          initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.3 }}
        />
        <div>
          <div className="flex" style={{ gap: '3vmin' }}>
            {['BECE', 'Bridge'].map((w, wi) => (
              <div key={w} className="flex" style={{ overflow: 'hidden' }}>
                {w.split('').map((c, i) => (
                  <motion.span
                    key={i}
                    className="f-display"
                    style={{ color: wi ? ORANGE : CREAM, fontSize: '15vmin', lineHeight: 1, display: 'inline-block' }}
                    initial={{ y: '110%' }}
                    animate={{ y: 0 }}
                    transition={{ delay: 0.9 + (wi * 4 + i) * 0.05, duration: 0.6, ease }}
                  >
                    {c}
                  </motion.span>
                ))}
              </div>
            ))}
          </div>
          <motion.div
            style={{ height: '0.8vmin', background: ORANGE, transformOrigin: 'left', marginTop: '1.5vmin' }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.8, duration: 0.9, ease }}
          />
          <motion.div
            className="f-mono"
            style={{ color: '#9fb4d6', fontSize: '2.6vmin', letterSpacing: '0.3em', marginTop: '2.4vmin' }}
            initial={{ opacity: 0, y: 12 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease }}
          >
            FOR ILLINOIS ECE STUDENTS
          </motion.div>
          <div className="flex" style={{ gap: '1.4vmin', marginTop: '3vmin' }}>
            {TAGS.map((t, i) => (
              <motion.span
                key={t}
                className="f-mono"
                style={{ color: CREAM, border: '1px solid rgba(243,236,224,0.35)', borderRadius: '99px', padding: '0.8vmin 1.8vmin', fontSize: '1.8vmin', letterSpacing: '0.12em' }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={phase >= 2 ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: i * 0.12, type: 'spring', stiffness: 260, damping: 18 }}
              >
                {t}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
