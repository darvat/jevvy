"use client";

import {
  CircleCheck,
  ChartNoAxesColumnIncreasing,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { defaultCriteria } from "@/lib/examples";
import type { DraftQuestion, QuestionType } from "@/lib/jev";

export function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: DraftQuestion;
  index: number;
  onChange: (q: DraftQuestion) => void;
  onRemove: () => void;
}) {
  let summary: string[] = [];
  try {
    const criteria = JSON.parse(question.criteria);
    summary =
      question.type === "choice"
        ? Object.keys(criteria)
        : Array.isArray(criteria)
          ? [`${criteria.length} levels · 0–${criteria.length - 1}`]
          : [];
  } catch {
    /* The editable JSON can be incomplete. Validation runs on submit. */
  }
  const Icon =
    question.type === "choice"
      ? CircleCheck
      : question.type === "score"
        ? ChartNoAxesColumnIncreasing
        : ToggleRight;
  return (
    <article className={`question question-${question.type}`}>
      <div className="question-toolbar">
        <div className="type-select">
          <Icon size={15} />
          <select
            aria-label={`Question ${index + 1} type`}
            value={question.type}
            onChange={(e) =>
              onChange({
                ...question,
                type: e.target.value as QuestionType,
                criteria: defaultCriteria[e.target.value as QuestionType],
              })
            }
          >
            <option value="choice">Choice</option>
            <option value="score">Score</option>
            <option value="noul">Noul</option>
          </select>
        </div>
        <input
          className="question-id"
          aria-label={`Question ${index + 1} ID`}
          value={question.id}
          onChange={(e) => onChange({ ...question, id: e.target.value })}
          placeholder="question_id"
          maxLength={100}
        />
        <button
          type="button"
          className="icon-button"
          aria-label={`Remove question ${index + 1}`}
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <input
        className="instruction-input"
        aria-label={`Question ${index + 1} instructions`}
        value={question.instructions}
        onChange={(e) =>
          onChange({ ...question, instructions: e.target.value })
        }
        placeholder={
          question.type === "noul"
            ? "A statement to evaluate…"
            : "What would you like to know?"
        }
      />
      <details className="criteria-editor">
        <summary>
          <span className="criteria-label">
            {question.type === "choice"
              ? "Options"
              : question.type === "score"
                ? "Scale"
                : "Criteria"}
          </span>
          <span className="criteria-summary">
            {summary.length ? (
              summary.map((s) => (
                <span className="option-chip" key={s}>
                  {s}
                </span>
              ))
            ) : (
              <span className="muted">
                {question.type === "noul"
                  ? "Optional yes / no definitions"
                  : "Edit criteria"}
              </span>
            )}
          </span>
          <span className="edit-link">Edit</span>
        </summary>
        <label
          className="criteria-description"
          htmlFor={`criteria-${question.key}`}
        >
          {question.type === "choice"
            ? "JSON object: option names and their descriptions (2–255 options)."
            : question.type === "score"
              ? "JSON array: 2–10 descriptive levels, ordered low to high. Levels start at 0."
              : 'Optional JSON object with "true" and "false" descriptions. Leave empty to omit.'}
        </label>
        <textarea
          id={`criteria-${question.key}`}
          className="code-input"
          spellCheck={false}
          rows={7}
          value={question.criteria}
          onChange={(e) => onChange({ ...question, criteria: e.target.value })}
          placeholder={
            question.type === "noul"
              ? '{ "true": "What yes means", "false": "What no means" }'
              : undefined
          }
        />
      </details>
    </article>
  );
}
