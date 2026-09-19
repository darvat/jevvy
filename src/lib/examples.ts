import type { EvaluationRequest } from "./jev";

export const examples: {
  id: string;
  name: string;
  request: EvaluationRequest;
}[] = [
  {
    id: "support",
    name: "Support triage",
    request: {
      model: "jev-latest",
      state:
        "I was charged twice for my subscription and need a refund. Please help before my renewal tomorrow.",
      questions: {
        department: {
          type: "choice",
          instructions: "Which team should handle this request?",
          criteria: {
            Billing: "Charges, payments, subscriptions, and refunds",
            "Technical support": "Bugs, outages, and integrations",
            Sales: "Pricing, upgrades, and new accounts",
          },
        },
        urgency: {
          type: "score",
          instructions: "How urgent is this request?",
          criteria: [
            "No deadline; a general question",
            "Needs attention soon, but no immediate deadline",
            "A specific deadline within a day",
            "Customer cannot continue working; immediate action needed",
            "Critical ongoing outage or immediate risk of data loss",
          ],
        },
        refund_requested: {
          type: "noul",
          instructions: "The customer is asking for a refund.",
        },
      },
    },
  },
  {
    id: "review",
    name: "Product feedback",
    request: {
      model: "jev-latest",
      state:
        "The new dashboard looks fantastic, but exporting a CSV takes forever and sometimes fails. I use this every Monday for my team report. Please bring back the old export button.",
      questions: {
        topic: {
          type: "choice",
          instructions: "What is the main subject of this feedback?",
          criteria: {
            Design: "Visual appearance or layout",
            Performance: "Speed or reliability of a feature",
            Pricing: "Cost or value",
            Other: "None of these topics",
          },
        },
        sentiment: {
          type: "score",
          instructions:
            "How satisfied is the customer with the product overall?",
          criteria: [
            "Entirely dissatisfied; nothing positive",
            "Mostly dissatisfied, with some positives",
            "Mixed positives and negatives in equal measure",
            "Mostly satisfied, with minor concerns",
            "Entirely satisfied; no concerns",
          ],
        },
        feature_request: {
          type: "noul",
          instructions: "Does the customer request a product change?",
        },
      },
    },
  },
  {
    id: "bug",
    name: "Bug severity · JSON state",
    request: {
      model: "jev-latest",
      state: {
        report: "Export crashes in Safari, but works in Chrome.",
        affected_users: "Some customers only have access to Safari.",
        workaround: "Use Chrome if available.",
      },
      questions: {
        severity: {
          type: "score",
          instructions: "How severe is the reported bug?",
          criteria: [
            "Cosmetic issue with no functional impact",
            "Degraded feature with a usable workaround",
            "Blocking issue with no usable workaround",
          ],
        },
        browser_specific: {
          type: "noul",
          instructions: "Is the issue specific to one browser?",
        },
        team: {
          type: "choice",
          instructions: "Which team should investigate first?",
          criteria: {
            Frontend: "Browser interface or compatibility issues",
            Backend: "Server or database issues",
            Infrastructure: "Hosting or network availability",
            Unknown: "Insufficient evidence to identify a team",
          },
        },
      },
    },
  },
];

export const defaultCriteria = {
  choice: JSON.stringify(
    {
      option_a: "Describe the first option",
      option_b: "Describe the second option",
    },
    null,
    2,
  ),
  score: JSON.stringify(
    ["Describe the low end", "Describe the middle", "Describe the high end"],
    null,
    2,
  ),
  noul: "",
};
