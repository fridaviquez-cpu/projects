import catalog from "../data/courses.json";
import { courseStudy } from "./shared-study";

// Topic labels transcribed from the official department page's Topics section.
// These are scope evidence, not indexed lectures or mathematical verification.
export const ece210ScopeSource = {
  title: "Illinois ECE 210 — official topics and instructional objectives",
  url: "https://ece.illinois.edu/academics/courses/ece210",
  kind: "official",
  checkedAt: "2026-11-07T00:00:00.000Z",
};
const official210Topics = [
  "Signals and signal processing systems", "Analog linear time-invariant systems",
  "DC circuit analysis: KCL, KVL, dependent sources", "Capacitors and inductors",
  "Op-amp circuits", "Linear constant-coefficient differential equations",
  "Complex numbers and functions of a complex variable",
  "Impedance, phasors, and sinusoidal steady-state",
  "Frequency response and multi-frequency circuits", "Fourier series",
  "Fourier transform", "AM radio", "Convolution", "Impulse and impulse response",
  "Sampling theorem", "Stability", "Laplace transform and transfer function",
  "Laplace transform solution of differential equations", "Design of active filters",
];

const pilotTopics: Record<string, string[]> = {
  "310": ["Discrete-time linear systems", "Difference equations", "Convolution and impulse response", "Z-transform", "Transfer functions and stability", "Discrete-time Fourier transform (DTFT)", "Sampling and A/D, D/A conversion", "Interpolation and decimation", "FIR and IIR filter design", "Discrete Fourier transform (DFT)", "Fast Fourier transform (FFT)", "Spectral analysis"],
  "313": ["Probability spaces", "Conditional probability and independence", "Bayes' rule", "System reliability", "Random variables and distributions", "Functions of random variables", "Joint distributions", "Covariance and prediction", "Limit theorems", "Hypothesis testing and parameter estimation"],
  "329": ["Static and quasi-static electric fields", "Polarization, conduction and capacitance", "Magnetic fields", "Induction and inductance", "Maxwell's equations", "Electromagnetic waves in homogeneous media", "Transmission lines", "Time- and frequency-domain analysis", "Smith chart"],
  "330": ["Complex and reactive power", "Single- and three-phase circuits", "Magnetic circuits and transformers", "Energy conversion principles", "Electromechanical systems", "Synchronous and induction machines", "DC and single-phase machines", "Power electronics", "Distributed energy resources"],
  "333": ["Electric power grid", "Complex power", "Energy supply and demand", "Wind resources and turbines", "Solar and photovoltaic technologies", "Fuel cells", "Engineering economic analysis", "Energy storage", "Electricity markets", "Environmental impacts", "Electricity policy and regulation"],
  "340": ["Semiconductor crystals and energy bands", "Electrons and holes", "Doping", "Drift and diffusion", "Generation and recombination", "P-N junctions", "MOS field-effect transistors", "Bipolar junction transistors", "LEDs and photodetectors"],
  "342": ["Diode circuits", "MOSFETs and bipolar transistors", "DC bias analysis", "Small-signal amplifiers", "Gain and input/output resistance", "Frequency response", "CMOS logic", "Noise margins", "Propagation delay and power", "SPICE simulation"],
  "110": ["Charge, current, voltage, power and energy", "Ohm's law", "DC circuits, KCL and KVL", "Series and parallel circuits, voltage dividers", "Thevenin and Norton equivalents", "Nodal analysis", "Current-voltage characteristics", "Diodes, BJTs and MOSFETs", "CMOS digital logic", "Sensors", "Pulse-width modulation", "Photovoltaics"],
  "120": ["Binary and hexadecimal representation", "Signed integers and two's complement", "Binary arithmetic, carry and overflow", "Boolean algebra and Karnaugh maps", "Combinational logic, multiplexers and decoders", "Latches, flip-flops and registers", "Finite state machines", "Memory and addressability", "Von Neumann architecture", "LC-3 machine language and assembly", "Introduction to C and UNIX", "Parity and error correction"],
  "210": official210Topics,
  "220": ["LC-3 assembly, I/O, subroutines and calling conventions", "Runtime stack", "C programming and C-to-machine-code translation", "Functions, variable scope, storage and types", "Arrays and pointers", "Input/output", "Recursion", "Linked lists and trees", "Dynamic memory allocation", "Sorting algorithms", "Testing and debugging C", "Object-oriented programming concepts"],
};

export const courseScopeRegistry = catalog.map(course => ({
  courseId: course.id,
  title: course.title,
  description: course.description,
  prerequisites: course.prerequisites,
  academicTerm: null,
  // Unknown is deliberately distinct from excluded: metadata isn't exhaustive.
  unlistedTopicStatus: "unknown" as const,
  topics: pilotTopics[course.id] ?? [],
  sources: pilotTopics[course.id] ? [...course.sources, {
    ...ece210ScopeSource,
    title: `Illinois ECE ${course.id} — official topics and instructional objectives`,
    url: `https://ece.illinois.edu/academics/courses/ece${course.id}`,
  }, {
    title: `HKN ECE ${course.id} student course guide`,
    url: `https://wiki.hkn.illinois.edu/course%20wiki/ece%20course%20offerings/ece${course.id}/`,
    kind: "student guide", checkedAt: "2026-11-07T00:00:00.000Z",
  }] : course.sources,
  knowledgeCoverage: [...courseStudy(course.id).map(s=>`${s.title}: ${s.locator} (partial topic selection)`), ...(course.id === "210" ? ["Original series DC lesson", "Original complex magnitude lesson", "Original RC response lesson"] : [])],
  learningDepth: ["110","120","210","220"].includes(course.id) ? "Partial licensed shared instructional selections, three introductory lessons and numeric checks; gaps use general AI or private lecture excerpts. Not official lectures or complete course mastery." : pilotTopics[course.id] ? "Verified scope; general AI or student-selected private lecture excerpts. No scored diagnostics." : "Catalog metadata only",
  coverageStatus: pilotTopics[course.id] ? "Partially Supported" : "Catalog Only",
}));

export function courseScopeContext(courseId: string) {
  const entry = courseScopeRegistry.find(c => c.courseId === courseId);
  if (!entry) throw new Error("Unknown course");
  return entry;
}

export const scopePolicy = `Course scope, indexed knowledge coverage, and learning depth are separate.
Use the supplied official description and topic registry as course-scope evidence.
Never infer that a topic is outside the university course because BECE Bridge lacks lessons about it.
If inclusion cannot be established from the supplied evidence, say course scope is unknown, not excluded.
For topics without supplied instructional lessons, provide a helpful general AI explanation, explicitly labeled "General AI explanation — no course lecture retrieved".
Begin with a short "Course scope and evidence" section identifying whether the official sources establish inclusion.
Identify original BECE lesson-based portions separately from general explanations.
Official and HKN sources verify scope only. Shared instructional selections support only the claims actually present in them; do not attribute equations, proofs, examples or solutions to a lecture that was not retrieved.
Do not claim independent mathematical verification, instructor review, or current semester policies.
Do not generate ASCII circuit diagrams, HTML, SVG, or executable code for visualization; describe the model clearly in prose instead.`;
