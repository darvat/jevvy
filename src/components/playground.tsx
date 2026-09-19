"use client";

import { useRef, useState } from "react";
import {
  Play,
  Clock3,
  BookOpen,
  ExternalLink,
  CircleCheck,
  Plus,
  ArrowLeft,
  LoaderCircle,
  Rocket,
} from "lucide-react";
import { examples, defaultCriteria } from "@/lib/examples";
import {
  buildRequest,
  toDrafts,
  type DraftQuestion,
  type EvaluationRequest,
  type Run,
} from "@/lib/jev";
import { QuestionEditor } from "./question-editor";
import { Results } from "./results";

const initial = examples[0].request;

export function Playground({ configured }: { configured: boolean }) {
  const [state, setState] = useState(initial.state as string);
  const [stateMode, setStateMode] = useState<"text" | "json">("text");
  const [model, setModel] = useState(initial.model);
  const [questions, setQuestions] = useState(() => toDrafts(initial));
  const [example, setExample] = useState("support");
  const [page, setPage] = useState("playground");
  const [run, setRun] = useState<Run | null>(null);
  const [history, setHistory] = useState<Run[]>([]);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");

  function changed() {
    setRun(null);
    setError("");
    setExample("custom");
  }
  function load(request: EvaluationRequest) {
    setState(
      typeof request.state === "string"
        ? request.state
        : JSON.stringify(request.state, null, 2),
    );
    setStateMode(typeof request.state === "string" ? "text" : "json");
    setModel(request.model);
    setQuestions(toDrafts(request));
    setError("");
  }
  function updateQuestion(q: DraftQuestion) {
    changed();
    setQuestions((current) =>
      current.map((item) => (item.key === q.key ? q : item)),
    );
  }
  let preview = "";
  try {
    preview = JSON.stringify(
      buildRequest(state, stateMode, model, questions),
      null,
      2,
    );
  } catch (e) {
    preview = e instanceof Error ? e.message : "Invalid request";
  }

  async function evaluate() {
    if (busy.current) return;
    setError("");
    let request: EvaluationRequest;
    try {
      request = buildRequest(state, stateMode, model, questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your request.");
      return;
    }
    busy.current = true;
    setPending(true);
    setRun(null);
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(55_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Evaluation failed.");
      const completed: Run = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        request,
        response: data.response,
        durationMs: data.durationMs,
      };
      setRun(completed);
      setHistory((current) => [completed, ...current].slice(0, 20));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not complete the evaluation. Try again.",
      );
    } finally {
      setPending(false);
      busy.current = false;
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Jev playground home">
          <strong>jev</strong>
          <span>/ playground</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={page === "playground" ? "nav-link active" : "nav-link"}
            onClick={() => setPage("playground")}
          >
            <Play size={18} />
            Playground
          </button>
          <button
            className={page === "history" ? "nav-link active" : "nav-link"}
            onClick={() => setPage("history")}
          >
            <Clock3 size={18} />
            Run history
            {history.length > 0 && (
              <span className="history-count">{history.length}</span>
            )}
          </button>
          <a
            className="nav-link"
            href="https://docs.typesafe.ai/introduction"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={18} />
            Documentation
            <ExternalLink size={13} className="external" />
          </a>
          <a className="nav-link" href="/arcade">
            <Rocket size={18} />
            Space shooter
          </a>
        </nav>
        <div className="sidebar-footer">
          <strong>TypeSafe AI</strong>
          <span>Typed decisions for your code.</span>
        </div>
      </aside>
      <main>
        <header className="page-header">
          <div>
            <h1>
              {page === "playground"
                ? "A little context. A clear decision."
                : "Your experiments, in one place."}
            </h1>
            <p>
              {page === "playground"
                ? "Explore typed decisions with Jev."
                : "Revisit the last 20 runs from this session."}
            </p>
          </div>
          <div
            className={`key-status ${configured ? "configured" : "missing"}`}
          >
            <CircleCheck size={15} />
            <div>
              <span>
                {configured ? "Server key configured" : "Server key missing"}
              </span>
              <small>
                {configured
                  ? "Ready to run evaluations."
                  : "Add JEV_API_KEY to .env."}
              </small>
            </div>
          </div>
        </header>
        {page === "history" ? (
          <section className="history-panel panel">
            <div className="section-heading">
              <h2>Run history</h2>
              <button
                className="secondary-button"
                onClick={() => setHistory([])}
                disabled={!history.length}
              >
                Clear history
              </button>
            </div>
            {history.length ? (
              <div className="history-list">
                {history.map((item) => (
                  <button
                    className="history-row"
                    key={item.id}
                    onClick={() => {
                      load(item.request);
                      setRun(item);
                      setExample("custom");
                      setPage("playground");
                    }}
                  >
                    <div>
                      <strong>
                        {typeof item.request.state === "string"
                          ? item.request.state
                          : JSON.stringify(item.request.state)}
                      </strong>
                      <span>
                        {new Date(item.date).toLocaleTimeString()} ·{" "}
                        {Object.keys(item.request.questions).length} questions ·{" "}
                        {item.response.model}
                      </span>
                    </div>
                    <span className="mono">{item.durationMs} ms</span>
                    <ArrowLeft className="history-arrow" size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="history-empty">
                <Clock3 size={38} strokeWidth={1.3} />
                <h3>No evaluations yet</h3>
                <p>Run a question in the playground to start your history.</p>
                <button
                  className="secondary-button"
                  onClick={() => setPage("playground")}
                >
                  Open playground
                </button>
              </div>
            )}
          </section>
        ) : (
          <>
            <fieldset className="workspace-fieldset" disabled={pending}>
              <div className="toolbar panel">
                <label>
                  Example
                  <select
                    aria-label="Example"
                    value={example}
                    onChange={(e) => {
                      const found = examples.find(
                        (item) => item.id === e.target.value,
                      );
                      if (found) {
                        load(found.request);
                        setExample(found.id);
                        setRun(null);
                      }
                    }}
                  >
                    <option value="custom" disabled>
                      Custom experiment
                    </option>
                    {examples.map((e) => (
                      <option value={e.id} key={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Model
                  <input
                    className="model-input mono"
                    aria-label="Model"
                    list="models"
                    value={model}
                    onChange={(e) => {
                      changed();
                      setModel(e.target.value);
                    }}
                  />
                  <datalist id="models">
                    <option value="jev-latest" />
                    <option value="jev-preview" />
                    <option value="jev-1.13.0" />
                  </datalist>
                </label>
              </div>
              <div className="workspace">
                <form
                  className="editor-panel panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void evaluate();
                  }}
                >
                  <section className="state-section">
                    <div className="section-title">
                      <span className="step">01</span>
                      <div>
                        <h2>State</h2>
                        <p>The shared context Jev will evaluate.</p>
                      </div>
                      <select
                        className="state-mode"
                        aria-label="State format"
                        value={stateMode}
                        onChange={(e) => {
                          changed();
                          setStateMode(e.target.value as "text" | "json");
                        }}
                      >
                        <option value="text">Text</option>
                        <option value="json">JSON</option>
                      </select>
                    </div>
                    <textarea
                      className="state-input code-input"
                      aria-label="State"
                      spellCheck={false}
                      value={state}
                      onChange={(e) => {
                        changed();
                        setState(e.target.value);
                      }}
                      placeholder="Paste the text or context you want to evaluate…"
                    />
                  </section>
                  <section className="questions-section">
                    <div className="section-title">
                      <span className="step">02</span>
                      <div>
                        <h2>Questions</h2>
                        <p>One focused judgment per question.</p>
                      </div>
                      <button
                        type="button"
                        className="add-question icon-button"
                        aria-label="Add question"
                        disabled={questions.length >= 50}
                        onClick={() => {
                          changed();
                          const key = crypto.randomUUID();
                          setQuestions((current) => [
                            ...current,
                            {
                              key,
                              id: `question_${key.slice(0, 8)}`,
                              type: "noul",
                              instructions: "",
                              criteria: defaultCriteria.noul,
                            },
                          ]);
                        }}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="question-list">
                      {questions.map((q, i) => (
                        <QuestionEditor
                          key={q.key}
                          question={q}
                          index={i}
                          onChange={updateQuestion}
                          onRemove={() => {
                            changed();
                            setQuestions((current) =>
                              current.filter((item) => item.key !== q.key),
                            );
                          }}
                        />
                      ))}
                    </div>
                    {questions.length === 0 && (
                      <p className="muted">
                        Add a question with the + button to get started.
                      </p>
                    )}
                  </section>
                  {error && (
                    <div className="error" role="alert">
                      {error}
                    </div>
                  )}
                  <div className="run-controls">
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={!configured || pending}
                    >
                      {pending ? (
                        <LoaderCircle size={17} className="spin" />
                      ) : (
                        <Play size={17} />
                      )}
                      {pending ? "Evaluating…" : "Run evaluation"}
                    </button>
                    <span>
                      {questions.length}{" "}
                      {questions.length === 1 ? "question" : "questions"} ·
                      evaluated independently
                    </span>
                  </div>
                  <details className="request-preview">
                    <summary>Inspect request JSON</summary>
                    <pre>{preview}</pre>
                  </details>
                </form>
                <Results run={run} pending={pending} />
              </div>
            </fieldset>
            <footer className="main-footer">
              One state. Independent questions. Structured answers.
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
