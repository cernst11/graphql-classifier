import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import pLimit from "p-limit";
import type { Analysis } from "./analyses/types.js";
import type { ClassifiedField, FieldInfo } from "./types.js";

const DEFAULT_BATCH_SIZE = 25;

interface ClassifyBatchResult {
  answers: Map<string, number>;
  model: string;
}

export interface ClassifierClient {
  classifyBatch(fields: FieldInfo[], analysis: Analysis, model?: string): Promise<ClassifyBatchResult>;
}

export class TypeSafeClassifierClient implements ClassifierClient {
  private readonly client: TypeSafeClient;

  constructor(client: TypeSafeClient = new TypeSafeClient()) {
    this.client = client;
  }

  async classifyBatch(fields: FieldInfo[], analysis: Analysis, model?: string): Promise<ClassifyBatchResult> {
    const state = {
      fields: fields.map((field) => ({
        parentType: field.parentType,
        fieldName: field.fieldName,
        fieldType: field.fieldType,
        description: field.description ?? "",
        args: field.args.map((arg) => ({ name: arg.name, type: arg.type })),
      })),
    };

    const questions: Record<string, ReturnType<typeof noul>> = {};
    fields.forEach((_, index) => {
      const question = analysis.buildQuestion(index);
      questions[`f${index}`] = noul(question.instructions, question.criteria);
    });

    const response = await this.client.systemOne({
      state,
      questions,
      ...(model ? { model } : {}),
    });

    const answers = new Map<string, number>();
    fields.forEach((field, index) => {
      answers.set(field.path, response.answers[`f${index}`].noul);
    });

    return { answers, model: response.model };
  }
}

export interface ClassifyOptions {
  threshold: number;
  concurrency: number;
  model?: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function classifyFields(
  fields: FieldInfo[],
  analysis: Analysis,
  client: ClassifierClient,
  options: ClassifyOptions,
): Promise<{ classified: ClassifiedField[]; model: string; callCount: number }> {
  if (fields.length === 0) {
    return { classified: [], model: "n/a", callCount: 0 };
  }

  const batches = chunk(fields, DEFAULT_BATCH_SIZE);
  const limit = pLimit(options.concurrency);

  const results = await Promise.all(
    batches.map((batch) => limit(() => client.classifyBatch(batch, analysis, options.model))),
  );

  const probabilityByPath = new Map<string, number>();
  let model = "n/a";
  for (const result of results) {
    model = result.model;
    for (const [path, probability] of result.answers) {
      probabilityByPath.set(path, probability);
    }
  }

  const classified: ClassifiedField[] = fields.map((field) => {
    const probability = probabilityByPath.get(field.path) ?? 0;
    return {
      ...field,
      probability,
      flagged: probability >= options.threshold,
    };
  });

  return { classified, model, callCount: batches.length };
}
