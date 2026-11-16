// Frozen synthetic saved Markdown: no generated answer or real source fetch.
export const supportedDestinations = `Saved supported references before.

[HTTPS reference][source]

[Inline fragment](#supported-reference-target)

[Reference fragment][section]

[Inline relative](./synthetic-reference?section=2#details)

[Reference relative][relative]

[Root-relative reference][root-relative]

[Collapsed HTTPS][]

[Shortcut HTTPS]

[Collapsed fragment][]

[Shortcut fragment]

[Collapsed relative][]

[Shortcut relative]

[Full  spaces][full spaces]

[Full tabs][full tabs]

[Full newline][full newline]

[Collapsed spaces][]

[Collapsed tabs][]

[Collapsed newline][]

[Shortcut spaces]

[Shortcut tabs]

[Shortcut newline]

[Undefined collapsed source][]

[Undefined shortcut source]

[source]: https://example.org/synthetic-reference?section=2#details
[section]: #supported-reference-target
[relative]: ../synthetic-reference?section=3#details
[root-relative]: /synthetic-reference?section=4#details
[cOLLaPsEd hTTps]: https://example.org/synthetic-reference?section=5#details
[sHORTcUT hTTps]: https://example.org/synthetic-reference?section=6#details
[cOLLaPsEd FRAGMENT]: #supported-reference-target
[sHORTcUT FRAGMENT]: #supported-reference-target
[cOLLaPsEd RELATIVE]: ./synthetic-reference?section=7#details
[sHORTcUT RELATIVE]: ../synthetic-reference?section=8#details
[  full   spaces  ]: https://example.org/synthetic-reference?section=9#details
[full\ttabs]: #supported-reference-target
[full
newline]: ./synthetic-reference?section=10#details
[ collapsed   spaces ]: https://example.org/synthetic-reference?section=11#details
[collapsed\ttabs]: #supported-reference-target
[collapsed
newline]: ../synthetic-reference?section=12#details
[ shortcut   spaces ]: https://example.org/synthetic-reference?section=13#details
[shortcut\ttabs]: #supported-reference-target
[shortcut
newline]: /synthetic-reference?section=14#details

Saved supported references after.`;

// Intentionally have no definitions: Markdown must retain the brackets as text.
export const undefinedReferences = [
  "[Undefined collapsed source][]",
  "[Undefined shortcut source]",
];

export const supportedLinks = [
  { label: "HTTPS reference", href: "https://example.org/synthetic-reference?section=2#details" },
  { label: "Inline fragment", href: "#supported-reference-target" },
  { label: "Reference fragment", href: "#supported-reference-target" },
  { label: "Inline relative", href: "./synthetic-reference?section=2#details" },
  { label: "Reference relative", href: "../synthetic-reference?section=3#details" },
  { label: "Root-relative reference", href: "/synthetic-reference?section=4#details" },
  // Definition casing deliberately differs from the visible reference labels.
  { label: "Collapsed HTTPS", href: "https://example.org/synthetic-reference?section=5#details" },
  { label: "Shortcut HTTPS", href: "https://example.org/synthetic-reference?section=6#details" },
  { label: "Collapsed fragment", href: "#supported-reference-target" },
  { label: "Shortcut fragment", href: "#supported-reference-target" },
  { label: "Collapsed relative", href: "./synthetic-reference?section=7#details" },
  { label: "Shortcut relative", href: "../synthetic-reference?section=8#details" },
  // All three reference forms normalize definition whitespace (including
  // leading/trailing spaces) without replacing the original visible label.
  { label: "Full  spaces", href: "https://example.org/synthetic-reference?section=9#details" },
  { label: "Full tabs", href: "#supported-reference-target" },
  { label: "Full newline", href: "./synthetic-reference?section=10#details" },
  { label: "Collapsed spaces", href: "https://example.org/synthetic-reference?section=11#details" },
  { label: "Collapsed tabs", href: "#supported-reference-target" },
  { label: "Collapsed newline", href: "../synthetic-reference?section=12#details" },
  { label: "Shortcut spaces", href: "https://example.org/synthetic-reference?section=13#details" },
  { label: "Shortcut tabs", href: "#supported-reference-target" },
  { label: "Shortcut newline", href: "/synthetic-reference?section=14#details" },
];
