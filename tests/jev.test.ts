import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRequest,
  requestSchema,
  responseSchema,
  toDrafts,
} from "../src/lib/jev";
import { examples } from "../src/lib/examples";

test("examples round-trip without changing state or criteria", () => {
  for (const { request } of examples) {
    const text = typeof request.state === "string";
    assert.deepEqual(
      buildRequest(
        text ? (request.state as string) : JSON.stringify(request.state),
        text ? "text" : "json",
        request.model,
        toDrafts(request),
      ),
      request,
    );
  }
});
test("duplicate IDs cannot silently overwrite questions", () => {
  const drafts = toDrafts(examples[0].request);
  drafts[1].id = drafts[0].id;
  assert.throws(
    () => buildRequest("text", "text", "jev-latest", drafts),
    /unique ID/,
  );
});
test("invalid JSON, blank state, missing questions and malformed criteria are rejected", () => {
  const drafts = toDrafts(examples[0].request);
  assert.throws(
    () => buildRequest("{", "json", "jev-latest", drafts),
    /valid JSON/,
  );
  assert.throws(() => buildRequest(" ", "text", "jev-latest", drafts));
  assert.throws(() => buildRequest("state", "text", "jev-latest", []));
  assert.throws(
    () =>
      buildRequest("state", "text", "jev-latest", [
        { ...drafts[0], criteria: "{" },
      ]),
    /criteria JSON/,
  );
  assert.equal(
    requestSchema.safeParse({
      model: "jev-latest",
      state: "x",
      questions: {
        q: { type: "score", instructions: "Severity?", criteria: ["low"] },
      },
    }).success,
    false,
  );
});
test("Noul omits optional criteria and does not need confidence", () => {
  const request = buildRequest("state", "text", "jev-latest", [
    {
      key: "q",
      id: "q",
      type: "noul",
      instructions: "Is it true?",
      criteria: "",
    },
  ]);
  assert.equal("criteria" in request.questions.q, false);
  assert.equal(
    responseSchema.safeParse({
      model: "jev-latest",
      answers: { q: { type: "noul", noul: 0.8 } },
      usage: { input_tokens: 10, output_tokens: 3 },
    }).success,
    true,
  );
});
test("invalid upstream probabilities are rejected", () => {
  assert.equal(
    responseSchema.safeParse({
      model: "jev-latest",
      answers: { q: { type: "noul", noul: 3 } },
      usage: { input_tokens: 10, output_tokens: 3 },
    }).success,
    false,
  );
});
