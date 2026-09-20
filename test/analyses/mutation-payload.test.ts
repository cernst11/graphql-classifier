import { buildSchema, type GraphQLSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { mutationPayloadAnalysis } from "../../src/analyses/mutation-payload.js";
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

const schemaWithCustomRootNames: GraphQLSchema = buildSchema(`
  schema {
    query: RootQuery
    mutation: RootMutation
  }

  type RootQuery {
    ping: String
  }

  type RootMutation {
    noop: Boolean
  }

  type User {
    id: ID!
  }
`);

describe("mutationPayloadAnalysis", () => {
  it("has stable identity metadata", () => {
    expect(mutationPayloadAnalysis.id).toBe("mutation-payload");
    expect(mutationPayloadAnalysis.label).toBeTruthy();
    expect(mutationPayloadAnalysis.description).toBeTruthy();
    expect(mutationPayloadAnalysis.positiveLabel).toBeTruthy();
  });

  it("only selects fields on the schema's actual root Mutation type", () => {
    const fields = [
      makeField({
        path: "RootMutation.createUser",
        parentType: "RootMutation",
        fieldName: "createUser",
        fieldType: "User!",
      }),
      makeField({ path: "RootQuery.ping", parentType: "RootQuery", fieldName: "ping", fieldType: "String" }),
      makeField({ path: "User.id", parentType: "User", fieldName: "id", fieldType: "ID!" }),
    ];

    const selected = mutationPayloadAnalysis.selectFields(fields, { schema: schemaWithCustomRootNames });

    expect(selected.map((f) => f.path)).toEqual(["RootMutation.createUser"]);
  });

  it("excludes mutations that already return a Payload- or Result-suffixed type", () => {
    const fields = [
      makeField({
        path: "RootMutation.createUser",
        parentType: "RootMutation",
        fieldName: "createUser",
        fieldType: "CreateUserPayload!",
      }),
      makeField({
        path: "RootMutation.deleteUser",
        parentType: "RootMutation",
        fieldName: "deleteUser",
        fieldType: "DeleteUserResult",
      }),
      makeField({
        path: "RootMutation.updateUser",
        parentType: "RootMutation",
        fieldName: "updateUser",
        fieldType: "User!",
      }),
    ];

    const selected = mutationPayloadAnalysis.selectFields(fields, { schema: schemaWithCustomRootNames });

    expect(selected.map((f) => f.path)).toEqual(["RootMutation.updateUser"]);
  });

  it("builds a question referencing the field's index and the payload/result pattern", () => {
    const question = mutationPayloadAnalysis.buildQuestion(1);
    expect(question.instructions).toContain("fields[1]");
    expect(question.instructions.toLowerCase()).toMatch(/payload|result/);
    expect(question.criteria.true).toBeTruthy();
    expect(question.criteria.false).toBeTruthy();
  });
});
