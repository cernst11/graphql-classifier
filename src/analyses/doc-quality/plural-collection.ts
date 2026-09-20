import type { FieldInfo } from "../../types.js";
import type { Analysis } from "../types.js";

function isListFieldType(fieldType: string): boolean {
  return fieldType.replace(/!$/, "").startsWith("[");
}

function selectFields(fields: FieldInfo[]): FieldInfo[] {
  return fields.filter((field) => isListFieldType(field.fieldType));
}

const instructions = (index: number) => {
  const ref = `fields[${index}]`;
  return (
    `\`${ref}\` is a list-typed GraphQL field (its fieldType starts with \`[\`). Does its name use a ` +
    "singular noun instead of a plural noun — e.g. `post: [Post!]!` or `follower: [User!]!` instead " +
    `of \`posts\`/\`followers\`? Judge only the name at \`${ref}\`.`
  );
};

const criteria = {
  true: "The list field's name is a singular noun instead of a plural noun.",
  false: "The list field's name is already a plural noun (or otherwise clearly denotes a collection).",
};

export const pluralCollectionRule: Analysis = {
  id: "doc-plural-collection",
  label: "Singular Name for a List Field",
  description: "Flags list-typed fields whose name is a singular noun instead of a plural noun.",
  positiveLabel: "Should Be Plural",
  selectFields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
