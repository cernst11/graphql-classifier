import type { FieldInfo } from "../../types.js";
import type { Analysis } from "../types.js";

function isBooleanFieldType(fieldType: string): boolean {
  return fieldType.replace(/!$/, "") === "Boolean";
}

function selectFields(fields: FieldInfo[]): FieldInfo[] {
  return fields.filter((field) => isBooleanFieldType(field.fieldType));
}

const instructions = (index: number) => {
  const ref = `fields[${index}]`;
  return (
    `\`${ref}\` is a Boolean-typed GraphQL field. Is its name NOT prefixed with is/has/can/should (or ` +
    'an equivalent predicate phrasing), e.g. `active` instead of `isActive`, or `subscription` ' +
    `instead of \`hasSubscription\`? Judge only the name at \`${ref}\`.`
  );
};

const criteria = {
  true: "The Boolean field's name is not prefixed with is/has/can/should or equivalent predicate phrasing.",
  false: "The Boolean field's name is already prefixed with is/has/can/should or reads as a clear predicate.",
};

export const booleanPrefixRule: Analysis = {
  id: "doc-boolean-prefix",
  label: "Boolean Missing is/has/can/should Prefix",
  description: "Flags Boolean-typed fields whose name isn't prefixed with is/has/can/should (e.g. `active` instead of `isActive`).",
  positiveLabel: "Missing Boolean Prefix",
  selectFields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
