import { existsSync, statSync } from "node:fs";
import { GraphQLFileLoader } from "@graphql-tools/graphql-file-loader";
import { loadSchema } from "@graphql-tools/load";
import type { GraphQLSchema } from "graphql";
import { CliError, ExitCode } from "./errors.js";

const GLOB_METACHARACTERS = /[*?{}[\]]/;

export function resolveGlobPattern(source: string): string {
  if (GLOB_METACHARACTERS.test(source)) {
    return source;
  }

  if (existsSync(source) && statSync(source).isDirectory()) {
    return `${source.replace(/\/+$/, "")}/**/*.{graphql,gql}`;
  }

  throw new CliError(
    `"${source}" is not an existing directory and contains no glob pattern.`,
    ExitCode.Error,
  );
}

export async function loadSchemaFromSource(source: string): Promise<GraphQLSchema> {
  const pattern = resolveGlobPattern(source);

  let schema: GraphQLSchema;
  try {
    schema = await loadSchema(pattern, {
      loaders: [new GraphQLFileLoader()],
    });
  } catch (error) {
    throw new CliError(
      `Failed to load schema from "${pattern}": ${(error as Error).message}`,
      ExitCode.Error,
    );
  }

  return schema;
}
