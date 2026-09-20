import type { FieldInfo } from "../types.js";
import type { Analysis, AnalysisContext } from "./types.js";

// Matches directive names that plausibly gate access (e.g. @auth,
// @authenticated, @hasRole, @requiresScope, @permission, @policy, @isAdmin).
// This is a heuristic over directive *names* only — it cannot see
// resolver-level or middleware-level auth that isn't expressed in the SDL,
// so it's a triage signal, not ground truth.
const AUTH_DIRECTIVE_PATTERN = /auth|role|scope|permission|policy|admin/i;

// @scopes (bare scope listing, e.g. from an OIDC/OAuth codegen tool) doesn't
// itself imply enforcement, unlike @requiresScope or @hasRole — so it's
// excluded even though it matches the broader "scope" pattern above.
const NON_COVERING_DIRECTIVE_NAMES = new Set(["scopes"]);

function hasAuthDirective(field: FieldInfo): boolean {
  return field.directives.some(
    (name) => AUTH_DIRECTIVE_PATTERN.test(name) && !NON_COVERING_DIRECTIVE_NAMES.has(name.toLowerCase()),
  );
}

function rootTypeNames(context: AnalysisContext): Set<string> {
  const names = new Set<string>();
  const query = context.schema.getQueryType();
  const mutation = context.schema.getMutationType();
  const subscription = context.schema.getSubscriptionType();

  if (query) names.add(query.name);
  if (mutation) names.add(mutation.name);
  if (subscription) names.add(subscription.name);

  return names;
}

function selectFields(fields: FieldInfo[], context: AnalysisContext): FieldInfo[] {
  const roots = rootTypeNames(context);
  return fields.filter((field) => roots.has(field.parentType) && !hasAuthDirective(field));
}

const instructions = (index: number) =>
  `The GraphQL operation described at \`fields[${index}]\` is a root Query/Mutation/Subscription ` +
  "field with no auth-related directive detected on it in the schema. Does it expose or modify data " +
  "in a way that should typically require the caller to be authenticated and/or authorized? Consider " +
  "it a likely gap if the field: returns another user's private or sensitive data, performs a " +
  "write/update/delete mutation, exposes internal or administrative data or operations, or otherwise " +
  "implies privileged access. Do not flag fields that are ordinarily public (e.g. public content " +
  "listings, health checks, login/signup/password-reset mutations, publicly readable reference data). " +
  `Judge only from \`fields[${index}]\`.`;

const criteria = {
  true:
    "This operation should typically require authentication/authorization, and no such control is " +
    "visible in the schema.",
  false:
    "This operation is ordinarily safe to expose without authentication/authorization (e.g. public " +
    "reads, health checks, login/signup).",
};

export const authGapAnalysis: Analysis = {
  id: "auth-gap",
  label: "Authorization Gaps",
  description:
    "Flags root Query/Mutation/Subscription fields that look like they need authorization but have " +
    "no auth-related directive detected in the schema. Static/heuristic — cannot see resolver-level " +
    "or middleware auth.",
  positiveLabel: "Possible Auth Gap",
  selectFields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
