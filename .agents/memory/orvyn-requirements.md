---
name: Orvyn requirements
description: Naming, visibility, persistence, and usability requirements stated by the user.
---

The product is just **Orvyn**. The user does not want “guest access” in the title or anywhere else.

**Why:** The user explicitly corrected the naming.

**How to apply:** Use Orvyn alone as the product name in the interface, page metadata, project descriptions, and suggested website addresses. No-login access is behavior, not an alternate product name.

The user wants people to use the website; they do not need to see the code. Keep the website public and the GitHub repository private.

**Why:** The user explicitly distinguished website access from access to their source code.

**How to apply:** Do not change repository visibility to provide website access. Verify publishing visibility separately.

The user wants the same functions and style as the original Orvyn, with no login requirement and work retained between visits.

**Why:** The user explicitly requested unrestricted no-login use, persistent work, and usability guided by Nielsen Norman Group’s ten usability heuristics.

**How to apply:** Preserve the supplied source’s visual identity and workflows. Disclose browser-local storage limits and clearing-data risks. Keep save status, errors, safe deletion, and recovery understandable.

Users should be able to upload screenshots in the relevant tabs instead of manually typing everything, including screenshots of submitted applications or things they did. Choosing the screenshots must automatically extract and fill the information, without a second "Read" action.

**Why:** The user explicitly said manual input should not be required and corrected an implementation that still made them type after uploading.

**How to apply:** Keep manual entry optional. Automatically prepare populated drafts when files are selected; let people review and save without retyping. Do not fabricate information absent from the screenshot.

Screenshot uploads must support up to five independent opportunities in one batch: five job screenshots become five separate opportunities; four become four. Do not require importing opportunities one by one or combine separate jobs into one record.

**Why:** The user explicitly clarified the batch behavior after the initial implementation combined screenshots of one item.

**How to apply:** Read each application screenshot independently, keep its extracted fields separate, and provide one action to save the ready drafts together. Keep individual read failures visible without discarding other drafts.
