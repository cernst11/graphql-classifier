import type { Analysis } from "../types.js";

// https://github.com/apollographql/skills/blob/main/skills/graphql-schema/references/naming.md
const instructions = (index: number) => {
  const ref = `fields[${index}]`;
  return (
    `Does the GraphQL field name at \`${ref}\` violate standard casing conventions? Flag it if: the ` +
    "name isn't camelCase (e.g. snake_case, PascalCase, or SCREAMING_CASE); it uses Hungarian-notation " +
    "type prefixes (e.g. `strName`, `intAge`, `TUser`); or it uses an unclear abbreviation instead of " +
    'a full word (e.g. "crtAt" instead of "createdAt"). Do not flag names that are already plain, ' +
    `standard camelCase with full words. Judge only the name at \`${ref}\`.`
  );
};

const criteria = {
  true: "The field name isn't camelCase, uses Hungarian notation, or uses an unclear abbreviation.",
  false: "The field name is standard camelCase, with no Hungarian-notation prefix or unclear abbreviation.",
};

export const namingStyleRule: Analysis = {
  id: "doc-naming-style",
  label: "Non-Standard Casing / Hungarian Notation / Abbreviation",
  description:
    "Flags field names that aren't camelCase, use Hungarian-notation type prefixes (strX, intY, TX), " +
    "or use unclear abbreviations.",
  positiveLabel: "Casing/Style Issue",
  selectFields: (fields) => fields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
