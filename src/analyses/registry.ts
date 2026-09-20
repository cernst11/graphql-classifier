import { CliError, ExitCode } from "../errors.js";
import { authGapAnalysis } from "./auth-gap.js";
import { dbLeakageAnalysis } from "./db-leakage.js";
import { docQualityAnalyses } from "./doc-quality/index.js";
import { expensiveFieldAnalysis } from "./expensive-field.js";
import { mutationPayloadAnalysis } from "./mutation-payload.js";
import { piiAnalysis } from "./pii.js";
import { stringlyTypedAnalysis } from "./stringly-typed.js";
import type { Analysis } from "./types.js";

export const ANALYSES: readonly Analysis[] = [
  piiAnalysis,
  ...docQualityAnalyses,
  authGapAnalysis,
  expensiveFieldAnalysis,
  dbLeakageAnalysis,
  stringlyTypedAnalysis,
  mutationPayloadAnalysis,
];

export function listAnalysisIds(): string[] {
  return ANALYSES.map((analysis) => analysis.id);
}

export function getAnalysis(id: string): Analysis | undefined {
  return ANALYSES.find((analysis) => analysis.id === id);
}

/**
 * Resolves a `--analysis` CLI value into the list of analyses to run.
 * Undefined, empty, or "all" (case-insensitive) selects every registered
 * analysis. Otherwise, a comma-separated list of tokens is parsed, trimmed,
 * and lower-cased; each token is either an exact id or, if it ends with
 * `*`, a prefix match against every registered id (e.g. `doc-*` selects the
 * whole doc-quality rule family). Results are deduplicated while preserving
 * the order things were first matched in.
 */
export function resolveAnalyses(input: string | undefined): Analysis[] {
  const normalized = input?.trim().toLowerCase();

  if (!normalized || normalized === "all") {
    return [...ANALYSES];
  }

  const tokens = normalized
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return [...ANALYSES];
  }

  const seen = new Set<string>();
  const resolved: Analysis[] = [];

  for (const token of tokens) {
    const isWildcard = token.endsWith("*");
    const prefix = isWildcard ? token.slice(0, -1) : token;
    const matches = isWildcard
      ? ANALYSES.filter((analysis) => analysis.id.startsWith(prefix))
      : ANALYSES.filter((analysis) => analysis.id === token);

    if (matches.length === 0) {
      throw new CliError(
        `Unknown analysis "${token}". Available analyses: ${listAnalysisIds().join(", ")}.`,
        ExitCode.Error,
      );
    }

    for (const analysis of matches) {
      if (!seen.has(analysis.id)) {
        seen.add(analysis.id);
        resolved.push(analysis);
      }
    }
  }

  return resolved;
}
