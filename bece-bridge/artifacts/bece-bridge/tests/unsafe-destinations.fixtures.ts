// Synthetic persisted content only. No student answers or real local paths.
export const unsafeDestinations = [
  { name: "JavaScript", url: "javascript:alert%2841%29" },
  { name: "Data HTML", url: "data:text/html,%3Cscript%3Ealert%2841%29%3C/script%3E" },
  { name: "Data SVG", url: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20onload='alert%2841%29'/%3E" },
  { name: "VBScript", url: "vbscript:msgbox%2841%29" },
  { name: "File", url: "file:///synthetic-only/not-a-real-resource.html" },
  { name: "Mixed-case data", url: "DaTa:text/html,synthetic" },
  { name: "Entity-encoded file", url: "file&#58;///synthetic-only/not-a-real-resource.html" },
];

export const safeSource = "https://example.org/synthetic-source?section=41#reference";
export const safeImage = "https://example.org/synthetic-image.svg";
export const destinations = `Saved destinations before.

${unsafeDestinations.map(({ name, url }, index) => `
[${name} inline link](${url})

[${name} reference link][destination-${index}]

![${name} inline image](${url})

![${name} reference image][destination-${index}]

[destination-${index}]: ${url}
`).join("\n")}

[Supported HTTPS source](${safeSource})

![Supported HTTPS image](${safeImage})

Saved destinations after.`;
