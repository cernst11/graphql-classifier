import type { FieldInfo } from "../../types.js";
import type { Analysis } from "../types.js";

function selectFields(fields: FieldInfo[]): FieldInfo[] {
  return fields.filter((field) => field.args.length > 0);
}

const instructions = (index: number) => {
  const ref = `fields[${index}]`;
  return (
    `Look at the arguments in \`${ref}.args\`. Does this field have a generic or unclear argument ` +
    "name — e.g. `filter`/`options` typed as a raw JSON or generic scalar blob instead of a specific " +
    'input type, or an unclear abbreviation? Prefer specific names like `status`/`authorId` over ' +
    `generic ones. Judge only the arguments in \`${ref}.args\`.`
  );
};

const criteria = {
  true: "One or more of this field's arguments has a generic, untyped-sounding, or unclear name.",
  false: "This field's arguments all have specific, clear names.",
};

export const argumentNamingRule: Analysis = {
  id: "doc-argument-naming",
  label: "Vague/Generic Argument Names",
  description: "Flags fields with generic or unclear argument names (e.g. `filter`/`options` typed as a raw blob).",
  positiveLabel: "Vague Argument",
  selectFields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
