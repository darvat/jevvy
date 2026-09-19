"use client";

import { useState } from "react";
import { GitFork, Copy, Check, LoaderCircle, Download } from "lucide-react";
import type { Run } from "@/lib/jev";

function Distribution({
  values,
  legend,
}: {
  values: Record<string, number>;
  legend?: Record<string, unknown>;
}) {
  return (
    <div className="distribution">
      {Object.entries(values).map(([label, p]) => (
        <div className="probability" key={label}>
          <div className="probability-label">
            <span title={legend ? JSON.stringify(legend[label]) : label}>
              {legend
                ? `${label} · ${typeof legend[label] === "string" ? legend[label] : JSON.stringify(legend[label])}`
                : label}
            </span>
            <span className="mono">{(p * 100).toFixed(1)}%</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${p * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Results({
  run,
  pending,
}: {
  run: Run | null;
  pending: boolean;
}) {
  const [tab, setTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const json = run ? JSON.stringify(run.response, null, 2) : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }
  function download() {
    if (!run) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `jev-run-${run.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section
      className="results-panel panel"
      aria-label="Evaluation results"
      aria-busy={pending}
    >
      <div className="results-heading">
        <h2>Results</h2>
        {run && (
          <div className="result-actions">
            <button
              type="button"
              className="icon-button"
              aria-label="Copy response JSON"
              onClick={copy}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Download run"
              onClick={download}
            >
              <Download size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="tabs" role="tablist" aria-label="Result format">
        <button
          id="overview-tab"
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          aria-controls="results-content"
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          id="json-tab"
          type="button"
          role="tab"
          aria-selected={tab === "json"}
          aria-controls="results-content"
          onClick={() => setTab("json")}
        >
          JSON
        </button>
      </div>
      {copyError && (
        <p role="status" className="error">
          Clipboard unavailable. Use Download run instead.
        </p>
      )}
      <div
        id="results-content"
        className="results-content"
        role="tabpanel"
        aria-labelledby={`${tab}-tab`}
      >
        {pending ? (
          <div className="empty-state" role="status">
            <LoaderCircle className="spin" size={42} strokeWidth={1.3} />
            <h3>Making the call…</h3>
            <p>
              Jev is evaluating your questions
              <br />
              against the same state.
            </p>
          </div>
        ) : !run ? (
          <div className="empty-state">
            <GitFork size={68} strokeWidth={1.15} />
            <h3>Ready when you are</h3>
            <p>
              Run an evaluation to see typed answers
              <br />
              and probability distributions.
            </p>
          </div>
        ) : (
          <>
            <div className="run-meta">
              <span className="success-dot" />
              <span>{run.durationMs.toLocaleString()} ms</span>
              <span>
                {run.response.usage.input_tokens.toLocaleString()} input tokens
              </span>
              <span>
                {run.response.usage.output_tokens.toLocaleString()} output
                tokens
              </span>
            </div>
            <p className="model-result mono">{run.response.model}</p>
            {tab === "json" ? (
              <pre className="json-output">{json}</pre>
            ) : (
              <div className="answer-list">
                {Object.entries(run.response.answers).map(([id, answer]) => (
                  <article className="answer" key={id}>
                    <div className="answer-top">
                      <span className={`type-text ${answer.type}`}>
                        {answer.type}
                      </span>
                      <span className="mono muted">{id}</span>
                    </div>
                    <p className="answer-question">
                      {typeof run.request.questions[id]?.instructions ===
                      "string"
                        ? (run.request.questions[id].instructions as string)
                        : JSON.stringify(
                            run.request.questions[id]?.instructions,
                          )}
                    </p>
                    <div className="answer-value">
                      <strong>
                        {answer.type === "choice"
                          ? answer.choice
                          : answer.type === "score"
                            ? answer.score.toFixed(2)
                            : `${(answer.noul * 100).toFixed(1)}%`}
                      </strong>
                      <span className="muted">
                        {answer.type === "noul"
                          ? "probability of yes"
                          : answer.type === "score"
                            ? ` / ${Object.keys(answer.legend).length - 1}`
                            : ""}
                      </span>
                    </div>
                    {answer.type === "noul" ? (
                      <Distribution
                        values={{ Yes: answer.noul, No: 1 - answer.noul }}
                      />
                    ) : (
                      <>
                        <div className="confidence">
                          <span title="Confidence describes the shape of the distribution; it is not the probability of the selected answer.">
                            Confidence
                          </span>
                          <span>{(answer.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <Distribution
                          values={answer.probabilities}
                          legend={
                            answer.type === "score" ? answer.legend : undefined
                          }
                        />
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
