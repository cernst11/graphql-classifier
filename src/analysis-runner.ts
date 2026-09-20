import type { GraphQLSchema } from "graphql";
import type { Analysis, AnalysisContext } from "./analyses/types.js";
import { classifyFields, type ClassifierClient, type ClassifyOptions } from "./classifier.js";
import type { ClassifiedField, FieldInfo } from "./types.js";

export interface AnalysisRunResult {
  analysis: Analysis;
  classified: ClassifiedField[];
  model: string;
  callCount: number;
}

/**
 * Runs each analysis against its own candidate field subset (via
 * `analysis.selectFields`), concurrently. Each analysis manages its own
 * batching/concurrency internally (see `classifyFields`), so the effective
 * peak concurrency across `analyses.length` analyses run together is up to
 * `analyses.length * options.concurrency`.
 */
export async function runAnalyses(
  analyses: Analysis[],
  allFields: FieldInfo[],
  schema: GraphQLSchema,
  client: ClassifierClient,
  options: ClassifyOptions,
): Promise<AnalysisRunResult[]> {
  const context: AnalysisContext = { schema };

  return Promise.all(
    analyses.map(async (analysis) => {
      const candidateFields = analysis.selectFields(allFields, context);
      const { classified, model, callCount } = await classifyFields(candidateFields, analysis, client, options);
      return { analysis, classified, model, callCount };
    }),
  );
}
