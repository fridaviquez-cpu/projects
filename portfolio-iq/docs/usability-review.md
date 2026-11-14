# PortfolioIQ usability review

Framework: Jakob Nielsen's [10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), Nielsen Norman Group.

This is a heuristic review and implementation pass, not a claim that the product has been validated with representative users.

| Principle | Application to PortfolioIQ |
| --- | --- |
| Visibility of system status | Workspace connection, saving, save-error, and offline feedback are visible. Save confirmations follow successful server responses. Typing alone is not described as saved. |
| Match with the real world | A holding is explained as an investment; total cost is explained with a full-position example. Dollar input never silently rounds away extra decimal places. |
| User control and freedom | Holding, journal, and budget drafts ask before discarding. Browser exits warn about unsaved work. Preferences offer reset. Destructive actions remain explicit and confirmed. |
| Consistency and standards | Shared form labels, error feedback, save states, and cancel actions; native keyboard-accessible radio inputs for budget type. |
| Error prevention | Drafts do not reset on background refetch. Duplicate submissions and repeated deletes are blocked while pending. Budget dates explain which month receives a record. |
| Recognition rather than recall | Cost-basis examples, budget category suggestions, current-page indicators, recovery reminder, and contextual help reduce memory requirements. |
| Flexibility and efficiency | Keyboard skip link, clear active navigation, focus after navigation, searchable help, existing holding filters, and category suggestions support faster use. |
| Aesthetic and minimalist design | The existing cream/ink/orange identity is preserved. Status is compact, the recovery reminder appears only after records exist, and help stays on demand. |
| Error diagnosis and recovery | Failed saves leave form inputs intact. Invalid money and recovery-key messages explain a corrective action. Data-loading errors provide Retry. |
| Help and documentation | Searchable short task guides explain holdings, cost basis, saving, recovery, samples, budgets, journaling, and product limits. |

## Remaining research

- Observe new investors adding their first real holding and explaining total cost basis back in their own words.
- Observe visitors saving a recovery key and reopening their workspace on a second device.
- Evaluate recovery discoverability and whether Learn and Resources need to be consolidated after real usage feedback.
- Permanent deletion is confirmed, not undoable. A future undo feature requires a server-supported retention and restore policy; the interface must not imply it already exists.
