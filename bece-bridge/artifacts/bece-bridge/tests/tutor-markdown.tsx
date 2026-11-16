import { createRoot } from "react-dom/client";
import { Markdown } from "../src/components/kit";
import "../src/index.css";
import { destinations } from "./unsafe-destinations.fixtures";
import { savedMathSecurity } from "./tutor-math-security.fixtures";
import { supportedDestinations } from "./supported-destinations.fixtures";
import { supportedImagesMarkdown } from "./supported-images.fixtures";
import { mixed, limited, unchecked, hostile, delimiterExamples, unclosedDelimiterFence, inlineDelimiterExamples, containerDelimiterExamples } from "./tutor-markdown.fixtures";

// Same Markdown component and turn-card classes used by TutorConversation.
// JSON round trip represents the saved answer, not a freshly generated report.
const saved = JSON.parse(JSON.stringify(
  location.search === "?math-security" ? savedMathSecurity :
    location.search === "?supported-images" ? { supportedImagesMarkdown } :
    location.search === "?supported-destinations" ? { supportedDestinations } :
    location.search === "?destinations" ? { destinations } :
    location.search === "?inline" ? { inlineDelimiterExamples } :
    location.search === "?security" ? { hostile } : { mixed, limited, unchecked, delimiterExamples, unclosedDelimiterFence, ...containerDelimiterExamples },
));
createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-3xl p-4">
    {Object.entries(saved).map(([name, answer]) => (
      <article key={name} data-testid={name} className="rounded-lg border bg-background p-4 mb-5">
        <Markdown>{answer as string}</Markdown>
      </article>
    ))}
    {location.search === "?supported-destinations" && (
      <section id="supported-reference-target">Synthetic fragment destination</section>
    )}
  </main>,
);
