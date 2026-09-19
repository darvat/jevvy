# Design and verification

## Reference

The built-in image generation tool produced [design-concept.png](design-concept.png). Brief: a complete white-and-blue Jev API playground, sidebar navigation, state/question editor, three primitive types, and an adjacent results panel, with mobile stacking. No generated imagery is used as functional UI.

The design was inspected with `view_image`, and the implementation was inspected using the same tool after browser screenshots. Browser verification used the available Playwright browser tools; a separate Browser/IAB tool was not available. Desktop was checked at the concept's native 1505 × 1045 viewport, mobile at 390 × 844.

## Comparison ledger

| Area | Evidence and outcome |
| --- | --- |
| Layout | Preserved left sidebar, heading, example/model toolbar, two workspace panels, and footer. Sidebar is intentionally narrower to provide more room for editors. |
| Typography | Sans serif UI with monospace state, IDs, and JSON. Checked title hierarchy, controls, labels, and result values. |
| Palette | White surfaces, navy text, pale gray borders, and a blue primary action match the reference. No decorative artwork or gradients added. |
| Components | Repeated outlined question editors, compact type selectors, option chips, and tabbed results preserve the reference structure. |
| Copy | Main heading, CTA, navigation, results tabs, and empty state match. Supporting copy shortened; additions are functional controls documented below. |
| Responsive layout | Sidebar becomes a compact top navigation; workspace stacks vertically. No horizontal page overflow at 390px. |
| Interaction | Real API results replace the empty state; JSON, export, history restore, criteria editing, and validation were exercised. |

Intentional deviations: the image's invented `jev-4.1` is replaced with documented `jev-latest`; the image's 1–5 scale is corrected to 0–4. Added editable question IDs, an add-question button, text/JSON state selection, optional Noul criteria, and request inspection. Criteria use expandable JSON editors to expose full descriptions. Nonfunctional drag handles are omitted. The branching empty-state icon uses the installed icon family. Above-the-fold copy changes are accounted for by these functional additions and shorter supporting text.

The implementation is faithful to the concept's visual structure with these documented deviations. No material layout, clipping, or responsive defects remain in the inspected views. Temporary screenshots and downloaded test exports are kept outside the application and removed from the workspace after verification.

## Functional evidence

- Production build and TypeScript check passed.
- Five unit tests passed: example round-trips; duplicate IDs; invalid state/questions/criteria; optional Noul criteria; invalid upstream probabilities.
- A live browser evaluation using the existing server-side key returned HTTP 200 with model `jev-1.13.0`, Billing, urgency 2/4, and refund probability 0.98; server duration 727 ms.
- Browser checks covered response JSON, run download, history restore, empty instructions, duplicate IDs, JSON state, invalid criteria, and mobile overflow.
- Fixed a localhost/127.0.0.1 origin mismatch found during browser testing. Origin is checked against the request Host header, avoiding Next.js's internal URL normalization.
- Added an application icon after the initial browser check reported a missing favicon, and explicit accessible names for the example and model controls.
