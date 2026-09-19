# Arcade verification and assets

## Behavior

Route: `/arcade`. The playground remains at `/`; both link to each other. The API key remains server-side. The evaluation route now respects caller cancellation upstream.

The pilot uses the documented text/JSON interface: [State](https://docs.typesafe.ai/concepts/state), [Choice](https://docs.typesafe.ai/primitives/choice), [Noul](https://docs.typesafe.ai/primitives/noul), and [Score](https://docs.typesafe.ai/primitives/score). Phaser loads dynamically in the browser, using its ESM namespace export. See [Phaser's overview](https://docs.phaser.io/phaser/getting-started/what-is-phaser).

Radar includes all friendly/enemy bullet coordinates, velocities, distance, arrival times, and unsafe route IDs. Jev selects the strategic attack lane using escape deadlines, interception estimates, and target HP; weapons fire automatically. Each arriving command is checked against current bullet geometry. A local reflex predicts collision windows along horizontal routes and chooses a short safe offset when danger is within 0.85 seconds. It resumes Jev’s attack as soon as the route clears, without a fixed hold timer. Amber highlights and telemetry disclose these interventions. Requests begin after explicit launch. Fresh commands are requested after 1.15 seconds plus the previous request's latency. Flight holds if a command is older than 2.5 seconds; requests time out after 12 seconds. Pause, reset, completion, and unmount cancel outstanding work and invalidate late responses.

## Evidence

- Win optimization: 23 tests, TypeScript, and production build passed. Continuous fire replaced the arcade Noul question; request capture confirmed only lane/threat questions and attack deadline fields. Precision dodges, early return to attack, and immediate command validation have regression coverage. The [6,000-mission offline comparison](game-benchmark.md) improved 300 ms holdout wins from 18.4% to 81.8% with policy approximations (not measured Jev rates). Two separate live `jev-1.13.0` flights both survived wave three: 2,300 points / 3 hull / 16 dodges / 25 calls, then 2,000 points / 1 hull / 15 dodges / 30 calls. The latter allowed three enemies to escape; survival does not imply every enemy was destroyed. Desktop precision-dodge and mobile result/help screenshots were inspected. Mobile had no horizontal overflow. Reset left the game in standby after testing.
- Randomness/agility update: player speed increased from 450 to 720 pixels/second. Fresh seeds vary formation heights/lane ordering, individual enemy approach speeds, firing gaps, and occasional two-lane volleys. All 20 tests and TypeScript passed, including bounded randomization across 60 seeds and all waves, reproducible seeded runs, quarter-second lane changes, and immediate reversal. A live browser run reached wave two with an emergency dodge; a second launch confirmed a different formation and radar advertised speed 720 plus individual enemy velocities. Screenshot inspected and no API/UI errors observed; both runs were stopped and reset after checking.
- Bullet radar/reflex update: a live `jev-1.13.0` mission cleared wave three with 2,100 points, 1 hull remaining, 6 emergency dodges, and 28 calls. Captured requests contained friendly and enemy projectile positions/velocities and active reflex state. Desktop dodge highlights and mobile telemetry were inspected; no mobile horizontal overflow or browser console errors. Reset cleared the dodge counter. All 17 tests, TypeScript, and the production build passed. The additional tests cover exact projectile payloads, safe escape selection, route crossings, ignored friendly/passed shots, and returning control to Jev.
- Original difficulty live mission: `jev-1.13.0` cleared all three waves with 2,300 points, all 3 hull points, 24 submitted calls, and 34,674 input tokens. Flight time was about 33 seconds. This is one observed run, not a guarantee of future model behavior.
- Harder difficulty live mission: 1,200 points, wave two, all hull lost after 17 seconds and 12 calls. All 12 tests and the TypeScript check passed after tuning. Enemy approach speeds are now 20/28/36 world units per second, shot intervals 1.4/1.1/0.8 seconds, and bullet speeds 156/180/204. First shots arrive after 0.8/0.7/0.6 seconds. The radar shares the bullet-speed settings with the simulation so its timing stays accurate.
- Pause and completion stopped further calls. Resume and reset worked.
- A browser-intercepted HTTP 429 verified the error pause state. The mobile error panel fit inside the playfield. The interception was removed afterward.
- Desktop at 1505 × 1045 and mobile at 390 × 844 were checked with Playwright. No horizontal overflow on the game page.
- Twelve tests passed, covering hits, hull loss, wave progression, win/time-limit states, radar shape, one outstanding request, late-response rejection, and API errors. Existing playground tests remain green.
- Production build and TypeScript checks passed.
- Fixed a Phaser default/namespace import mismatch caught at browser boot. Adjusted volley gaps and arrival-aware radar after a live run showed the pilot avoiding a continuously threatened lane. The subsequent full mission succeeded.

## Visual reference

Reference: [game-concept.png](game-concept.png), generated with the built-in image tool. Browser screenshots were inspected with `view_image` alongside the reference. Playwright was the available browser automation tool; no separate Browser/IAB tool was available.

| Comparison | Result |
| --- | --- |
| Layout | Wide battlefield, narrow telemetry column, top navigation, and edge HUD preserve the concept. |
| Palette | Near-black navy, cyan player/actions, coral enemies, slate borders. |
| Typography | Sans serif headings and controls; monospace scores, lanes, timing, model ID. |
| Assets | Generated alpha fighter and starfield load correctly. Enemies reuse the fighter with red tint and rotation. |
| Copy | Heading, navigation, start message, action, and panel labels match. Functional additions: call note, elapsed time, reset, probabilities, errors, completion. |
| Responsive | Telemetry stacks below the battlefield; the center is clear during play. |
| Runtime | Shots, hits, shields, wave changes, decision feed, and completion were inspected. |

Intentional changes: enemies share the fighter silhouette; the battlefield uses a fixed 1000 × 680 simulation; telemetry uses compact text and a scrolling feed; the background is a separately generated composition. Lasers, star movement, lane guides, and hit rings are procedural effects. The UI is code-native. The implementation follows the reference with these recorded changes; no material visual defects remain in the inspected views.

## Asset prompts and paths

All images used the built-in image generation tool.

- `docs/game-concept.png`: Complete Jev-controlled top-down shooter UI, dark navy/cyan/coral palette, left playfield with five lanes, right telemetry, three hull points, start overlay, mobile stacking.
- `public/game/fighter.png`: Single centered silver/gunmetal overhead spacecraft, nose up, symmetric swept wings, cyan accents and engine flame; orthographic arcade art on a transparent background, no scenery or text.
- `public/game/space.png`: Dark starfield, teal nebula left and red nebula right, edge asteroids and partial planet, central 70% dark for readable gameplay; no ships, UI, or text.

Temporary playtest screenshots are outside the project. References remain in `docs`; shipped assets are in `public/game`.
