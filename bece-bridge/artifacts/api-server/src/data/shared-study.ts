// Text selections/adaptations © Wikibooks contributors, CC BY-SA 4.0.
// This content license is separate from the application's software license.
export const sharedLicense = "https://creativecommons.org/licenses/by-sa/4.0/";
export const permissionUrl = "https://en.wikibooks.org/w/index.php?title=Wikibooks:Copyrights&oldid=4622060";
export const checkedAt = "2026-11-07T00:00:00.000Z";
const wiki = "https://en.wikibooks.org/wiki/";
export const sharedStudy = [
  {
    id: "ohm", courses: ["110"], topics: ["Ohm's law"],
    title: "Electronics / Ohm's Law", url: wiki + "Electronics/Ohm%27s_Law",
    revisionUrl: "https://en.wikibooks.org/w/index.php?title=Electronics/Ohm%27s_Law&oldid=3142530",
    locator: "Web page: opening explanation and SUMMARY (unpaginated)",
    keywords: ["ohm", "ohms", "resistor", "resistance", "voltage", "current"],
    text: "Ohm's law describes the relationship between voltage, current, and resistance.\nVoltage and current are related such that voltage is equal to current times resistance:\nV=I⋅R\nCommon units used in electronics calculations are:\nV = mA × kΩ",
    changes: "Selected text; line breaks normalized. Applies to an ohmic resistor.",
  },
  {
    id: "gates", courses: ["120"], topics: ["Boolean algebra and Karnaugh maps", "Combinational logic, multiplexers and decoders"],
    title: "Digital Circuits / Logic Operations", url: wiki + "Digital_Circuits/Logic_Operations",
    revisionUrl: "https://en.wikibooks.org/w/index.php?title=Digital_Circuits/Logic_Operations&oldid=4666746",
    locator: "Web page sections: AND, OR, NOT, XOR and XNOR (unpaginated)",
    keywords: ["boolean", "logic", "gate", "gates", "xor", "xnor", "truth table"],
    text: "AND is 1 if and only if both inputs are 1. OR is 0 only if both inputs are 0. NOT reverses the input value. XOR is true only if exactly one of the inputs is one. XNOR is the inverted output of an XOR gate: it is true if both inputs are the same.",
    changes: "Condensed adaptation of the gate definitions; tables omitted. Does not cover multiplexers, decoders or Karnaugh maps.",
  },
  {
    id: "demorgan", courses: ["120"], topics: ["Boolean algebra and Karnaugh maps"],
    title: "Digital Circuits / Logic Operations", url: wiki + "Digital_Circuits/Logic_Operations",
    revisionUrl: "https://en.wikibooks.org/w/index.php?title=Digital_Circuits/Logic_Operations&oldid=4666746",
    locator: "Web page section: De Morgan's Law (unpaginated)",
    keywords: ["de morgan", "demorgan", "boolean", "nand", "nor", "complement", "negation"],
    text: "De Morgan's laws tell us: a NAND gate gives the same output as an OR gate with inputs complemented; a NOR gate gives the same output as an AND gate with inputs complemented.",
    changes: "Selected sentence with historical parenthesis removed. Karnaugh maps are not covered.",
  },
  {
    id: "phasor", courses: ["210"], topics: ["Complex numbers and functions of a complex variable", "Impedance, phasors, and sinusoidal steady-state"],
    title: "Circuit Theory / Phasors", url: wiki + "Circuit_Theory/Phasors",
    revisionUrl: "https://en.wikibooks.org/w/index.php?title=Circuit_Theory/Phasors&oldid=4093866",
    locator: "Web page sections: Cosine Convention and Phasor Math (unpaginated)",
    keywords: ["phasor", "phasors", "complex", "sinusoid", "sinusoidal", "polar", "rectangular", "magnitude"],
    text: "In this book, all phasors correspond to a cosine function, not a sine function. For multiplication, multiply magnitudes and add phase angles. For division, divide magnitudes and subtract phase angles. For addition or subtraction, use rectangular notation: add or subtract real parts and imaginary parts separately. Convert polar to rectangular using X=M cos(phi), Y=M sin(phi).",
    changes: "Condensed adaptation, equations rendered in plain text. Use a common frequency and a consistent peak or RMS convention. Phasors describe sinusoidal steady-state, not the complete transient response.",
  },
  {
    id: "impedance", courses: ["210"], topics: ["Impedance, phasors, and sinusoidal steady-state", "Capacitors and inductors"],
    title: "Circuit Theory / Phasors", url: wiki + "Circuit_Theory/Phasors",
    revisionUrl: "https://en.wikibooks.org/w/index.php?title=Circuit_Theory/Phasors&oldid=4093866",
    locator: "Web page section: Capacitor Terminal Equation, summary table (unpaginated)",
    keywords: ["impedance", "reactance", "capacitor", "inductor", "capacitors", "inductors", "angular frequency"],
    text: "The phasor voltage/current ratio for a resistor is R; for a capacitor it is 1/(j*omega*C); for an inductor it is j*omega*L. Here j is the imaginary unit and omega is angular frequency. These are the ideal-element impedances in sinusoidal steady-state.",
    changes: "Adapted from the terminal-relation summary table; notation normalized and ideal steady-state assumptions made explicit.",
  },
  {
    id: "pointers", courses: ["220"], topics: ["Arrays and pointers", "Functions, variable scope, storage and types"],
    title: "C programming / Pointers and arrays", url: wiki + "C_programming/Pointers_and_arrays",
    revisionUrl: "https://en.wikibooks.org/w/index.php?title=C_programming/Pointers_and_arrays&oldid=4666094",
    locator: "Web page sections: Declaring pointers and Pointer dereferencing (unpaginated)",
    keywords: ["pointer", "pointers", "dereference", "dereferencing", "address", "pass by value"],
    text: "To access a value to which a pointer points, the * operator is used. Another operator, the -> operator is used in conjunction with pointers to structures. Since C passes function arguments by value, in order to allow a function to modify a value from the calling routine, a pointer to the value must be passed.",
    changes: "Selected sentences from two sections, reordered. Dereferencing requires a valid pointer to an object whose lifetime has not ended.",
  },
  {
    id: "allocation", courses: ["220"], topics: ["Dynamic memory allocation", "Functions, variable scope, storage and types"],
    title: "C programming / Pointers and arrays", url: wiki + "C_programming/Pointers_and_arrays",
    revisionUrl: "https://en.wikibooks.org/w/index.php?title=C_programming/Pointers_and_arrays&oldid=4666094",
    locator: "Web page section: Assigning values to pointers (unpaginated)",
    keywords: ["malloc", "calloc", "allocation", "allocated", "dynamic memory", "lifetime", "local variable"],
    text: "The malloc function returns a pointer to dynamically allocated memory (or NULL if unsuccessful). When returning a pointer from a function, do not return a pointer that points to a value that is local to the function or that is a pointer to a function argument. Pointers to local variables become invalid when the function exits.",
    changes: "Selected sentences. The local-variable warning concerns automatic storage duration; static objects survive function return. Check allocation success before dereferencing and release allocated memory when no longer needed.",
  },
];
