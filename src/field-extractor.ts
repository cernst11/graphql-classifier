import {
  type GraphQLSchema,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
} from "graphql";
import type { FieldArgInfo, FieldInfo, ParentKind } from "./types.js";

interface HasDirectiveAstNode {
  astNode?: { directives?: readonly { name: { value: string } }[] } | null;
}

function extractDirectiveNames(field: HasDirectiveAstNode): string[] {
  return (field.astNode?.directives ?? []).map((directive) => directive.name.value);
}

export function extractFields(schema: GraphQLSchema): FieldInfo[] {
  const fields: FieldInfo[] = [];
  const typeMap = schema.getTypeMap();

  for (const typeName of Object.keys(typeMap)) {
    if (typeName.startsWith("__")) {
      continue;
    }

    const type = typeMap[typeName];
    let parentKind: ParentKind;

    if (isObjectType(type)) {
      parentKind = "OBJECT";
    } else if (isInterfaceType(type)) {
      parentKind = "INTERFACE";
    } else if (isInputObjectType(type)) {
      parentKind = "INPUT_OBJECT";
    } else {
      continue;
    }

    const typeFields = type.getFields();

    for (const fieldName of Object.keys(typeFields)) {
      if (fieldName.startsWith("__")) {
        continue;
      }

      const field = typeFields[fieldName];
      const args: FieldArgInfo[] =
        parentKind === "INPUT_OBJECT"
          ? []
          : ("args" in field ? field.args : []).map((arg) => ({
              name: arg.name,
              type: String(arg.type),
            }));

      fields.push({
        path: `${typeName}.${fieldName}`,
        parentType: typeName,
        parentKind,
        fieldName,
        fieldType: String(field.type),
        description: field.description ?? null,
        args,
        directives: extractDirectiveNames(field),
      });
    }
  }

  return fields;
}
