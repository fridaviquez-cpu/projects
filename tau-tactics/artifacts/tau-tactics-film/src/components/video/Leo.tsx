// Adapted from TAU Tactics StudyCompanion Lion (level 2 artwork).
type Mode = 'focus' | 'rest' | 'idle';
export function Leo({ mode, level = 2 }: { mode: Mode; level?: number }) {
  const mane = ['#c9a96a', '#d4a73a', '#c98f1c', '#b8740f'][level];
  const fur = ['#ead9b0', '#efd690', '#f0cf72', '#f2c95a'][level];
  const maneR = [58, 66, 74, 82][level];
  const spikes = [10, 14, 18, 22][level];
  const rest = mode === 'rest', focus = mode === 'focus';
  const pts = Array.from({ length: spikes }, (_, i) => {
    const a = (i / spikes) * Math.PI * 2, a2 = a + Math.PI / spikes;
    return `${120 + Math.cos(a) * maneR},${108 + Math.sin(a) * maneR} ${120 + Math.cos(a2) * (maneR - 16)},${108 + Math.sin(a2) * (maneR - 16)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 240 240" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <circle cx="120" cy="112" r="104" fill={rest ? '#2a3550' : '#d4af37'} opacity={rest ? 0.45 : 0.16} />
      {level >= 2 && !rest && Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <line key={i} x1={120 + Math.cos(a) * 92} y1={108 + Math.sin(a) * 92} x2={120 + Math.cos(a) * 104} y2={108 + Math.sin(a) * 104} stroke="#f0d78c" strokeWidth="3" strokeLinecap="round" opacity=".6" />; })}
      <g className="breathe">
        <path d={`M${70 - level * 6} 236 Q${74 - level * 4} 168 120 160 Q${166 + level * 4} 168 ${170 + level * 6} 236Z`} fill={fur} stroke="#6b4a12" strokeWidth="2" />
        <path d={`M${84 - level * 4} 236 Q90 182 120 176 Q150 182 ${156 + level * 4} 236Z`} fill="#0b0a08" />
        <path d="M106 196h28M120 196v26" stroke="#d4af37" strokeWidth="5" strokeLinecap="round" />
        <path d="M92 176 Q120 192 148 176 L144 186 Q120 200 96 186Z" fill="#d4af37" />
        <polygon points={pts} fill={mane} stroke="#6b4a12" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="120" cy="108" r={maneR - 14} fill={mane} />
        <circle cx="88" cy="74" r="12" fill={fur} stroke="#6b4a12" strokeWidth="2" /><circle cx="152" cy="74" r="12" fill={fur} stroke="#6b4a12" strokeWidth="2" />
        <circle cx="88" cy="74" r="5" fill="#d99a7a" /><circle cx="152" cy="74" r="5" fill="#d99a7a" />
        <ellipse cx="120" cy="112" rx="42" ry="44" fill={fur} stroke="#6b4a12" strokeWidth="2" />
        <ellipse cx="120" cy="132" rx="22" ry="16" fill="#fbf1d8" />
        {!rest && <><circle cx="96" cy="122" r="6" fill="#e8947a" opacity=".45" /><circle cx="144" cy="122" r="6" fill="#e8947a" opacity=".45" /></>}
        {rest ? (<><path d="M98 106 q8 7 16 0" stroke="#2b1d08" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M126 106 q8 7 16 0" stroke="#2b1d08" strokeWidth="3" fill="none" strokeLinecap="round" /></>) : (<>
          <ellipse cx="105" cy="104" rx="5.5" ry={focus ? 5 : 6.5} fill="#2b1d08" /><ellipse cx="135" cy="104" rx="5.5" ry={focus ? 5 : 6.5} fill="#2b1d08" />
          <circle cx="107" cy="102" r="1.8" fill="#fff8e6" /><circle cx="137" cy="102" r="1.8" fill="#fff8e6" />
          <path d={focus ? 'M96 92 l16 4 M144 92 l-16 4' : 'M97 93 q8 -5 16 0 M127 93 q8 -5 16 0'} stroke="#6b4a12" strokeWidth="2.5" fill="none" strokeLinecap="round" /></>)}
        <path d="M113 122 h14 l-7 8z" fill="#5a3410" />
        <path d={rest ? 'M114 138 q6 3 12 0' : 'M110 135 q10 10 20 0'} stroke="#5a3410" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {!rest && <g><circle cx="105" cy="104" r="11" fill="none" stroke="#0b0a08" strokeWidth="2.5" /><circle cx="135" cy="104" r="11" fill="none" stroke="#0b0a08" strokeWidth="2.5" /><path d="M116 104h8" stroke="#0b0a08" strokeWidth="2.5" /></g>}
        {focus && <g><path d="M84 222 l36 -10 36 10 v-28 l-36 -10 -36 10z" fill="#f5f1e6" stroke="#6b4a12" strokeWidth="2" /><path d="M120 212v-28" stroke="#6b4a12" strokeWidth="2" /><path d="M92 202 l20 -5 M92 210 l20 -5 M128 197 l20 5 M128 205 l20 5" stroke="#c9b48a" strokeWidth="1.5" /></g>}
        {rest && <g><rect x="104" y="196" width="32" height="30" rx="6" fill="#f5f1e6" stroke="#6b4a12" strokeWidth="2" /><path d="M136 204 q12 0 12 9 q0 9 -12 9" fill="none" stroke="#6b4a12" strokeWidth="2.5" /><path className="zz" d="M114 190 q-4 -6 0 -12 M126 190 q-4 -6 0 -12" stroke="#f0d78c" strokeWidth="2" fill="none" strokeLinecap="round" /></g>}
      </g>
      {rest && <text className="zz" x="172" y="56" fill="#f0d78c" fontFamily="Fraunces, serif" fontSize="22" fontStyle="italic">z</text>}
    </svg>
  );
}
