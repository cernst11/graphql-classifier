import type { FieldInfo } from "../types.js";
import type { Analysis, AnalysisContext } from "./types.js";

function namedTypeOf(fieldType: string): string {
  return fieldType.replace(/[[\]!]/g, "");
}

function alreadyLooksLikeResultType(fieldType: string): boolean {
  const named = namedTypeOf(fieldType);
  return named.endsWith("Payload") || named.endsWith("Result");
}

function selectFields(fields: FieldInfo[], context: AnalysisContext): FieldInfo[] {
  const mutationTypeName = context.schema.getMutationType()?.name;
  if (!mutationTypeName) {
    return [];
  }
  return fields.filter(
    (field) => field.parentType === mutationTypeName && !alreadyLooksLikeResultType(field.fieldType),
  );
}

// https://github.com/apollographql/skills/blob/main/skills/graphql-schema/references/naming.md#payload-types
const instructions = (index: number) => {
  const ref = `fields[${index}]`;
  return (
    `\`${ref}\` is a field on the schema's Mutation type whose return type name doesn't end in ` +
    "`Payload` or `Result` — a common convention for a dedicated response type that can carry typed " +
    "success/error/validation info alongside the result. Based on " +
    `\`${ref}\`'s fieldName, fieldType, and description, does this mutation look like it's missing a ` +
    "proper payload/result wrapper — e.g. it returns a raw domain entity type (like `User`, `Order`) " +
    "or a bare scalar (`Boolean`, `String`) that gives the client no typed way to receive error " +
    "details on failure? Do not flag it if the return type, even without a Payload/Result suffix, " +
    "already reads as a dedicated response type built for this specific operation (e.g. " +
    `\`DeleteUserResponse\`, \`LoginOutcome\`). Judge only \`${ref}\`.`
  );
};

const criteria = {
  true:
    "This mutation likely lacks a proper payload/result pattern for returning typed success/error " +
    "information.",
  false:
    "This mutation's return type already reads as (or plausibly is) a dedicated result/payload-style " +
    "wrapper.",
};

export const mutationPayloadAnalysis: Analysis = {
  id: "mutation-payload",
  label: "Missing Error/Payload Pattern",
  description:
    "Flags Mutation-type fields whose return type doesn't look like a dedicated Payload/Result " +
    "wrapper, so failures have no typed way to surface error details to the client.",
  positiveLabel: "Missing Payload Pattern",
  selectFields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
