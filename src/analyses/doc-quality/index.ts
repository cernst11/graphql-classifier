import type { Analysis } from "../types.js";
import { argumentNamingRule } from "./argument-naming.js";
import { booleanPrefixRule } from "./boolean-prefix.js";
import { descriptionRule } from "./description.js";
import { mutationVerbNounRule } from "./mutation-verb-noun.js";
import { namingClarityRule } from "./naming-clarity.js";
import { namingStyleRule } from "./naming-style.js";
import { pluralCollectionRule } from "./plural-collection.js";

/**
 * The "doc-quality" family: narrowly-scoped, independently-selectable lint
 * rules (each its own Analysis) rather than one opaque documentation/naming
 * flag, so a report says *which* convention a field violates. Select the
 * whole family with `--analysis "doc-*"`.
 */
export const docQualityAnalyses: readonly Analysis[] = [
  descriptionRule,
  namingStyleRule,
  namingClarityRule,
  booleanPrefixRule,
  pluralCollectionRule,
  mutationVerbNounRule,
  argumentNamingRule,
];

export {
  argumentNamingRule,
  booleanPrefixRule,
  descriptionRule,
  mutationVerbNounRule,
  namingClarityRule,
  namingStyleRule,
  pluralCollectionRule,
};
