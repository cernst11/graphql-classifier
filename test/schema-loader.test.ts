import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractFields } from "../src/field-extractor.js";
import { loadSchemaFromSource } from "../src/schema-loader.js";

const exampleSchemaDir = fileURLToPath(new URL("../examples/schema", import.meta.url));

describe("loadSchemaFromSource", () => {
  it("merges extend type across files matched by a directory glob", async () => {
    const schema = await loadSchemaFromSource(exampleSchemaDir);
    const fields = extractFields(schema);

    expect(fields.some((f) => f.path === "User.email")).toBe(true);
    expect(fields.some((f) => f.path === "User.creditCard")).toBe(true);
    expect(fields.some((f) => f.path === "CreditCard.creditCardNumber")).toBe(true);
  });

  it("throws a CliError when no files match", async () => {
    await expect(loadSchemaFromSource(`${exampleSchemaDir}/nonexistent`)).rejects.toThrow();
  });
});
