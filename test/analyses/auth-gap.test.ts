import { buildSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { authGapAnalysis } from "../../src/analyses/auth-gap.js";
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

// Deliberately uses non-default root type names to prove selectFields resolves
// the schema's actual Query/Mutation/Subscription types rather than assuming
// the literal names "Query"/"Mutation".
const schemaWithCustomRootNames = buildSchema(`
  schema {
    query: RootQuery
    mutation: RootMutation
  }

  type RootQuery {
    ping: String
  }

  type RootMutation {
    deleteAccount: Boolean
  }

  type User {
    email: String
  }
`);

describe("authGapAnalysis", () => {
  it("has stable identity metadata", () => {
    expect(authGapAnalysis.id).toBe("auth-gap");
    expect(authGapAnalysis.label).toBeTruthy();
    expect(authGapAnalysis.description).toBeTruthy();
    expect(authGapAnalysis.positiveLabel).toBeTruthy();
  });

  it("only selects fields on the schema's actual root Query/Mutation types", () => {
    const fields = [
      makeField({ path: "RootQuery.ping", parentType: "RootQuery", fieldName: "ping" }),
      makeField({ path: "RootMutation.deleteAccount", parentType: "RootMutation", fieldName: "deleteAccount" }),
      makeField({ path: "User.email", parentType: "User", fieldName: "email" }),
    ];

    const selected = authGapAnalysis.selectFields(fields, { schema: schemaWithCustomRootNames });

    expect(selected.map((f) => f.path)).toEqual(["RootQuery.ping", "RootMutation.deleteAccount"]);
  });

  it("excludes root fields that already carry an auth-related directive", () => {
    const fields = [
      makeField({ path: "RootQuery.ping", parentType: "RootQuery", fieldName: "ping", directives: [] }),
      makeField({
        path: "RootMutation.deleteAccount",
        parentType: "RootMutation",
        fieldName: "deleteAccount",
        directives: ["auth"],
      }),
    ];

    const selected = authGapAnalysis.selectFields(fields, { schema: schemaWithCustomRootNames });

    expect(selected.map((f) => f.path)).toEqual(["RootQuery.ping"]);
  });

  it("treats role/scope/permission/admin-named directives as access-control signals too", () => {
    const fields = [
      makeField({ path: "RootQuery.a", parentType: "RootQuery", directives: ["hasRole"] }),
      makeField({ path: "RootQuery.b", parentType: "RootQuery", directives: ["requiresScope"] }),
      makeField({ path: "RootQuery.c", parentType: "RootQuery", directives: ["permission"] }),
      makeField({ path: "RootQuery.d", parentType: "RootQuery", directives: ["isAdmin"] }),
      makeField({ path: "RootQuery.e", parentType: "RootQuery", directives: ["deprecated"] }),
    ];

    const selected = authGapAnalysis.selectFields(fields, { schema: schemaWithCustomRootNames });

    expect(selected.map((f) => f.path)).toEqual(["RootQuery.e"]);
  });

  it("treats @authenticated and @policy as access-control signals", () => {
    const fields = [
      makeField({ path: "RootQuery.a", parentType: "RootQuery", directives: ["authenticated"] }),
      makeField({ path: "RootQuery.b", parentType: "RootQuery", directives: ["policy"] }),
      makeField({ path: "RootQuery.c", parentType: "RootQuery", directives: ["deprecated"] }),
    ];

    const selected = authGapAnalysis.selectFields(fields, { schema: schemaWithCustomRootNames });

    expect(selected.map((f) => f.path)).toEqual(["RootQuery.c"]);
  });

  it("does not treat bare @scopes as sufficient access-control coverage", () => {
    const fields = [
      makeField({ path: "RootQuery.a", parentType: "RootQuery", directives: ["scopes"] }),
      makeField({ path: "RootQuery.b", parentType: "RootQuery", directives: ["requiresScope"] }),
    ];

    const selected = authGapAnalysis.selectFields(fields, { schema: schemaWithCustomRootNames });

    // @scopes alone doesn't count, but @requiresScope (a different directive
    // name) still does.
    expect(selected.map((f) => f.path)).toEqual(["RootQuery.a"]);
  });

  it("builds a question referencing the field's index and covering authorization", () => {
    const question = authGapAnalysis.buildQuestion(1);
    expect(question.instructions).toContain("fields[1]");
    expect(question.instructions.toLowerCase()).toMatch(/auth/);
    expect(question.criteria.true).toBeTruthy();
    expect(question.criteria.false).toBeTruthy();
  });
});
