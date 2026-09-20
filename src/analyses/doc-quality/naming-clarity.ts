import type { Analysis } from "../types.js";

// https://github.com/apollographql/skills/blob/main/skills/graphql-schema/references/naming.md
const instructions = (index: number) => {
  const ref = `fields[${index}]`;
  return (
    `Does the GraphQL field described at \`${ref}\` have a redundant, vague, or implementation-leaking ` +
    "name? Flag it if: the name redundantly repeats its own parentType name (e.g. `userId`/`userEmail` " +
    "on a `User` type, instead of `id`/`email`); it's a generic, uninformative, or getter-style name " +
    "(e.g. `data`, `info`, `getData`, `fetch`, `getFullName`, `calculatePostCount` — computed fields " +
    "should be named by what they return, not how they're computed); or it exposes internal/storage " +
    "details (e.g. `mysql_id`, `redis_cache_key`). Do not flag names that are already specific, " +
    `client-meaningful, and free of the parent type's own name. Judge only \`${ref}\`.`
  );
};

const criteria = {
  true:
    "The field name redundantly repeats its parentType name, is vague/generic/getter-style, or " +
    "leaks implementation details.",
  false: "The field name is specific, client-meaningful, and doesn't repeat its own type or leak internals.",
};

export const namingClarityRule: Analysis = {
  id: "doc-naming-clarity",
  label: "Redundant, Vague, or Leaky Name",
  description:
    "Flags field names that redundantly repeat their own parent type (userId on User), are vague or " +
    "getter-style (data, getFullName), or leak implementation details (mysql_id).",
  positiveLabel: "Naming Clarity Issue",
  selectFields: (fields) => fields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
