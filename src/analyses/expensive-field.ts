import { isInterfaceType, isObjectType, isUnionType } from "graphql";
import type { FieldInfo } from "../types.js";
import type { Analysis, AnalysisContext } from "./types.js";

const PAGINATION_ARG_PATTERN = /^(first|last|limit|after|before|page|pageSize|perPage|offset|top|take)$/i;

function isListFieldType(fieldType: string): boolean {
  return fieldType.replace(/!$/, "").startsWith("[");
}

function namedTypeOf(fieldType: string): string {
  return fieldType.replace(/[[\]!]/g, "");
}

function isCompositeType(typeName: string, context: AnalysisContext): boolean {
  const type = context.schema.getType(typeName);
  return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}

function hasPaginationArg(field: FieldInfo): boolean {
  return field.args.some((arg) => PAGINATION_ARG_PATTERN.test(arg.name));
}

/**
 * Types that appear as the item type of some list field, i.e. types whose
 * instances are iterated as part of a collection somewhere in the schema.
 * A to-one relation field declared on one of these types will typically be
 * resolved once per item across that list — the classic GraphQL N+1 shape.
 */
function typesAppearingInLists(fields: FieldInfo[]): Set<string> {
  const types = new Set<string>();
  for (const field of fields) {
    if (isListFieldType(field.fieldType)) {
      types.add(namedTypeOf(field.fieldType));
    }
  }
  return types;
}

function selectFields(fields: FieldInfo[], context: AnalysisContext): FieldInfo[] {
  const listItemTypes = typesAppearingInLists(fields);

  return fields.filter((field) => {
    // Scalar/enum-returning fields are resolved directly from the parent's
    // already-fetched data — not a relation lookup, so not an N+1/expensive
    // fetch risk in the sense this analysis cares about.
    if (!isCompositeType(namedTypeOf(field.fieldType), context)) {
      return false;
    }

    if (isListFieldType(field.fieldType)) {
      // A list of a related type risks an unbounded/expensive fetch unless
      // it already exposes a pagination-shaped argument.
      return !hasPaginationArg(field);
    }

    // A to-one relation is only a meaningful N+1 candidate if its own
    // parent type is itself ever returned as a list item elsewhere — i.e.
    // this field will be resolved once per item across that list.
    return listItemTypes.has(field.parentType);
  });
}

const instructions = (index: number) => {
  const ref = `fields[${index}]`;
  return (
    `The GraphQL field described at \`${ref}\` returns another object type (a "relation" field) and ` +
    "was flagged as a structural candidate because it looks likely to be resolved once per parent " +
    "instance — e.g. a list with no pagination arguments, or a relation on a type that itself " +
    "commonly appears inside a list elsewhere in the schema — which risks the classic GraphQL N+1 " +
    "query problem or an unbounded/expensive fetch if not paginated or batched. Judging only from " +
    `\`${ref}\` (parentType, fieldName, fieldType, description, args), is this field genuinely likely ` +
    "to be expensive or risky to resolve at scale? Consider it a real risk if it's a list with no " +
    "pagination and the name/domain suggests it could be large or unbounded (e.g. `orders`, `posts`, " +
    "`allUsers`, `transactions`, `auditLog`), or a to-one relation whose parent is commonly listed in " +
    "bulk, making per-item resolution costly without batching. Do NOT flag it if the collection or " +
    "relation is inherently small/fixed by domain (e.g. a user's `roles`, a product's `variants` " +
    "capped at a handful, an order's `lineItems` for a typical order) or is a simple, cheap, " +
    "well-known foreign-key-style lookup."
  );
};

const criteria = {
  true:
    "This field is likely to be expensive or risky to resolve at scale — an unbounded/large list " +
    "with no pagination, or a per-item relation lookup prone to N+1 without evident batching.",
  false:
    "This field is reasonably bounded or cheap to resolve — a small/fixed-size collection, or a " +
    "simple relation unlikely to cause meaningful N+1 or unbounded-fetch cost.",
};

export const expensiveFieldAnalysis: Analysis = {
  id: "expensive-field",
  label: "Expensive Fields (N+1 Risk)",
  description:
    "Flags relation fields that risk the N+1 query problem or unbounded/expensive fetches: lists of " +
    "related types with no pagination arguments, and to-one relations on types that themselves " +
    "commonly appear inside a list elsewhere in the schema. Static/heuristic — combines schema-shape " +
    "signals with an LLM severity judgment; cannot see actual resolver batching (e.g. DataLoader) or " +
    "database indexes.",
  positiveLabel: "Expensive/N+1 Risk",
  selectFields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
