"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Play,
  Pause,
  RotateCcw,
  Shield,
  ChevronDown,
  Radio,
  LoaderCircle,
} from "lucide-react";
import { FlightController, initialFlightView } from "@/game/controller";

export function SpaceShooter({ configured }: { configured: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const controller = useRef<FlightController | null>(null);
  const [view, setView] = useState(initialFlightView);
  const [ready, setReady] = useState(false);
  const [assetError, setAssetError] = useState("");
  const [inspect, setInspect] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const flight = new FlightController(setView);
    controller.current = flight;
    import("@/game/renderer")
      .then(({ mountGame }) => {
        if (!cancelled && stage.current)
          destroy = mountGame(
            stage.current,
            flight,
            () => {
              if (!cancelled) setReady(true);
            },
            (message) => {
              if (!cancelled) setAssetError(message);
            },
          );
      })
      .catch(() => {
        if (!cancelled)
          setAssetError(
            "The game engine could not load. Reload the page to try again.",
          );
      });
    const visibility = () => {
      if (document.hidden) flight.pause();
    };
    const keydown = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        (event.target instanceof HTMLElement &&
          /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(
            event.target.tagName,
          ))
      )
        return;
      if (flight.state.status === "running") {
        event.preventDefault();
        flight.pause();
      } else if (flight.state.status === "paused") {
        event.preventDefault();
        flight.start();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("keydown", keydown);
    return () => {
      cancelled = true;
      flight.dispose();
      destroy?.();
      controller.current = null;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("keydown", keydown);
    };
  }, []);

  const last = view.decisions[0];
  const running = view.status === "running";
  const ended = view.status === "won" || view.status === "lost";
  const title =
    view.status === "ready"
      ? "Jev is your pilot"
      : view.status === "paused"
        ? "Flight paused"
        : view.status === "won"
          ? "Sector cleared."
          : "Mission over.";
  const buttonText = !ready
    ? "Loading flight deck…"
    : running
      ? "Pause mission"
      : view.status === "paused"
        ? "Resume mission"
        : ended
          ? "Fly again"
          : "Launch mission";
  const blocked = !configured || !ready || Boolean(assetError);
  function toggleFlight() {
    if (running) controller.current?.pause();
    else controller.current?.start();
  }
  const primary = (compact = false) => (
    <button
      className={`flight-primary${compact ? " flight-top-action" : ""}`}
      disabled={blocked}
      onClick={toggleFlight}
    >
      {!ready ? (
        <LoaderCircle size={16} className="spin" />
      ) : running ? (
        <Pause size={16} />
      ) : (
        <Play size={16} fill="currentColor" />
      )}
      {buttonText}
    </button>
  );

  return (
    <div className="space-app">
      <nav className="space-nav" aria-label="Arcade navigation">
        <Link href="/" className="space-back" aria-label="Back to playground">
          <ArrowLeft size={18} />
        </Link>
        <Link href="/arcade" className="space-brand">
          jev <span>/ arcade</span>
        </Link>
        <Link href="/" className="playground-link">
          Playground <ArrowUpRight size={15} />
        </Link>
      </nav>
      <main className="space-main">
        <header className="space-header">
          <div>
            <h1>Let Jev take the controls.</h1>
            <p>One ship. Three waves. Every decision, live.</p>
          </div>
          {primary(true)}
        </header>
        <div className="flight-layout">
          <section className="flight-stage" aria-label="Space shooter">
            <div className="flight-hud">
              <div>
                <span>SCORE</span>
                <strong>{String(view.score).padStart(4, "0")}</strong>
              </div>
              <div>
                <span>WAVE</span>
                <strong>
                  {String(view.wave).padStart(2, "0")}
                  <small> / 03</small>
                </strong>
              </div>
              <div
                className="hull"
                aria-label={`${view.hull} of 3 hull points`}
              >
                <span>HULL</span>
                {[1, 2, 3].map((n) => (
                  <Shield
                    key={n}
                    size={20}
                    className={n <= view.hull ? "hull-full" : "hull-empty"}
                    fill="currentColor"
                  />
                ))}
              </div>
            </div>
            <div className="flight-field">
              <div ref={stage} className="phaser-mount" />
              {!running && (
                <div className="flight-overlay">
                  <div className="flight-dialog">
                    <h2>{title}</h2>
                    <p>
                      {view.status === "ready" ? (
                        <>
                          It reads the radar, chooses a lane,
                          <br />
                          and hunts the most urgent targets.
                        </>
                      ) : view.status === "paused" ? (
                        "Take a breath. Jev will reconnect when you resume."
                      ) : view.status === "won" ? (
                        <>
                          Three waves down. {view.score.toLocaleString()}{" "}
                          points.
                          <br />
                          {view.calls} calls. One autonomous pilot.
                        </>
                      ) : view.hull <= 0 ? (
                        <>
                          The ship lost its last shield.
                          <br />
                          Reset the sector and give Jev another flight.
                        </>
                      ) : (
                        "The two-minute mission clock ran out. Try another flight."
                      )}
                    </p>
                    {(!configured || assetError || view.error) && (
                      <div className="flight-error" role="alert">
                        {assetError ||
                          (!configured
                            ? "Add JEV_API_KEY to .env and restart the server to connect the pilot."
                            : view.error)}
                      </div>
                    )}
                    {primary()}
                    {view.status === "ready" && (
                      <small>Uses live Jev API calls while playing.</small>
                    )}
                  </div>
                </div>
              )}
              {running && view.holding && (
                <div className="pilot-hold" role="status">
                  <LoaderCircle size={13} className="spin" />
                  Holding for Jev’s next command
                </div>
              )}
              {running && !view.holding && view.dodgeX !== null && (
                <div className="pilot-hold reflex-alert" role="status">
                  <Shield size={13} />
                  Local reflex · precision dodge
                </div>
              )}
            </div>
          </section>
          <aside className="pilot-panel" aria-label="Jev pilot telemetry">
            <section className="pilot-section">
              <h2>Pilot link</h2>
              <div className={`pilot-status ${running ? "online" : ""}`}>
                <span />
                {view.error
                  ? "Connection paused"
                  : running
                    ? view.thinking
                      ? "Reading radar"
                      : "In control"
                    : view.status === "ready"
                      ? "Standby"
                      : view.status === "paused"
                        ? "Paused"
                        : "Mission complete"}
              </div>
              <p className="pilot-model">{last?.model ?? "jev-latest"}</p>
            </section>
            <section className="pilot-section">
              <h2>Latest decision</h2>
              <div className="pilot-lane">
                {last ? `Lane ${last.lane}` : "—"}
              </div>
              <p className="decision-caption">
                {last
                  ? `${(last.confidence * 100).toFixed(0)}% lane confidence · ${last.durationMs} ms`
                  : "Waiting for launch."}
              </p>
              <dl className="decision-values">
                <div>
                  <dt>Lane</dt>
                  <dd>
                    {last
                      ? ["Far left", "Left", "Center", "Right", "Far right"][
                          last.lane - 1
                        ]
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Fire</dt>
                  <dd className={view.firing && !view.holding ? "cyan" : ""}>
                    {view.firing && !view.holding
                      ? "Auto fire active"
                      : "Auto fire ready"}
                  </dd>
                </div>
                <div>
                  <dt>Threat</dt>
                  <dd>
                    {last
                      ? `${["Clear", "Approaching", "Immediate"][Math.min(2, Math.round(last.threat))]}`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <dl className="decision-values reflex-values">
                <div>
                  <dt>Local reflex</dt>
                  <dd>{view.dodgeX !== null ? "Evading" : "Ready"}</dd>
                </div>
                <div>
                  <dt>Emergency dodges</dt>
                  <dd>{view.dodges}</dd>
                </div>
              </dl>
              {last && (
                <button
                  className="flight-text-button"
                  onClick={() => setInspect(!inspect)}
                  aria-expanded={inspect}
                >
                  {inspect ? "Hide" : "Inspect"} probabilities{" "}
                  <ChevronDown size={12} />
                </button>
              )}
              {last && inspect && (
                <div className="pilot-probabilities">
                  {Object.entries(last.probabilities).map(([id, value]) => (
                    <div key={id}>
                      <span>{id.replace("lane_", "Lane ")}</span>
                      <meter
                        min={0}
                        max={1}
                        value={value}
                        aria-label={`${id} probability`}
                      />
                      <span>{Math.round(value * 100)}%</span>
                    </div>
                  ))}
                  <p>Threat: {last.threat.toFixed(2)} / 2</p>
                </div>
              )}
            </section>
            <section className="pilot-section decision-feed">
              <h2>Decision feed</h2>
              {view.decisions.length ? (
                <ol>
                  {view.decisions.map((d) => (
                    <li key={d.number}>
                      <span className="feed-number">
                        {String(d.number).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>Lane {d.lane}</strong>
                        <small>
                          {Math.round(d.confidence * 100)}% confidence
                        </small>
                      </div>
                      <span className="feed-latency">{d.durationMs} ms</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="feed-empty">
                  Your flight decisions will appear here.
                </p>
              )}
            </section>
            {view.calls > 0 && (
              <div className="flight-usage">
                <span>{view.calls} calls</span>
                <span>{view.tokens.toLocaleString()} input tokens</span>
              </div>
            )}
            <details className="pilot-help">
              <summary>
                How the pilot works <ChevronDown size={15} />
              </summary>
              <p>
                Jev receives text-only radar with every bullet’s position,
                velocity, owner, distance, and arrival time. Choice prioritizes
                attack lanes using enemy escape deadlines, health, and time to
                destroy them. Weapons fire automatically. Score reports danger.
              </p>
              <p>
                Every arriving command is checked against live bullet positions.
                A local reflex makes short evasive moves, then resumes the
                attack as soon as the route is clear. Amber highlights show
                emergency dodges; Jev keeps choosing the overall flight path.
              </p>
              <p>
                A decision is requested about once every two seconds. If a
                command grows stale, the battlefield waits. Dodges need no extra
                API calls.
              </p>
              <p>
                Clear three waves before losing three hull points. A mission
                ends at two minutes of flight time or pauses at 90 calls. API
                errors pause the game.
              </p>
            </details>
          </aside>
        </div>
        <footer className="flight-footer">
          <span>
            <Radio size={16} />
            Pause anytime. The pilot only runs while the mission is active.
          </span>
          <div>
            {view.status !== "ready" && (
              <button
                onClick={() => controller.current?.reset()}
                className="flight-reset"
              >
                <RotateCcw size={14} />
                Reset mission
              </button>
            )}
            <span className="flight-time">
              {Math.floor(view.elapsed / 60)}:
              {String(Math.floor(view.elapsed % 60)).padStart(2, "0")} / 2:00
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
