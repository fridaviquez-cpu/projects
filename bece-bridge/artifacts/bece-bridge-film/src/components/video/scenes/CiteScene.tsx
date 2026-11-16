import { AnimatePresence, motion } from 'framer-motion';
import { BLUE, Caption, NAVY, ORANGE, ease, usePhase } from './shared';

const ANSWER = 'A pole at s = −a gives a decaying term e^(−at). Moving the pole further left makes the response settle faster.';

function Cite({ p, show }: { p: number; show: boolean }) {
  return (
    <motion.span
      className="f-mono"
      style={{ display: 'inline-block', background: ORANGE, color: NAVY, borderRadius: '0.5vmin', padding: '0.2vmin 1vmin', fontSize: '1.7vmin', marginLeft: '0.8vmin', fontWeight: 500 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={show ? { scale: 1, opacity: 1 } : {}}
      transition={{ type: 'spring', stiffness: 380, damping: 15 }}
    >
      p. {p}
    </motion.span>
  );
}

export function CiteScene() {
  const phase = usePhase([700, 2000, 2600, 4200, 4900]);
  const words = ANSWER.split(' ');
  return (
    <motion.div
      className="absolute inset-0 grid-paper"
      initial={{ x: '100vw' }}
      animate={{ x: 0 }}
      transition={{ duration: 0.75, ease }}
      exit={{ scale: 0.85, opacity: 0, transition: { duration: 0.5, ease } }}
    >
      <div className="absolute flex flex-col justify-center" style={{ left: '7vw', top: 0, bottom: 0, width: '34vw' }}>
        <AnimatePresence mode="wait">
          {phase < 4 ? (
            <motion.div key="a" exit={{ opacity: 0, y: -20 }}>
              <Caption kicker="02 — EXPLAIN" lines={['Answers', 'cite the page.']} />
            </motion.div>
          ) : (
            <motion.div key="b">
              <Caption kicker="03 — FOLLOW UP" lines={['Follow-ups', 'keep context.']} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="panel absolute" style={{ left: '45vw', top: '10vh', width: '48vw', height: '80vh', padding: '3vmin', overflow: 'hidden' }}>
        <div className="f-mono" style={{ fontSize: '1.6vmin', color: '#4a5a75', letterSpacing: '0.2em', borderBottom: '1px solid rgba(19,40,74,0.12)', paddingBottom: '1.4vmin' }}>
          TUTOR · SOURCES: LEC14_LAPLACE.PDF
        </div>
        <motion.div
          animate={{ y: phase >= 4 ? '-14vh' : 0 }}
          transition={{ duration: 0.7, ease }}
        >
          <motion.div
            style={{ marginLeft: 'auto', width: 'fit-content', maxWidth: '80%', background: NAVY, color: '#f3ece0', borderRadius: '1.6vmin 1.6vmin 0.4vmin 1.6vmin', padding: '1.6vmin 2.2vmin', fontSize: '2.4vmin', marginTop: '2.4vmin' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5, ease }}
          >
            How does pole location change the step response?
          </motion.div>
          <div style={{ marginTop: '2.4vmin', fontSize: '2.5vmin', color: NAVY, lineHeight: 1.45, maxWidth: '92%' }}>
            {words.map((w, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0 }}
                animate={phase >= 1 ? { opacity: 1 } : {}}
                transition={{ delay: i * 0.055, duration: 0.2 }}
              >
                {w}{' '}
              </motion.span>
            ))}
            <Cite p={14} show={phase >= 2} />
            <Cite p={17} show={phase >= 2} />
          </div>
          <motion.div
            className="flex items-center"
            style={{ gap: '2vmin', marginTop: '2.6vmin', background: 'rgba(59,120,216,0.08)', border: `1px solid ${BLUE}55`, borderRadius: '1vmin', padding: '1.6vmin' }}
            initial={{ opacity: 0, x: 60 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, ease }}
          >
            <div style={{ width: '7vmin', height: '9vmin', background: '#fff8ec', border: '1px solid rgba(19,40,74,0.2)', borderRadius: '0.4vmin', padding: '0.8vmin', display: 'flex', flexDirection: 'column', gap: '0.6vmin' }}>
              {[1, 0.8, 1, 0.6].map((w, i) => (
                <div key={i} style={{ height: '0.7vmin', width: `${w * 100}%`, background: i === 2 ? ORANGE : 'rgba(19,40,74,0.25)', borderRadius: 2 }} />
              ))}
            </div>
            <div>
              <div className="f-mono" style={{ fontSize: '1.6vmin', color: BLUE, letterSpacing: '0.15em' }}>LEC14 · PAGE 14</div>
              <div style={{ fontSize: '2.1vmin', color: NAVY, marginTop: '0.4vmin' }}>“Poles in the left half-plane yield decaying modes…”</div>
            </div>
          </motion.div>
          <motion.div
            style={{ marginLeft: 'auto', width: 'fit-content', background: NAVY, color: '#f3ece0', borderRadius: '1.6vmin 1.6vmin 0.4vmin 1.6vmin', padding: '1.6vmin 2.2vmin', fontSize: '2.4vmin', marginTop: '2.6vmin' }}
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 4 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease }}
          >
            So what if a = 0?
          </motion.div>
          <motion.div
            style={{ marginTop: '2vmin', fontSize: '2.5vmin', color: NAVY, lineHeight: 1.45, maxWidth: '92%' }}
            initial={{ opacity: 0 }}
            animate={phase >= 5 ? { opacity: 1 } : {}}
            transition={{ duration: 0.6 }}
          >
            Then the pole sits on the jω-axis — using the same lecture, the term never decays, so the output stays at a constant offset.
            <Cite p={18} show={phase >= 5} />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
