import { buildSchema, type GraphQLSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { piiAnalysis } from "../../src/analyses/pii.js";
import type { FieldInfo } from "../../src/types.js";

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

const schema: GraphQLSchema = buildSchema("type Query { ping: String }");

describe("piiAnalysis", () => {
  it("has stable identity metadata", () => {
    expect(piiAnalysis.id).toBe("pii");
    expect(piiAnalysis.label).toBeTruthy();
    expect(piiAnalysis.description).toBeTruthy();
    expect(piiAnalysis.positiveLabel).toBeTruthy();
  });

  it("selects every field unchanged", () => {
    const fields = [makeField({ fieldName: "a" }), makeField({ fieldName: "b" })];
    expect(piiAnalysis.selectFields(fields, { schema })).toEqual(fields);
  });

  it("builds a question referencing the field's index with yes/no criteria", () => {
    const question = piiAnalysis.buildQuestion(3);
    expect(question.instructions).toContain("fields[3]");
    expect(question.instructions.toLowerCase()).toMatch(/pii|sensitive/);
    expect(question.criteria.true).toBeTruthy();
    expect(question.criteria.false).toBeTruthy();
  });
});
