import type { FieldConfig, FieldDef } from "./fieldConfig";
import { isPending } from "./fieldConfig";
import type { NewBoloRecord, RecordKind } from "./types";

/**
 * Pure mapping between custom field values and their Dataverse columns. Kept
 * free of SDK imports so it can be tested directly.
 */

/** Custom fields that have a real column and apply to this record kind. */
export function liveCustomFields(config: FieldConfig, kind: RecordKind): FieldDef[] {
  return config.fields.filter(
    (field) =>
      !field.builtin &&
      !isPending(field) &&
      Boolean(field.logicalName) &&
      (field.scope === "both" || field.scope === kind),
  );
}

/** Custom values as Dataverse columns, ready to merge into a write payload. */
export function customColumns(config: FieldConfig, input: NewBoloRecord): Record<string, string> {
  const columns: Record<string, string> = {};
  for (const field of liveCustomFields(config, input.kind)) {
    const value = input.custom?.[field.key];
    columns[field.logicalName!] = Array.isArray(value) ? value.join(";") : (value ?? "");
  }
  return columns;
}

/** Custom values read back off a Dataverse row. */
export function readCustom(
  config: FieldConfig,
  row: Record<string, unknown>,
  kind: RecordKind,
): Record<string, string | string[]> {
  const custom: Record<string, string | string[]> = {};
  for (const field of liveCustomFields(config, kind)) {
    const raw = row[field.logicalName!];
    const text = typeof raw === "string" ? raw : "";
    custom[field.key] = field.type === "multiselect"
      ? text.split(";").map((entry) => entry.trim()).filter(Boolean)
      : text;
  }
  return custom;
}

/**
 * Selecting a column that doesn't exist fails the entire query, so pending
 * fields must never reach the $select list.
 */
export function customSelect(config: FieldConfig, kind: RecordKind): string[] {
  return liveCustomFields(config, kind).map((field) => field.logicalName!);
}
