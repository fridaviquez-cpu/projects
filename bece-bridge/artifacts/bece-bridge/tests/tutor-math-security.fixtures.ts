// Synthetic saved explanations only. No student content or remote resources.
export const hostileMath = [
  { name: "html-class", tex: String.raw`\htmlClass{hostile-math-class}{x}` },
  { name: "html-id", tex: String.raw`\htmlId{hostile-math-id}{x}` },
  { name: "html-style", tex: String.raw`\htmlStyle{background-image:url(https://example.invalid/hostile-math-style)}{x}` },
  { name: "html-data", tex: String.raw`\htmlData{hostile-math=payload}{x}` },
  { name: "javascript-href", tex: String.raw`\href{javascript:alert(37)}{click}` },
  { name: "mixed-case-href", tex: String.raw`\href{JaVaScRiPt:alert(37)}{click}` },
  { name: "data-href", tex: String.raw`\href{data:text/html,<script>alert(37)</script>}{click}` },
  { name: "javascript-url", tex: String.raw`\url{javascript:alert(37)}` },
  { name: "image", tex: String.raw`\includegraphics{https://example.invalid/hostile-math-image}` },
  // Quote breakout must never become an event attribute, even on a blocked link.
  { name: "attribute-breakout", tex: String.raw`\href{https://example.invalid/" onclick="alert(37)}{click}` },
];

export const ordinaryMath = String.raw`\frac{1}{2} + x^2 = \sqrt{4}`;

export const savedMathSecurity = Object.fromEntries(
  hostileMath.flatMap(({ name, tex }) =>
    ["inline", "display"].map(mode => [
      `${name}-${mode}`,
      `Before synthetic math.\n\n${mode === "inline" ? `$${tex}$` : `$$\n${tex}\n$$`}\n\nAfter synthetic math.\n\n$${ordinaryMath}$`,
    ]),
  ),
);
