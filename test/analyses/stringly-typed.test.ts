import { buildSchema, type GraphQLSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { stringlyTypedAnalysis } from "../../src/analyses/stringly-typed.js";
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

describe("stringlyTypedAnalysis", () => {
  it("has stable identity metadata", () => {
    expect(stringlyTypedAnalysis.id).toBe("stringly-typed");
    expect(stringlyTypedAnalysis.label).toBeTruthy();
    expect(stringlyTypedAnalysis.description).toBeTruthy();
    expect(stringlyTypedAnalysis.positiveLabel).toBeTruthy();
  });

  it("selects only plain String-typed fields", () => {
    const fields = [
      makeField({ path: "A.status", fieldName: "status", fieldType: "String!" }),
      makeField({ path: "A.name", fieldName: "name", fieldType: "String" }),
      makeField({ path: "A.count", fieldName: "count", fieldType: "Int" }),
      makeField({ path: "A.id", fieldName: "id", fieldType: "ID!" }),
      makeField({ path: "A.createdAt", fieldName: "createdAt", fieldType: "DateTime!" }),
      makeField({ path: "A.tags", fieldName: "tags", fieldType: "[String!]!" }),
    ];

    const selected = stringlyTypedAnalysis.selectFields(fields, { schema });

    expect(selected.map((f) => f.path)).toEqual(["A.status", "A.name"]);
  });

  it("builds a question about enum candidacy", () => {
    const question = stringlyTypedAnalysis.buildQuestion(2);
    expect(question.instructions).toContain("fields[2]");
    expect(question.instructions.toLowerCase()).toMatch(/enum/);
    expect(question.criteria.true).toBeTruthy();
    expect(question.criteria.false).toBeTruthy();
  });
});
