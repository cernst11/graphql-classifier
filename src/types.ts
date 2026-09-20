export interface FieldArgInfo {
  name: string;
  type: string;
}

export type ParentKind = "OBJECT" | "INTERFACE" | "INPUT_OBJECT";

export interface FieldInfo {
  path: string;
  parentType: string;
  parentKind: ParentKind;
  fieldName: string;
  fieldType: string;
  description: string | null;
  args: FieldArgInfo[];
  directives: string[];
}

export interface ClassifiedField extends FieldInfo {
  probability: number;
  flagged: boolean;
}

export interface JsonReportField {
  parentType: string;
  fieldName: string;
  fieldType: string;
  description: string | null;
  probability: number;
  flagged: boolean;
}

export interface TimingStats {
  schemaLoadMs: number;
  extractionMs: number;
  classificationMs: number;
  totalMs: number;
}

export interface AnalysisJsonReport {
  id: string;
  label: string;
  model: string;
  totalFieldsScanned: number;
  flaggedCount: number;
  apiCallCount: number;
  fields: JsonReportField[];
}

export interface JsonReport {
  generatedAt: string;
  source: string;
  threshold: number;
  timing: TimingStats;
  totalApiCallCount: number;
  analyses: AnalysisJsonReport[];
}
