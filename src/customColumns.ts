import type { FieldConfig, FieldDef } from "./fieldConfig";
import type { NewBoloRecord, RecordKind } from "./types";

/**
 * Pure mapping between discovered field values and their Dataverse columns.
 * Kept free of SDK imports so it can be tested directly.
 */

/** Discovered fields backed by a real column on this record kind's table. */
export function liveCustomFields(config: FieldConfig, kind: RecordKind): FieldDef[] {
  return config.fields.filter(
    (field) =>
      !field.builtin &&
      Boolean(field.logicalName) &&
      (field.scope === "both" || field.scope === kind),
  );
}

/** Custom values as Dataverse columns, ready to merge into a write payload. */
export function customColumns(config: FieldConfig, input: NewBoloRecord): Record<string, string | null> {
  const columns: Record<string, string | null> = {};
  for (const field of liveCustomFields(config, input.kind)) {
    const value = input.custom?.[field.key];
    const text = Array.isArray(value) ? value.join(";") : (value ?? "");
    // Dataverse rejects "" for a date column, so an empty value has to clear
    // the column outright rather than write a blank string.
    columns[field.logicalName!] = field.type === "date" && !text ? null : text;
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
    const text = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
    if (field.type === "multiselect") {
      custom[field.key] = text.split(";").map((entry) => entry.trim()).filter(Boolean);
    } else if (field.type === "date") {
      custom[field.key] = toDateInput(text);
    } else {
      custom[field.key] = text;
    }
  }
  return custom;
}

/**
 * Date inputs only accept `YYYY-MM-DD`, while Dataverse may return a full
 * timestamp. Slicing the ISO prefix avoids a timezone shift that parsing and
 * reformatting would introduce.
 */
export function toDateInput(value: string): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : "";
}

/**
 * Selecting a column that doesn't exist fails the entire query, so only
 * discovered columns — which are known to exist — may reach the $select list.
 */
export function customSelect(config: FieldConfig, kind: RecordKind): string[] {
  return liveCustomFields(config, kind).map((field) => field.logicalName!);
}
