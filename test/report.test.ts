import { describe, expect, it } from "vitest";
import type { Analysis } from "../src/analyses/types.js";
import type { AnalysisRunResult } from "../src/analysis-runner.js";
import { buildJsonReport, renderAnalysisSection, renderReport, renderSummary, renderTable } from "../src/report.js";
import type { ClassifiedField, TimingStats } from "../src/types.js";

const sampleTiming: TimingStats = {
  schemaLoadMs: 50,
  extractionMs: 1,
  classificationMs: 1200,
  totalMs: 1251,
};

function makeField(overrides: Partial<ClassifiedField>): ClassifiedField {
  return {
    path: "Thing.field",
    parentType: "Thing",
    parentKind: "OBJECT",
    fieldName: "field",
    fieldType: "String",
    description: null,
    args: [],
    directives: [],
    probability: 0,
    flagged: false,
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: "stub",
    label: "Stub Analysis",
    description: "desc",
    positiveLabel: "Stub Positive",
    selectFields: (fields) => fields,
    buildQuestion: (index) => ({ instructions: `q${index}`, criteria: { true: "y", false: "n" } }),
    ...overrides,
  };
}

function makeResult(overrides: Partial<AnalysisRunResult> = {}): AnalysisRunResult {
  return {
    analysis: makeAnalysis(),
    classified: [],
    model: "jev-latest",
    callCount: 1,
    ...overrides,
  };
}

describe("renderTable", () => {
  it("returns a message when nothing is flagged", () => {
    const output = renderTable([makeField({ probability: 0.1, flagged: false })], 0.6);
    expect(output).toContain("No fields flagged above threshold 0.6");
    expect(output).toContain("1 fields scanned");
  });

  it("renders flagged fields sorted by probability descending", () => {
    const fields = [
      makeField({ fieldName: "low", probability: 0.65, flagged: true }),
      makeField({ fieldName: "high", probability: 0.95, flagged: true }),
      makeField({ fieldName: "skipped", probability: 0.1, flagged: false }),
    ];

    const output = renderTable(fields, 0.6);
    expect(output).toContain("high");
    expect(output).toContain("low");
    expect(output).not.toContain("skipped");
    expect(output.indexOf("high")).toBeLessThan(output.indexOf("low"));
  });
});

describe("renderAnalysisSection", () => {
  it("prefixes the table with a header naming the analysis", () => {
    const result = makeResult({
      analysis: makeAnalysis({ id: "doc-quality", label: "Documentation & Naming" }),
      classified: [makeField({ fieldName: "x", probability: 0.9, flagged: true })],
    });

    const output = renderAnalysisSection(result, 0.6);
    expect(output).toContain("Documentation & Naming");
    expect(output).toContain("doc-quality");
    expect(output).toContain("x");
  });

  it("still shows the no-findings message when nothing is flagged", () => {
    const result = makeResult({
      analysis: makeAnalysis({ id: "auth-gap", label: "Auth Gaps" }),
      classified: [makeField({ fieldName: "x", probability: 0.1, flagged: false })],
    });

    const output = renderAnalysisSection(result, 0.6);
    expect(output).toContain("Auth Gaps");
    expect(output).toContain("No fields flagged above threshold 0.6");
  });
});

describe("renderReport", () => {
  it("joins one section per analysis result, in order", () => {
    const results = [
      makeResult({ analysis: makeAnalysis({ id: "pii", label: "PII" }) }),
      makeResult({ analysis: makeAnalysis({ id: "auth-gap", label: "Auth Gaps" }) }),
    ];

    const output = renderReport(results, 0.6);
    expect(output).toContain("PII");
    expect(output).toContain("Auth Gaps");
    expect(output.indexOf("PII")).toBeLessThan(output.indexOf("Auth Gaps"));
  });
});

describe("buildJsonReport", () => {
  it("includes one entry per analysis with its own fields, sorted by probability descending", () => {
    const results = [
      makeResult({
        analysis: makeAnalysis({ id: "pii", label: "PII" }),
        model: "jev-1",
        callCount: 2,
        classified: [
          makeField({ fieldName: "a", probability: 0.2, flagged: false }),
          makeField({ fieldName: "b", probability: 0.9, flagged: true }),
        ],
      }),
      makeResult({
        analysis: makeAnalysis({ id: "auth-gap", label: "Auth Gaps" }),
        model: "jev-1",
        callCount: 1,
        classified: [makeField({ fieldName: "c", probability: 0.7, flagged: true })],
      }),
    ];

    const report = buildJsonReport(results, {
      source: "schema/**/*.graphql",
      threshold: 0.6,
      timing: sampleTiming,
    });

    expect(report.threshold).toBe(0.6);
    expect(report.timing).toEqual(sampleTiming);
    expect(report.totalApiCallCount).toBe(3);
    expect(report.analyses).toHaveLength(2);

    const pii = report.analyses.find((a) => a.id === "pii");
    expect(pii?.totalFieldsScanned).toBe(2);
    expect(pii?.flaggedCount).toBe(1);
    expect(pii?.fields.map((f) => f.fieldName)).toEqual(["b", "a"]);
    expect(pii?.model).toBe("jev-1");

    const authGap = report.analyses.find((a) => a.id === "auth-gap");
    expect(authGap?.totalFieldsScanned).toBe(1);
    expect(authGap?.flaggedCount).toBe(1);
  });
});

describe("renderSummary", () => {
  it("reports per-analysis flag counts, total API calls, and timing breakdown", () => {
    const results = [
      makeResult({
        analysis: makeAnalysis({ id: "pii" }),
        callCount: 2,
        classified: [
          makeField({ fieldName: "a", probability: 0.2, flagged: false }),
          makeField({ fieldName: "b", probability: 0.9, flagged: true }),
        ],
      }),
      makeResult({
        analysis: makeAnalysis({ id: "auth-gap" }),
        callCount: 1,
        classified: [makeField({ fieldName: "c", probability: 0.7, flagged: true })],
      }),
    ];

    const summary = renderSummary(results, sampleTiming);

    expect(summary).toContain("2 analysis(es)");
    expect(summary).toContain("pii: 1/2 flagged");
    expect(summary).toContain("auth-gap: 1/1 flagged");
    expect(summary).toContain("3 API call(s)");
    expect(summary).toContain("1.25s");
    expect(summary).toContain("schema load 50ms");
    expect(summary).toContain("classification 1.20s");
  });
});
