import { describe, expect, it } from "vitest";
import type { Analysis } from "../src/analyses/types.js";
import { classifyFields, type ClassifierClient } from "../src/classifier.js";
import type { FieldInfo } from "../src/types.js";

function makeField(fieldName: string, overrides: Partial<FieldInfo> = {}): FieldInfo {
  return {
    path: `Thing.${fieldName}`,
    parentType: "Thing",
    parentKind: "OBJECT",
    fieldName,
    fieldType: "String",
    description: null,
    args: [],
    directives: [],
    ...overrides,
  };
}

const stubAnalysis: Analysis = {
  id: "stub",
  label: "Stub Analysis",
  description: "Test-only analysis",
  positiveLabel: "Stub Positive",
  selectFields: (fields) => fields,
  buildQuestion: (index) => ({
    instructions: `Is fields[${index}] sensitive?`,
    criteria: { true: "yes", false: "no" },
  }),
};

const SENSITIVE_KEYWORDS = ["ssn", "creditcard", "email", "password"];

class FakeClassifierClient implements ClassifierClient {
  calls: FieldInfo[][] = [];

  async classifyBatch(fields: FieldInfo[]) {
    this.calls.push(fields);
    const answers = new Map<string, number>();
    for (const field of fields) {
      const isSensitive = SENSITIVE_KEYWORDS.some((keyword) =>
        field.fieldName.toLowerCase().includes(keyword),
      );
      answers.set(field.path, isSensitive ? 0.9 : 0.05);
    }
    return { answers, model: "fake-model" };
  }
}

describe("classifyFields", () => {
  it("flags fields at or above the threshold", async () => {
    const fields = [makeField("email"), makeField("id")];
    const client = new FakeClassifierClient();

    const { classified } = await classifyFields(fields, stubAnalysis, client, {
      threshold: 0.6,
      concurrency: 2,
    });

    expect(classified.find((f) => f.fieldName === "email")?.flagged).toBe(true);
    expect(classified.find((f) => f.fieldName === "id")?.flagged).toBe(false);
  });

  it("flags exactly at the threshold boundary", async () => {
    const fields = [makeField("creditCardNumber")];
    const client = new FakeClassifierClient();

    const { classified } = await classifyFields(fields, stubAnalysis, client, {
      threshold: 0.9,
      concurrency: 1,
    });

    expect(classified[0].flagged).toBe(true);
  });

  it("chunks fields into batches of 25", async () => {
    const fields = Array.from({ length: 60 }, (_, i) => makeField(`field${i}`));
    const client = new FakeClassifierClient();

    await classifyFields(fields, stubAnalysis, client, { threshold: 0.6, concurrency: 10 });

    expect(client.calls.length).toBe(3);
    expect(client.calls[0].length).toBe(25);
    expect(client.calls[1].length).toBe(25);
    expect(client.calls[2].length).toBe(10);
  });

  it("bounds concurrency to the configured limit", async () => {
    let active = 0;
    let maxActive = 0;

    const client: ClassifierClient = {
      async classifyBatch(fields) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return { answers: new Map(fields.map((f) => [f.path, 0.1])), model: "fake" };
      },
    };

    const fields = Array.from({ length: 100 }, (_, i) => makeField(`f${i}`));
    await classifyFields(fields, stubAnalysis, client, { threshold: 0.6, concurrency: 2 });

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("normalizes empty descriptions without throwing", async () => {
    const fields = [makeField("email", { description: null })];
    const client = new FakeClassifierClient();

    await expect(
      classifyFields(fields, stubAnalysis, client, { threshold: 0.6, concurrency: 1 }),
    ).resolves.toBeDefined();
  });

  it("returns an empty result for no fields", async () => {
    const client = new FakeClassifierClient();
    const { classified, callCount } = await classifyFields([], stubAnalysis, client, {
      threshold: 0.6,
      concurrency: 1,
    });
    expect(classified).toEqual([]);
    expect(callCount).toBe(0);
  });

  it("passes the analysis through to the client for question building", async () => {
    const fields = [makeField("email")];
    let receivedAnalysisId: string | undefined;
    const client: ClassifierClient = {
      async classifyBatch(batchFields, analysis) {
        receivedAnalysisId = analysis.id;
        return { answers: new Map(batchFields.map((f) => [f.path, 0.1])), model: "fake" };
      },
    };

    await classifyFields(fields, stubAnalysis, client, { threshold: 0.6, concurrency: 1 });

    expect(receivedAnalysisId).toBe("stub");
  });
});
