import type { Analysis } from "../types.js";

const instructions = (index: number) => {
  const ref = `fields[${index}]`;
  return (
    `Does the GraphQL field described at \`${ref}\` have a missing or low-quality description? Flag ` +
    "it if the description is empty/missing and the field name+type alone don't make its purpose " +
    "clear, or if the description is vague, merely restates the field name, or is otherwise " +
    "unhelpful to an API consumer. Do not flag fields whose purpose is self-evident from name+type " +
    "alone (e.g. `id: ID!`, `createdAt: String!`) even with no description, or fields that already " +
    `have a genuinely helpful description. Judge only from \`${ref}\`.`
  );
};

const criteria = {
  true: "The description is missing or inadequate, and the field's purpose isn't otherwise self-evident.",
  false: "The field has an adequate description, or its purpose is self-evident from its name and type.",
};

export const descriptionRule: Analysis = {
  id: "doc-description",
  label: "Missing/Low-Quality Description",
  description: "Flags fields with a missing, vague, or unhelpful description whose purpose isn't self-evident.",
  positiveLabel: "Doc Issue",
  selectFields: (fields) => fields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
