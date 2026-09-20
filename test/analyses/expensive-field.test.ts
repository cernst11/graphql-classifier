import { buildSchema, type GraphQLSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { expensiveFieldAnalysis } from "../../src/analyses/expensive-field.js";
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
    name: String!
    orders: [Order!]!
    profile: Profile!
  }

  type Order {
    id: ID!
    total: Float!
  }

  type Profile {
    id: ID!
    bio: String
  }

  type Query {
    users: [User!]!
    user(id: ID!): User
  }
`);

describe("expensiveFieldAnalysis", () => {
  it("has stable identity metadata", () => {
    expect(expensiveFieldAnalysis.id).toBe("expensive-field");
    expect(expensiveFieldAnalysis.label).toBeTruthy();
    expect(expensiveFieldAnalysis.description).toBeTruthy();
    expect(expensiveFieldAnalysis.positiveLabel).toBeTruthy();
  });

  it("excludes scalar and enum fields entirely, even with no pagination args", () => {
    const fields = [
      makeField({ path: "User.id", parentType: "User", fieldName: "id", fieldType: "ID!" }),
      makeField({ path: "User.name", parentType: "User", fieldName: "name", fieldType: "String!" }),
      makeField({ path: "User.tags", parentType: "User", fieldName: "tags", fieldType: "[String!]!" }),
    ];
    expect(expensiveFieldAnalysis.selectFields(fields, { schema })).toEqual([]);
  });

  it("selects composite list fields with no pagination args", () => {
    const fields = [
      makeField({ path: "User.orders", parentType: "User", fieldName: "orders", fieldType: "[Order!]!" }),
    ];
    const selected = expensiveFieldAnalysis.selectFields(fields, { schema });
    expect(selected.map((f) => f.path)).toEqual(["User.orders"]);
  });

  it("excludes composite list fields that already have a pagination argument", () => {
    const fields = [
      makeField({
        path: "User.orders",
        parentType: "User",
        fieldName: "orders",
        fieldType: "[Order!]!",
        args: [{ name: "first", type: "Int" }],
      }),
      makeField({
        path: "User.posts",
        parentType: "User",
        fieldName: "posts",
        fieldType: "[Order!]!",
        args: [
          { name: "limit", type: "Int" },
          { name: "offset", type: "Int" },
        ],
      }),
    ];
    expect(expensiveFieldAnalysis.selectFields(fields, { schema })).toEqual([]);
  });

  it("selects to-one relation fields whose parent type appears in a list elsewhere in the schema", () => {
    const fields = [
      // Order appears as a list item via User.orders below, so Order's own
      // relation fields are at risk of N+1 across that list.
      makeField({ path: "User.orders", parentType: "User", fieldName: "orders", fieldType: "[Order!]!" }),
      makeField({ path: "Order.customer", parentType: "Order", fieldName: "customer", fieldType: "User!" }),
    ];
    const selected = expensiveFieldAnalysis.selectFields(fields, { schema });
    expect(selected.map((f) => f.path)).toContain("Order.customer");
  });

  it("excludes to-one relation fields whose parent type never appears in a list", () => {
    const fields = [
      makeField({ path: "Query.user", parentType: "Query", fieldName: "user", fieldType: "User" }),
      makeField({ path: "User.profile", parentType: "User", fieldName: "profile", fieldType: "Profile!" }),
    ];
    // Neither Query nor User appears as a list item type among these
    // fields, so neither relation field is selected.
    const selected = expensiveFieldAnalysis.selectFields(fields, { schema });
    expect(selected).toEqual([]);
  });

  it("builds a question referencing the field's index and covering N+1/pagination", () => {
    const question = expensiveFieldAnalysis.buildQuestion(3);
    expect(question.instructions).toContain("fields[3]");
    expect(question.instructions.toLowerCase()).toMatch(/n\+1|pagination|unbounded/);
    expect(question.criteria.true).toBeTruthy();
    expect(question.criteria.false).toBeTruthy();
  });
});
