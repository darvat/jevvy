# Combat tuning comparison

Run `npm run benchmark:game` to reproduce [the full results](game-benchmark.json). An optional seed count is accepted, e.g. `npm run benchmark:game -- 100`. The baseline is frozen in `scripts/fixtures/simulation-before-win-tuning.ts`; it is not shipped as game runtime code.

The comparison runs 500 primary seeds (1–500) and 500 disjoint holdout seeds (10001–10500). Each seed is played with three variants and two response latencies, totaling 6,000 missions. No hull, enemy difficulty, projectile speed, or wave-count settings changed. Identical initial seeds provide matched starting conditions; enemy firing evolves differently after different kills.

These are **offline deterministic policy proxies, not measured Jev win rates**. The original policy chooses the nearest safe enemy lane, staying when it can keep attacking. The urgency policy instead prioritizes an interceptable enemy with the smallest escape margin. Both use radar from the request time; the command arrives 300 or 900 ms later. Requests start 1.15 seconds after the previous response, matching the normal controller cadence. The first command is immediate; network failures, model uncertainty, and long-response holds are not simulated.

The baseline proxy always fires, giving it perfect firing decisions. This isolates movement and attack-selection improvements without penalizing the baseline for occasional real-model firing pauses. The middle variant uses the new controller with the original targeting proxy to separate controller and targeting effects.

## Holdout results (500 missions per row)

| Simulated latency | Variant | Wins | Mean hull | Mean kills / 23 | Mean winning duration |
| --- | --- | ---: | ---: | ---: | ---: |
| 300 ms | Previous controller + nearest-safe proxy | 18.4% | 0.21 | 17.62 | 47.77 s |
| 300 ms | New controller + nearest-safe proxy | 57.4% | 0.77 | 19.70 | 47.60 s |
| 300 ms | New controller + urgent-target proxy | 81.8% | 1.31 | 20.66 | 45.99 s |
| 900 ms | Previous controller + nearest-safe proxy | 11.6% | 0.13 | 16.14 | 49.93 s |
| 900 ms | New controller + nearest-safe proxy | 32.0% | 0.38 | 18.00 | 49.28 s |
| 900 ms | New controller + urgent-target proxy | 52.2% | 0.71 | 19.31 | 50.42 s |

Primary-seed win rates for the full change were 82.4% at 300 ms and 59.2% at 900 ms, versus 20.6% and 10.4% before. Both cohorts favor the change. The slower-response scenario remains substantially harder; there is no claim of guaranteed wins or mathematically optimal play.

Win uses the game's existing three-wave survival condition. Escaped enemies can cost hull without preventing an eventual win, so enemies destroyed are reported separately. Mean hull and kills include losses; winning duration includes only wins and therefore compares different survivor subsets. The two latency runs reuse the same seeds and should not be treated as independent samples.

Live browser checks are recorded separately in [game verification](game-verification.md).
