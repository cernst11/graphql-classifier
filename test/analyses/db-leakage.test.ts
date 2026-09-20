import { buildSchema, type GraphQLSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { dbLeakageAnalysis } from "../../src/analyses/db-leakage.js";
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

const schema: GraphQLSchema = buildSchema(`
  type User {
    id: ID!
  }

  type Author {
    id: ID!
  }

  type Order {
    id: ID!
  }

  type Query {
    order(id: ID!): Order
  }
`);

describe("dbLeakageAnalysis", () => {
  it("has stable identity metadata", () => {
    expect(dbLeakageAnalysis.id).toBe("db-leakage");
    expect(dbLeakageAnalysis.label).toBeTruthy();
    expect(dbLeakageAnalysis.description).toBeTruthy();
    expect(dbLeakageAnalysis.positiveLabel).toBeTruthy();
  });

  it("selects a scalar field whose name matches another type defined in the schema", () => {
    const fields = [
      makeField({ path: "Order.authorId", parentType: "Order", fieldName: "authorId", fieldType: "ID!" }),
      makeField({ path: "Order.userID", parentType: "Order", fieldName: "userID", fieldType: "String" }),
    ];

    const selected = dbLeakageAnalysis.selectFields(fields, { schema });

    expect(selected.map((f) => f.path)).toEqual(["Order.authorId", "Order.userID"]);
  });

  it("does not select the field literally named id", () => {
    const fields = [makeField({ path: "User.id", parentType: "User", fieldName: "id", fieldType: "ID!" })];
    expect(dbLeakageAnalysis.selectFields(fields, { schema })).toEqual([]);
  });

  it("does not select a scalar id-like field whose base name matches no real type", () => {
    const fields = [
      makeField({ path: "Order.externalId", parentType: "Order", fieldName: "externalId", fieldType: "String" }),
      makeField({ path: "Order.validId", parentType: "Order", fieldName: "validId", fieldType: "Boolean" }),
    ];
    expect(dbLeakageAnalysis.selectFields(fields, { schema })).toEqual([]);
  });

  it("does not select input object fields, even when they look like an FK (inputs must use scalar refs)", () => {
    const fields = [
      makeField({
        path: "CreateOrderInput.userId",
        parentType: "CreateOrderInput",
        parentKind: "INPUT_OBJECT",
        fieldName: "userId",
        fieldType: "ID!",
      }),
    ];
    expect(dbLeakageAnalysis.selectFields(fields, { schema })).toEqual([]);
  });

  it("does not select list-typed id fields even when the name matches a real type", () => {
    const fields = [
      makeField({ path: "Order.userId", parentType: "Order", fieldName: "userId", fieldType: "[ID!]!" }),
    ];
    expect(dbLeakageAnalysis.selectFields(fields, { schema })).toEqual([]);
  });

  it("builds a question referencing the field's index and the relation pattern", () => {
    const question = dbLeakageAnalysis.buildQuestion(0);
    expect(question.instructions).toContain("fields[0]");
    expect(question.instructions.toLowerCase()).toMatch(/foreign.key|relation/);
    expect(question.criteria.true).toBeTruthy();
    expect(question.criteria.false).toBeTruthy();
  });
});
