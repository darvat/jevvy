# Jev playground

A local web app for trying [TypeSafe AI](https://docs.typesafe.ai/introduction) decisions. Build a request with one shared state and several independent questions, run it with your own API key, and inspect the typed answers. The app also includes an arcade where Jev pilots a space shooter from a text radar feed.

## Quick start

You need Node.js 20.9 or newer, npm, and a TypeSafe AI API key with access to the model you select.

1. Install the locked dependencies:

   ```sh
   npm ci
   ```

2. If you do not already have a `.env` file, create one from the example:

   ```sh
   cp .env.example .env
   ```

   Set `JEV_API_KEY` in `.env` to your key. Keep an existing `.env` rather than replacing it. The file is ignored by Git.

3. Start the app:

   ```sh
   npm run dev
   ```

Open **http://127.0.0.1:3000** for the playground or **http://127.0.0.1:3000/arcade** for the game. Both development and production scripts bind to `127.0.0.1`.

Evaluations call the live TypeSafe API and can consume your account's credits. The browser sends requests to this app's `/api/evaluate` route; the server adds the API key when it calls TypeSafe. The key is never included in the browser request or response.

## Playground

Start with **Support triage**, **Product feedback**, or **Bug severity**, then edit the request:

1. Enter the shared state as text, or choose **JSON** for an object or array.
2. Add questions and give each a unique ID and instructions. Use **Edit** to change the criteria as JSON.
3. Choose a model alias or enter a model ID, then select **Run evaluation**.
4. Inspect the answer, distribution, confidence where available, elapsed time, token usage, and raw response JSON. You can copy the response or download a run containing its request and response.

| Question   | What it returns                                              | Criteria                                 |
| ---------- | ------------------------------------------------------------ | ---------------------------------------- |
| **Choice** | A selected option and its probability distribution           | 2–255 named options                      |
| **Score**  | A probability-weighted position on a scale starting at **0** | 2–10 ordered levels                      |
| **Noul**   | The probability of “yes”                                     | Optional `true` and `false` descriptions |

Choice and Score include a confidence value describing the shape of the distribution; it is distinct from the probability of the selected option. Noul has no separate confidence field. Every question uses the same state, and question IDs label answers rather than instructing the model. See the [Choice](https://docs.typesafe.ai/primitives/choice), [Score](https://docs.typesafe.ai/primitives/score), [Noul](https://docs.typesafe.ai/primitives/noul), and [confidence](https://docs.typesafe.ai/confidence) guides for interpretation.

The playground keeps the latest 20 successful runs in browser memory. **Run history** can restore a request and result, and refreshing the page clears that history. No evaluation runs automatically.

### Request example

The UI sends JSON like this to `POST /api/evaluate`:

```json
{
  "model": "jev-latest",
  "state": "I was charged twice and need a refund before tomorrow.",
  "questions": {
    "team": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": {
        "Billing": "Payments and refunds",
        "Support": "Technical problems"
      }
    },
    "urgency": {
      "type": "score",
      "instructions": "How urgent is this request?",
      "criteria": [
        "No deadline",
        "Needs attention soon",
        "Deadline within a day"
      ]
    },
    "refund_requested": {
      "type": "noul",
      "instructions": "The customer is asking for a refund."
    }
  }
}
```

The route validates the request and TypeSafe's answer with Zod, then returns `{ "response": ..., "durationMs": ... }` or a JSON error. It accepts 1–50 questions and up to 250,000 characters of serialized request JSON, and stops upstream requests after 45 seconds. See the [TypeSafe HTTP API](https://docs.typesafe.ai/api) and [model guide](https://docs.typesafe.ai/models) for the upstream contract.

## Arcade

Select **Space shooter** in the playground or open `/arcade`. Choose **Launch mission** to start; use the button or press Space while focus is outside a control to pause and resume. **Reset mission** returns to standby, and hiding the tab pauses the pilot. The arcade uses `jev-latest`.

Jev receives a JSON radar snapshot with the ship, enemies, lane travel times, and each projectile's position, owner, velocity, distance, and arrival time. It chooses an attack lane with **Choice** and reports danger with **Score**. Weapons fire automatically while enemies remain. A local reflex checks incoming commands and live projectile paths, makes short evasive moves when needed, and returns to Jev's attack lane once it is safe. The reflex makes no API calls, and no screenshots are sent to TypeSafe.

Each launch creates a new randomized mission; explicit seeds keep the simulation reproducible in tests. A mission ends after the third wave, when the ship loses all three hull points, or after two minutes of simulation time. The game pauses after 90 API calls or on API errors. If a command is overdue, the simulation holds until a response arrives. Only one pilot request is active at a time, and reset discards late responses. The telemetry panel shows recent decisions, confidence, probabilities, latency, calls, input tokens, and emergency dodges.

The runtime is split across [`simulation.ts`](src/game/simulation.ts) (rules and radar), [`pilot.ts`](src/game/pilot.ts) (Jev request), [`controller.ts`](src/game/controller.ts) (request lifecycle), and [`renderer.ts`](src/game/renderer.ts) (Phaser). See [arcade verification and asset notes](docs/game-verification.md).

### Offline benchmark

```sh
npm run benchmark:game
```

This compares the current game with a frozen earlier simulation using 500 primary seeds, 500 separate holdout seeds, three policy variants, and simulated response latencies of 300 and 900 ms: 6,000 missions total. It overwrites [`docs/game-benchmark.json`](docs/game-benchmark.json). You can use a smaller cohort with `npm run benchmark:game -- 100`.

The policies are deterministic approximations, **not measured Jev win rates**. The earlier policy always fires, so the comparison does not depend on withholding its shots. Read the [methodology and results](docs/game-benchmark.md) before interpreting the numbers.

## Development

| Command             | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Start the development server on `127.0.0.1:3000` |
| `npm test`          | Run the request and game tests                   |
| `npm run typecheck` | Check TypeScript without emitting files          |
| `npm run build`     | Create a production build                        |
| `npm start`         | Serve the production build on `127.0.0.1:3000`   |

The app uses Next.js App Router, React, TypeScript, Zod, Phaser, and plain CSS. The playground lives at `/`; the server route is [`src/app/api/evaluate/route.ts`](src/app/api/evaluate/route.ts). [Design and browser verification notes](docs/verification.md) record the playground checks and differences from its concept image.

### Troubleshooting

- **Server key missing:** Set `JEV_API_KEY` in the project root `.env`, then restart the server. Both run controls stay disabled until the key is configured.
- **Key, access, or credit error:** Check the key, selected model, and TypeSafe account. The route reports upstream 401, 403, and 402 errors separately.
- **Rate limit or connection error:** Wait and run again after checking connectivity. The app shows the error and does not retry evaluations automatically.

## Deployment scope

This project is intended for local use. `/api/evaluate` has no user authentication or per-user usage limit; any client that can reach it can spend the configured API key's credits. Add both controls before binding the server to a public interface or deploying it. Keep the key server-side and out of Git. The UI also requests Google Fonts, with system fonts as fallbacks.
