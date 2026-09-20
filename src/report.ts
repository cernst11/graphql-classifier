import { writeFile } from "node:fs/promises";
import Table from "cli-table3";
import type { AnalysisRunResult } from "./analysis-runner.js";
import type { ClassifiedField, JsonReport, TimingStats } from "./types.js";

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

export function renderTable(classified: ClassifiedField[], threshold: number): string {
  const flagged = classified.filter((field) => field.flagged);

  if (flagged.length === 0) {
    return `No fields flagged above threshold ${threshold} (${classified.length} fields scanned).`;
  }

  const table = new Table({
    head: ["Parent Type", "Field", "GraphQL Type", "Probability", "Description"],
  });

  for (const field of [...flagged].sort((a, b) => b.probability - a.probability)) {
    table.push([
      field.parentType,
      field.fieldName,
      field.fieldType,
      field.probability.toFixed(2),
      field.description ?? "",
    ]);
  }

  return table.toString();
}

export function renderAnalysisSection(result: AnalysisRunResult, threshold: number): string {
  const header = `== ${result.analysis.label} (${result.analysis.id}) ==`;
  return `${header}\n${renderTable(result.classified, threshold)}`;
}

export function renderReport(results: AnalysisRunResult[], threshold: number): string {
  return results.map((result) => renderAnalysisSection(result, threshold)).join("\n\n");
}

export function renderSummary(results: AnalysisRunResult[], timing: TimingStats): string {
  const totalApiCallCount = results.reduce((sum, result) => sum + result.callCount, 0);
  const perAnalysis = results
    .map((result) => {
      const flaggedCount = result.classified.filter((field) => field.flagged).length;
      return `${result.analysis.id}: ${flaggedCount}/${result.classified.length} flagged`;
    })
    .join(", ");

  return (
    `Ran ${results.length} analysis(es) [${perAnalysis}], via ${totalApiCallCount} API call(s) ` +
    `in ${formatMs(timing.totalMs)} ` +
    `(schema load ${formatMs(timing.schemaLoadMs)}, extraction ${formatMs(timing.extractionMs)}, ` +
    `classification ${formatMs(timing.classificationMs)}).`
  );
}

export function buildJsonReport(
  results: AnalysisRunResult[],
  meta: { source: string; threshold: number; timing: TimingStats },
): JsonReport {
  return {
    generatedAt: new Date().toISOString(),
    source: meta.source,
    threshold: meta.threshold,
    timing: meta.timing,
    totalApiCallCount: results.reduce((sum, result) => sum + result.callCount, 0),
    analyses: results.map((result) => {
      const sorted = [...result.classified].sort((a, b) => b.probability - a.probability);
      return {
        id: result.analysis.id,
        label: result.analysis.label,
        model: result.model,
        totalFieldsScanned: result.classified.length,
        flaggedCount: result.classified.filter((field) => field.flagged).length,
        apiCallCount: result.callCount,
        fields: sorted.map((field) => ({
          parentType: field.parentType,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          description: field.description,
          probability: field.probability,
          flagged: field.flagged,
        })),
      };
    }),
  };
}

export async function writeJsonReport(path: string, report: JsonReport): Promise<void> {
  await writeFile(path, JSON.stringify(report, null, 2), "utf8");
}
