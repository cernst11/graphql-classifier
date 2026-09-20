import { config as loadDotenv } from "dotenv";
import { CliError, ExitCode } from "./errors.js";

export function loadApiKey(): string {
  loadDotenv();

  let apiKey = process.env.TYPESAFE_API_KEY;

  if (!apiKey && process.env.JEV) {
    apiKey = process.env.JEV;
    process.env.TYPESAFE_API_KEY = apiKey;
    console.warn(
      "Using JEV as TYPESAFE_API_KEY. Rename this variable in .env to TYPESAFE_API_KEY to silence this warning.",
    );
  }

  if (!apiKey) {
    throw new CliError(
      "TYPESAFE_API_KEY is not set. Copy .env.example to .env and set your key.",
      ExitCode.Error,
    );
  }

  return apiKey;
}
