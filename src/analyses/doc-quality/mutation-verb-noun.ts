import type { FieldInfo } from "../../types.js";
import type { Analysis, AnalysisContext } from "../types.js";

function selectFields(fields: FieldInfo[], context: AnalysisContext): FieldInfo[] {
  const mutationTypeName = context.schema.getMutationType()?.name;
  if (!mutationTypeName) {
    return [];
  }
  return fields.filter((field) => field.parentType === mutationTypeName);
}

const instructions = (index: number) => {
  const ref = `fields[${index}]`;
  return (
    `\`${ref}\` is a field on the schema's Mutation type. Does its name fail to follow a clear ` +
    "verbNoun pattern with an unambiguous action verb — e.g. `createUser`, `updateUser`, " +
    "`deleteUser`, `publishPost` — instead being vague, noun-only, or missing an action verb (e.g. " +
    `\`user\`, \`userUpdate\`, \`process\`)? Judge only the name at \`${ref}\`.`
  );
};

const criteria = {
  true: "The mutation name is vague, noun-only, or otherwise doesn't follow a clear verbNoun pattern.",
  false: "The mutation name follows a clear verbNoun pattern with an unambiguous action verb.",
};

export const mutationVerbNounRule: Analysis = {
  id: "doc-mutation-verb-noun",
  label: "Mutation Not Following verbNoun Pattern",
  description: "Flags Mutation-type fields whose name doesn't follow a clear verbNoun pattern (createUser, deleteOrder, etc.).",
  positiveLabel: "Non-verbNoun Mutation",
  selectFields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
