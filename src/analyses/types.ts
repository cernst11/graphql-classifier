import type { GraphQLSchema } from "graphql";
import type { FieldInfo } from "../types.js";

export interface AnalysisContext {
  schema: GraphQLSchema;
}

export interface AnalysisQuestion {
  instructions: string;
  criteria: { true: string; false: string };
}

/**
 * A pluggable field-level classification: which fields it applies to, and the
 * single yes/no (Noul) question asked of each one. `buildQuestion` is called
 * once per field within a batch; `index` is that field's position in the
 * batch's shared `state.fields` array (referenced in instructions text as
 * `` `fields[${index}]` ``, per TypeSafe's documented state-referencing pattern).
 */
export interface Analysis {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Short label for what a "true" answer means, used in report headers. */
  readonly positiveLabel: string;
  selectFields(fields: FieldInfo[], context: AnalysisContext): FieldInfo[];
  buildQuestion(index: number): AnalysisQuestion;
}
