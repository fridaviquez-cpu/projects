// Frozen persisted Markdown, following tutor-arithmetic.test.ts. Do not invoke
// the backend formatter: changes there must not rewrite historical fixtures.
export const arithmetic = "1/3 = 0.3333\n0.3333 * 3 = 0.9999\nx + 1 = 2";
export const units = "1000 [mV] = 1 [V]\n1 [V] = 1 [A]\n1 [dB] = 1 [dB]\n1 [kg*m^2*s^-3*A^-1*kg*m^2*s^-3*A^-1] = 1 [V*V]";
export const physicalDisclaimer = "This is not full mathematical or physical verification.";
export const literalMath = String.raw`\(1 + 1 = 2\)
\[
1000 [mV] = 1 [V]
\]
Keep $5 and $$ unchanged.`;
export const delimiterExamples = [
  String.raw`Before: \(1 + 1 = 2\).`,
  ["```arithmetic", literalMath, "```"].join("\n"),
  String.raw`Between: \[1000 = 1000\]`,
  ["~~~~units", literalMath, "~~~", "~~~~"].join("\n"),
  ["````text", literalMath, "```", "````"].join("\n"),
  String.raw`After: \(3 = 3\).`,
].join("\n\n");
export const unclosedDelimiterFence = ["```text", literalMath].join("\n");
// Inline spans use different delimiter lengths and include shorter backtick
// runs as literal content. Keep adjacent prose outside each code boundary.
export const inlineDelimiterExamples = [
  String.raw`Before: \(1 + 1 = 2\). ` +
    "`" + String.raw`\(x + 1\)` + "`" +
    String.raw` After: \(3 = 3\).`,
  String.raw`Before: \(4 = 4\). ` +
    "`" + String.raw`\[y = 2\]` + "`" +
    String.raw` After: \[5 = 5\]`,
  String.raw`Before: \(6 = 6\). ` +
    "``" + String.raw`\(a\) ` + "`literal`" + String.raw` \[b\]` + "``" +
    String.raw` After: \(7 = 7\).`,
  String.raw`Before: \(8 = 8\). ` +
    "```" + String.raw`\[c\] ` + "``literal``" + String.raw` \(d\)` + "```" +
    String.raw` After: \(9 = 9\).`,
].join("\n\n");
// Container prefixes are Markdown syntax, not part of the literal code payload.
// Keep the blank line and extra indentation in the payload to catch whitespace loss.
export const nestedLiteralMath = String.raw`\(1 + 1 = 2\)

  \[
  1000 [mV] = 1 [V]
  \]
Keep $5 and $$ unchanged.`;
const nestedFence = ["```text", nestedLiteralMath, "```"].join("\n");
const proseBefore = String.raw`Before: \(7 + 1 = 8\).`;
const proseAfter = String.raw`After: \[9 = 9\]`;
const prefixLines = (text: string, prefix: string) =>
  text.split("\n").map(line => `${prefix}${line}`).join("\n");
export const containerDelimiterExamples = {
  quotedDelimiters: prefixLines(
    [proseBefore, nestedFence, proseAfter].join("\n\n"), "> ",
  ),
  listedDelimiters: [
    `- ${proseBefore}`,
    prefixLines(nestedFence, "  "),
    `  ${proseAfter}`,
  ].join("\n\n"),
  quotedListDelimiters: prefixLines([
    `1. ${proseBefore}`,
    prefixLines(nestedFence, "   "),
    `   ${proseAfter}`,
  ].join("\n\n"), "> "),
  indentedDelimiters: [
    proseBefore,
    prefixLines(nestedLiteralMath, "    "),
    proseAfter,
  ].join("\n\n"),
};
export const unitDisclaimer = "This does not verify equation choice, physical assumptions or physical correctness.";
export const mixed = `**Arithmetic check: mismatch detected.** 1 passed; 1 mismatched; 1 unchecked marked calculations.

Calculation 2: recomputed value 1.00000000000. Do not rely on the displayed result. Possible reuse of rounded values from calculation(s) 1; compared using their unrounded numeric values.

**Unchecked:** all other math, unmatched rounded input accuracy, symbolic derivations, equation choice, physical assumptions and agreement with graphs. ${physicalDisclaimer}

**Unit conversion/dimension check: mismatch detected.** 1 passed; 1 mismatched; 2 unchecked marked conversions.

Conversion 2: incompatible dimensions. Do not rely on the displayed conversion.

Conversion 3: unsupported unit, syntax or numeric range.

Conversion 4: unsupported unit, syntax or numeric range.

Only supported conversions explicitly shown in units blocks are eligible. Unsupported units and all units outside those blocks remain unchecked. ${unitDisclaimer}

---

Original conversion claims (including the incorrect one):

\`\`\`arithmetic
${arithmetic}
\`\`\`

\`\`\`units
${units}
\`\`\`

Unsupported compound unit in prose: \`kg*m^2*s^-3*A^-1*kg*m^2*s^-3*A^-1*kg*m^2*s^-3*A^-1\`.
`;
export const limited = `**Arithmetic check: limited check.** 1 passed; 0 mismatched; 0 unchecked marked calculations.

${physicalDisclaimer}

**Unit conversion/dimension check: limited check.** 1 passed; 0 mismatched; 0 unchecked marked conversions.

${unitDisclaimer}

\`\`\`arithmetic
1000 * 0.001 = 1
\`\`\`

\`\`\`units
1000 [mV] = 1 [V]
\`\`\``;
export const unchecked = `**Arithmetic unchecked.** No supported numeric calculations were checked.

${physicalDisclaimer}

**Units unchecked.** No supported unit conversions were checked.

Unsupported units and all units outside those blocks remain unchecked. ${unitDisclaimer}

Original unmarked claim: 1 [V] = 1 [A].`;

// Synthetic hostile saved content only; never copied from student answers.
export const hostileHtml = [
  '<script>document.documentElement.dataset.hostileExecuted="script"</script>',
  '<img src="/hostile-image" onerror="document.documentElement.dataset.hostileExecuted=\'error\'">',
  '<button onclick="document.documentElement.dataset.hostileExecuted=\'click\'">Unsafe HTML button</button>',
  '<a href="javascript:alert(37)">Unsafe HTML link</a>',
];
export const hostile = `Saved answer before hostile content.

${hostileHtml.join("\n\n")}

[Unsafe Markdown link](javascript:alert%2837%29)

[Mixed-case unsafe link](JaVaScRiPt:alert%2837%29)

[Entity-encoded unsafe link](javascript&#58;alert%2837%29)

[Reference unsafe link][unsafe]

[unsafe]: javascript:alert%2837%29

[Normal source](https://example.org/synthetic-source?section=2#reference)

Saved answer after hostile content.`;
