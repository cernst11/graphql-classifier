import { isInterfaceType, isObjectType } from "graphql";
import type { FieldInfo } from "../types.js";
import type { Analysis, AnalysisContext } from "./types.js";

const ID_SUFFIX_PATTERN = /^(.+?)(?:Id|_id|ID)$/;

function isScalarIdLikeType(fieldType: string): boolean {
  const named = fieldType.replace(/!$/, "");
  return named === "ID" || named === "Int" || named === "String";
}

function isListFieldType(fieldType: string): boolean {
  return fieldType.replace(/!$/, "").startsWith("[");
}

function candidateRelationTypeName(fieldName: string): string | null {
  const match = fieldName.match(ID_SUFFIX_PATTERN);
  const base = match?.[1];
  if (!base) {
    return null;
  }
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function referencesRealType(fieldName: string, context: AnalysisContext): boolean {
  const candidate = candidateRelationTypeName(fieldName);
  if (!candidate) {
    return false;
  }
  const type = context.schema.getType(candidate);
  return isObjectType(type) || isInterfaceType(type);
}

function selectFields(fields: FieldInfo[], context: AnalysisContext): FieldInfo[] {
  return fields.filter((field) => {
    if (field.parentKind === "INPUT_OBJECT") {
      // Input types can only reference scalars/enums/inputs — a raw id here
      // is the correct, unavoidable shape, not a leakage smell.
      return false;
    }
    if (field.fieldName === "id") {
      return false;
    }
    if (isListFieldType(field.fieldType) || !isScalarIdLikeType(field.fieldType)) {
      return false;
    }
    return referencesRealType(field.fieldName, context);
  });
}

const instructions = (index: number) => {
  const ref = `fields[${index}]`;
  return (
    `\`${ref}\` is a scalar-typed field whose name looks like a raw foreign-key reference to another ` +
    "type already defined in this schema — e.g. `authorId: ID!` instead of exposing the relation " +
    "directly as `author: User!`. GraphQL's core value is modeling relationships as traversable graph " +
    "edges, not raw database foreign keys the client has to look up separately. Based only on " +
    `\`${ref}\`'s parentType, fieldName, fieldType, and description, does this look like a raw FK ` +
    "that should be exposed as a proper relation field instead? Do not flag it if the name or " +
    "description makes clear it's an external/third-party identifier (e.g. a Stripe customer id, an " +
    `external system's id) rather than a reference to this schema's own type. Judge only \`${ref}\`.`
  );
};

const criteria = {
  true:
    "This field is a raw foreign-key-style scalar that should likely be exposed as a proper relation " +
    "to the related type instead.",
  false:
    "This field is not a problematic raw FK — e.g. it references an external/third-party system, or " +
    "a scalar id is genuinely appropriate here.",
};

export const dbLeakageAnalysis: Analysis = {
  id: "db-leakage",
  label: "Raw Foreign Key / DB Leakage",
  description:
    "Flags scalar id-like fields (e.g. `authorId: ID!`) whose name matches another type already " +
    "defined in the schema, suggesting a raw foreign key exposed instead of a proper GraphQL " +
    "relation (`author: User!`).",
  positiveLabel: "DB/FK Leakage",
  selectFields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
