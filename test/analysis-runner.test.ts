import { buildSchema } from "graphql";
import { describe, expect, it } from "vitest";
import type { Analysis } from "../src/analyses/types.js";
import { runAnalyses } from "../src/analysis-runner.js";
import type { ClassifierClient } from "../src/classifier.js";
import type { FieldInfo } from "../src/types.js";

function makeField(overrides: Partial<FieldInfo> = {}): FieldInfo {
  return {
    path: "Thing.field",
    parentType: "Thing",
    parentKind: "OBJECT",
    fieldName: "field",
    fieldType: "String",
    description: null,
    args: [],
    directives: [],
    ...overrides,
  };
}

function makeAnalysis(id: string, selectFields: Analysis["selectFields"]): Analysis {
  return {
    id,
    label: id,
    description: id,
    positiveLabel: id,
    selectFields,
    buildQuestion: (index) => ({ instructions: `q${index}`, criteria: { true: "y", false: "n" } }),
  };
}

const client: ClassifierClient = {
  async classifyBatch(fields) {
    return { answers: new Map(fields.map((f) => [f.path, 0.9])), model: "fake" };
  },
};

describe("runAnalyses", () => {
  const schema = buildSchema("type Query { ping: String }");
  const allFields = [makeField({ path: "A.a", fieldName: "a" }), makeField({ path: "B.b", fieldName: "b" })];

  it("runs each analysis against its own selected field subset", async () => {
    const analysisA = makeAnalysis("a-only", (fields) => fields.filter((f) => f.path === "A.a"));
    const analysisB = makeAnalysis("b-only", (fields) => fields.filter((f) => f.path === "B.b"));

    const results = await runAnalyses([analysisA, analysisB], allFields, schema, client, {
      threshold: 0.6,
      concurrency: 2,
    });

    expect(results).toHaveLength(2);
    expect(results[0].analysis.id).toBe("a-only");
    expect(results[0].classified.map((f) => f.path)).toEqual(["A.a"]);
    expect(results[1].analysis.id).toBe("b-only");
    expect(results[1].classified.map((f) => f.path)).toEqual(["B.b"]);
  });

  it("passes the schema through to each analysis's selectFields", async () => {
    let receivedSchema: unknown;
    const analysis = makeAnalysis("schema-check", (fields, context) => {
      receivedSchema = context.schema;
      return fields;
    });

    await runAnalyses([analysis], allFields, schema, client, { threshold: 0.6, concurrency: 1 });

    expect(receivedSchema).toBe(schema);
  });

  it("reports independent call counts and models per analysis", async () => {
    const manyFields = Array.from({ length: 30 }, (_, i) => makeField({ path: `X.f${i}`, fieldName: `f${i}` }));
    const analysis = makeAnalysis("all", (fields) => fields);

    const results = await runAnalyses([analysis], manyFields, schema, client, {
      threshold: 0.6,
      concurrency: 5,
    });

    expect(results[0].callCount).toBe(2);
    expect(results[0].model).toBe("fake");
  });

  it("returns results in the same order the analyses were requested", async () => {
    const first = makeAnalysis("first", (fields) => fields);
    const second = makeAnalysis("second", (fields) => fields);
    const third = makeAnalysis("third", (fields) => fields);

    const results = await runAnalyses([first, second, third], allFields, schema, client, {
      threshold: 0.6,
      concurrency: 3,
    });

    expect(results.map((r) => r.analysis.id)).toEqual(["first", "second", "third"]);
  });
});
