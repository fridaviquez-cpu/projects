import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
export const ease = [0.2, 0.7, 0.2, 1] as const;
export const sceneExit = { opacity: 0, scale: 1.03, transition: { duration: 0.45, ease } };
export function Rise({ d = 0, children, className = '', style }: { d?: number; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <motion.div className={className} style={style} initial={{ opacity: 0, y: '0.6em' }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d, duration: 0.7, ease }}>{children}</motion.div>;
}
export function Step({ n, label, dark }: { n: string; label: string; dark?: boolean }) {
  return <Rise className="fm" style={{ fontSize: '1.5vw', letterSpacing: '0.25em', color: dark ? 'var(--gold-soft)' : 'var(--brown)' }}>STEP {n} · {label}</Rise>;
}
export function Rule({ d = 0, dark }: { d?: number; dark?: boolean }) {
  return <motion.div style={{ height: 2, width: '30vw', transformOrigin: 'left', background: `linear-gradient(90deg, ${dark ? 'var(--gold)' : 'var(--brown)'}, transparent)` }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: d, duration: 0.9, ease }} />;
}
