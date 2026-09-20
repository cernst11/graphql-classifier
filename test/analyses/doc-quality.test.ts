import { buildSchema, type GraphQLSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { argumentNamingRule } from "../../src/analyses/doc-quality/argument-naming.js";
import { booleanPrefixRule } from "../../src/analyses/doc-quality/boolean-prefix.js";
import { descriptionRule } from "../../src/analyses/doc-quality/description.js";
import { docQualityAnalyses } from "../../src/analyses/doc-quality/index.js";
import { mutationVerbNounRule } from "../../src/analyses/doc-quality/mutation-verb-noun.js";
import { namingClarityRule } from "../../src/analyses/doc-quality/naming-clarity.js";
import { namingStyleRule } from "../../src/analyses/doc-quality/naming-style.js";
import { pluralCollectionRule } from "../../src/analyses/doc-quality/plural-collection.js";
import type { Analysis } from "../../src/analyses/types.js";
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

const schemaWithCustomMutationName = buildSchema(`
  schema {
    query: RootQuery
    mutation: RootMutation
  }

  type RootQuery {
    ping: String
  }

  type RootMutation {
    process: Boolean
  }

  type User {
    id: ID!
  }
`);

function expectMetadata(rule: Analysis) {
  expect(rule.id).toBeTruthy();
  expect(rule.label).toBeTruthy();
  expect(rule.description).toBeTruthy();
  expect(rule.positiveLabel).toBeTruthy();
  expect(typeof rule.selectFields).toBe("function");
  expect(typeof rule.buildQuestion).toBe("function");
}

function expectQuestionShape(rule: Analysis, keyword: RegExp) {
  const question = rule.buildQuestion(2);
  expect(question.instructions).toContain("fields[2]");
  expect(question.instructions.toLowerCase()).toMatch(keyword);
  expect(question.criteria.true).toBeTruthy();
  expect(question.criteria.false).toBeTruthy();
}

describe("docQualityAnalyses", () => {
  it("registers all seven rules with unique, stable ids", () => {
    const ids = docQualityAnalyses.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice().sort()).toEqual([
      "doc-argument-naming",
      "doc-boolean-prefix",
      "doc-description",
      "doc-mutation-verb-noun",
      "doc-naming-clarity",
      "doc-naming-style",
      "doc-plural-collection",
    ]);
  });
});

describe("descriptionRule", () => {
  it("has stable identity metadata", () => expectMetadata(descriptionRule));

  it("selects every field unchanged", () => {
    const fields = [makeField({ fieldName: "a" }), makeField({ fieldName: "b" })];
    expect(descriptionRule.selectFields(fields, { schema: schemaWithCustomMutationName })).toEqual(fields);
  });

  it("builds a question about description quality", () => {
    expectQuestionShape(descriptionRule, /description/);
  });
});

describe("namingStyleRule", () => {
  it("has stable identity metadata", () => expectMetadata(namingStyleRule));

  it("selects every field unchanged", () => {
    const fields = [makeField({ fieldName: "a" })];
    expect(namingStyleRule.selectFields(fields, { schema: schemaWithCustomMutationName })).toEqual(fields);
  });

  it("builds a question covering casing and Hungarian notation", () => {
    const question = namingStyleRule.buildQuestion(1);
    expect(question.instructions).toContain("fields[1]");
    expect(question.instructions).toMatch(/camelCase/);
    expect(question.instructions.toLowerCase()).toMatch(/hungarian/);
  });
});

describe("namingClarityRule", () => {
  it("has stable identity metadata", () => expectMetadata(namingClarityRule));

  it("selects every field unchanged", () => {
    const fields = [makeField({ fieldName: "a" })];
    expect(namingClarityRule.selectFields(fields, { schema: schemaWithCustomMutationName })).toEqual(fields);
  });

  it("builds a question covering redundant prefixes, vague names, and implementation leakage", () => {
    const question = namingClarityRule.buildQuestion(0);
    expect(question.instructions).toContain("fields[0]");
    expect(question.instructions.toLowerCase()).toMatch(/redundant/);
    expect(question.instructions.toLowerCase()).toMatch(/vague/);
    expect(question.instructions.toLowerCase()).toMatch(/implementation/);
  });
});

describe("booleanPrefixRule", () => {
  it("has stable identity metadata", () => expectMetadata(booleanPrefixRule));

  it("selects only Boolean-typed fields", () => {
    const fields = [
      makeField({ path: "A.active", fieldName: "active", fieldType: "Boolean!" }),
      makeField({ path: "A.verified", fieldName: "verified", fieldType: "Boolean" }),
      makeField({ path: "A.name", fieldName: "name", fieldType: "String" }),
      makeField({ path: "A.flags", fieldName: "flags", fieldType: "[Boolean!]!" }),
    ];

    const selected = booleanPrefixRule.selectFields(fields, { schema: schemaWithCustomMutationName });

    expect(selected.map((f) => f.path)).toEqual(["A.active", "A.verified"]);
  });

  it("builds a question about is/has/can/should prefixes", () => {
    expectQuestionShape(booleanPrefixRule, /is\/has\/can\/should/);
  });
});

describe("pluralCollectionRule", () => {
  it("has stable identity metadata", () => expectMetadata(pluralCollectionRule));

  it("selects only list-typed fields", () => {
    const fields = [
      makeField({ path: "A.posts", fieldName: "posts", fieldType: "[Post!]!" }),
      makeField({ path: "A.tags", fieldName: "tags", fieldType: "[String!]!" }),
      makeField({ path: "A.name", fieldName: "name", fieldType: "String" }),
    ];

    const selected = pluralCollectionRule.selectFields(fields, { schema: schemaWithCustomMutationName });

    expect(selected.map((f) => f.path)).toEqual(["A.posts", "A.tags"]);
  });

  it("builds a question about plural naming for lists", () => {
    expectQuestionShape(pluralCollectionRule, /plural/);
  });
});

describe("mutationVerbNounRule", () => {
  it("has stable identity metadata", () => expectMetadata(mutationVerbNounRule));

  it("only selects fields on the schema's actual root Mutation type", () => {
    const fields = [
      makeField({ path: "RootMutation.process", parentType: "RootMutation", fieldName: "process" }),
      makeField({ path: "RootQuery.ping", parentType: "RootQuery", fieldName: "ping" }),
      makeField({ path: "User.id", parentType: "User", fieldName: "id" }),
    ];

    const selected = mutationVerbNounRule.selectFields(fields, { schema: schemaWithCustomMutationName });

    expect(selected.map((f) => f.path)).toEqual(["RootMutation.process"]);
  });

  it("builds a question about verbNoun mutation naming", () => {
    expectQuestionShape(mutationVerbNounRule, /verbnoun/);
  });
});

describe("argumentNamingRule", () => {
  it("has stable identity metadata", () => expectMetadata(argumentNamingRule));

  it("only selects fields that have at least one argument", () => {
    const fields = [
      makeField({ path: "A.search", fieldName: "search", args: [{ name: "filter", type: "String" }] }),
      makeField({ path: "A.name", fieldName: "name", args: [] }),
    ];

    const selected = argumentNamingRule.selectFields(fields, { schema: schemaWithCustomMutationName });

    expect(selected.map((f) => f.path)).toEqual(["A.search"]);
  });

  it("builds a question referencing the field's arguments", () => {
    const question = argumentNamingRule.buildQuestion(3);
    expect(question.instructions).toContain("fields[3]");
    expect(question.instructions).toContain("fields[3].args");
  });
});
