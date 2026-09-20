import { describe, expect, it } from "vitest";
import { ANALYSES, getAnalysis, listAnalysisIds, resolveAnalyses } from "../../src/analyses/registry.js";
import { CliError } from "../../src/errors.js";

const ALL_IDS = [
  "auth-gap",
  "db-leakage",
  "doc-argument-naming",
  "doc-boolean-prefix",
  "doc-description",
  "doc-mutation-verb-noun",
  "doc-naming-clarity",
  "doc-naming-style",
  "doc-plural-collection",
  "expensive-field",
  "mutation-payload",
  "pii",
  "stringly-typed",
];

describe("analysis registry", () => {
  it("registers exactly the 13 known analyses", () => {
    expect(listAnalysisIds().slice().sort()).toEqual(ALL_IDS);
  });

  it("every registered analysis has complete metadata and a working interface", () => {
    for (const analysis of ANALYSES) {
      expect(analysis.id).toBeTruthy();
      expect(analysis.label).toBeTruthy();
      expect(analysis.description).toBeTruthy();
      expect(analysis.positiveLabel).toBeTruthy();
      expect(typeof analysis.selectFields).toBe("function");
      expect(typeof analysis.buildQuestion).toBe("function");
    }
  });

  it("getAnalysis looks up by id, returning undefined for unknown ids", () => {
    expect(getAnalysis("pii")?.id).toBe("pii");
    expect(getAnalysis("nonexistent")).toBeUndefined();
  });

  describe("resolveAnalyses", () => {
    it("returns all analyses when input is undefined", () => {
      expect(resolveAnalyses(undefined).map((a) => a.id)).toEqual(listAnalysisIds());
    });

    it('returns all analyses when input is "all" (case-insensitive)', () => {
      expect(resolveAnalyses("All").map((a) => a.id)).toEqual(listAnalysisIds());
    });

    it("returns a single analysis by id", () => {
      expect(resolveAnalyses("pii").map((a) => a.id)).toEqual(["pii"]);
    });

    it("returns multiple analyses in the order requested, deduplicated", () => {
      expect(resolveAnalyses("auth-gap,pii,auth-gap").map((a) => a.id)).toEqual(["auth-gap", "pii"]);
    });

    it("is case-insensitive and trims whitespace around comma-separated ids", () => {
      expect(resolveAnalyses(" PII , doc-description ").map((a) => a.id)).toEqual(["pii", "doc-description"]);
    });

    it("throws a CliError listing valid ids for an unknown analysis", () => {
      expect(() => resolveAnalyses("bogus")).toThrow(CliError);

      try {
        resolveAnalyses("bogus");
        throw new Error("expected resolveAnalyses to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).message).toContain("bogus");
        expect((error as CliError).message).toContain("pii");
      }
    });

    it('expands a trailing-"*" prefix token to every matching id, deduplicated', () => {
      const ids = resolveAnalyses("doc-*").map((a) => a.id);
      expect(ids.slice().sort()).toEqual(ALL_IDS.filter((id) => id.startsWith("doc-")));
    });

    it("combines a wildcard token with exact ids, preserving request order and dedup", () => {
      const ids = resolveAnalyses("pii,doc-boolean-prefix,doc-*").map((a) => a.id);
      expect(ids[0]).toBe("pii");
      expect(ids[1]).toBe("doc-boolean-prefix");
      expect(ids.filter((id) => id === "doc-boolean-prefix")).toHaveLength(1);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("throws a CliError when a wildcard token matches nothing", () => {
      expect(() => resolveAnalyses("nonexistent-*")).toThrow(CliError);
    });
  });
});
