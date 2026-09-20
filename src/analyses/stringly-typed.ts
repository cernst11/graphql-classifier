import type { FieldInfo } from "../types.js";
import type { Analysis } from "./types.js";

function isPlainStringFieldType(fieldType: string): boolean {
  return fieldType.replace(/!$/, "") === "String";
}

function selectFields(fields: FieldInfo[]): FieldInfo[] {
  return fields.filter((field) => isPlainStringFieldType(field.fieldType));
}

const instructions = (index: number) => {
  const ref = `fields[${index}]`;
  return (
    `\`${ref}\` is typed as a plain \`String\`. Does its name strongly suggest a fixed, enumerable ` +
    "set of values that should be modeled as a GraphQL `enum` instead — e.g. `status`, `role`, " +
    "`category`, `type`, `state`, `tier`, `priority`, `visibility`? Do not flag genuinely free-form " +
    "text fields (e.g. `name`, `description`, `email`, `address`, `comment`, `title`, `bio`, `notes`, " +
    `\`url\`) even though they're also String-typed. Judge only \`${ref}\`.`
  );
};

const criteria = {
  true:
    "The field name strongly suggests a fixed set of values and should likely be a GraphQL enum " +
    "instead of a free-form String.",
  false: "The field is genuinely free-form text and appropriately typed as String.",
};

export const stringlyTypedAnalysis: Analysis = {
  id: "stringly-typed",
  label: "Stringly-Typed Enum Candidate",
  description:
    "Flags plain String fields whose name (status, role, category, type, ...) suggests a fixed value " +
    "set that should be a GraphQL enum instead.",
  positiveLabel: "Should Be Enum",
  selectFields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
