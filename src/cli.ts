#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { Command } from "commander";
import { runAnalyses } from "./analysis-runner.js";
import { ANALYSES, resolveAnalyses } from "./analyses/registry.js";
import { TypeSafeClassifierClient } from "./classifier.js";
import { loadApiKey } from "./env.js";
import { CliError, ExitCode } from "./errors.js";
import { extractFields } from "./field-extractor.js";
import { buildJsonReport, renderReport, renderSummary, writeJsonReport } from "./report.js";
import { loadSchemaFromSource } from "./schema-loader.js";
import type { TimingStats } from "./types.js";

interface CliOptions {
  analysis: string;
  listAnalyses?: boolean;
  threshold: string;
  out?: string;
  format: "table" | "json";
  concurrency: string;
  model?: string;
}

const program = new Command();

program
  .name("gql-pii-audit")
  .description(
    "Scan a GraphQL schema and run one or more field-level analyses (PII, documentation quality, " +
      "authorization gaps) using TypeSafe's Jev model.",
  )
  .argument("[source]", "Glob pattern (e.g. schema/**/*.graphql) or a directory of .graphql/.gql files")
  .option(
    "--analysis <ids>",
    `Comma-separated analyses to run, or "all" (default). Available: ${ANALYSES.map((a) => a.id).join(", ")}`,
    "all",
  )
  .option("--list-analyses", "List available analyses (id, label, description) and exit")
  .option("--threshold <0-1>", "Probability at/above which a field is flagged", "0.6")
  .option("--out <file>", "Also write the full JSON report to this path")
  .option("--format <table|json>", "stdout rendering", "table")
  .option("--concurrency <n>", "Max concurrent classification batch calls per analysis", "4")
  .option("--model <name>", "Optional Jev model override")
  .action(async (source: string | undefined, options: CliOptions) => {
    await run(source, options);
  });

function printAnalysisList(): void {
  for (const analysis of ANALYSES) {
    console.log(`${analysis.id}\t${analysis.label}`);
    console.log(`\t${analysis.description}`);
  }
}

async function run(source: string | undefined, options: CliOptions): Promise<void> {
  if (options.listAnalyses) {
    printAnalysisList();
    return;
  }

  if (!source) {
    throw new CliError("Missing required <source> argument (glob pattern or directory).");
  }

  const threshold = Number(options.threshold);
  const concurrency = Number(options.concurrency);

  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new CliError(`--threshold must be a number between 0 and 1, got "${options.threshold}"`);
  }
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new CliError(`--concurrency must be a positive integer, got "${options.concurrency}"`);
  }
  if (options.format !== "table" && options.format !== "json") {
    throw new CliError(`--format must be "table" or "json", got "${options.format}"`);
  }

  const analyses = resolveAnalyses(options.analysis);

  loadApiKey();

  const totalStart = performance.now();

  const schemaLoadStart = performance.now();
  const schema = await loadSchemaFromSource(source);
  const schemaLoadMs = performance.now() - schemaLoadStart;

  const extractionStart = performance.now();
  const fields = extractFields(schema);
  const extractionMs = performance.now() - extractionStart;

  const client = new TypeSafeClassifierClient();
  const classificationStart = performance.now();
  const results = await runAnalyses(analyses, fields, schema, client, {
    threshold,
    concurrency,
    model: options.model,
  });
  const classificationMs = performance.now() - classificationStart;

  const timing: TimingStats = {
    schemaLoadMs,
    extractionMs,
    classificationMs,
    totalMs: performance.now() - totalStart,
  };

  const reportMeta = { source, threshold, timing };

  if (options.format === "table") {
    console.log(renderReport(results, threshold));
  } else {
    console.log(JSON.stringify(buildJsonReport(results, reportMeta), null, 2));
  }
  console.error(renderSummary(results, timing));

  if (options.out) {
    await writeJsonReport(options.out, buildJsonReport(results, reportMeta));
  }

  const flaggedCount = results.reduce(
    (sum, result) => sum + result.classified.filter((field) => field.flagged).length,
    0,
  );
  process.exitCode = flaggedCount > 0 ? ExitCode.Flagged : ExitCode.Success;
}

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`Error: ${error.message}`);
      process.exitCode = error.exitCode;
    } else {
      console.error(`Unexpected error: ${(error as Error).message}`);
      process.exitCode = ExitCode.Error;
    }
  }
}

main();
