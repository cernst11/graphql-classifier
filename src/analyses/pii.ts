import type { Analysis } from "./types.js";

const instructions = (index: number) =>
  `Does the GraphQL field described at \`fields[${index}]\` represent PII or other sensitive data? ` +
  "Consider it sensitive if it is a direct personal identifier (full name, email address, phone " +
  "number, physical/mailing address, government ID or SSN, date of birth), financial account or " +
  "payment data (credit card number, bank account/routing number), health or medical information, " +
  "authentication credentials (password, API key, security token, secret), precise geolocation " +
  "(exact latitude/longitude/GPS coordinates), or biometric data (fingerprint, face/voice data). " +
  `Judge from the field's parentType, fieldName, fieldType, and description together in ` +
  `\`fields[${index}]\` — a strongly suggestive field name (e.g. "ssn", "creditCardNumber", "email") ` +
  "is sufficient evidence even if the description is empty. Do not flag opaque identifiers " +
  '(e.g. "id"), timestamps, counts, or generic non-personal business data.';

const criteria = {
  true: "The field represents PII or other sensitive/regulated personal data as described above.",
  false:
    "The field is benign — it is not PII and not otherwise sensitive (e.g. an opaque ID, " +
    "timestamp, count, status enum, or generic non-personal attribute).",
};

export const piiAnalysis: Analysis = {
  id: "pii",
  label: "PII / Sensitive Data",
  description:
    "Flags fields that likely represent PII or other sensitive data (credit cards, SSNs, emails, " +
    "health data, credentials, precise geolocation, biometrics).",
  positiveLabel: "PII / Sensitive",
  selectFields: (fields) => fields,
  buildQuestion: (index) => ({ instructions: instructions(index), criteria }),
};
