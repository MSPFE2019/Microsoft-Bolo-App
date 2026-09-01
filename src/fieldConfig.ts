import {
  AGE_OPTIONS,
  EYE_COLOR_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HEIGHT_OPTIONS,
  RACE_OPTIONS,
  STATE_OPTIONS,
  VEHICLE_COLOR_OPTIONS,
  VEHICLE_MAKE_OPTIONS,
  VEHICLE_YEAR_OPTIONS,
  PERSON_BOLO_TYPE_OPTIONS,
  VEHICLE_BOLO_TYPE_OPTIONS,
} from "./types";
import type { RecordKind } from "./types";

export type FieldType = "text" | "textarea" | "select" | "multiselect" | "photo" | "date";

/** Which record kinds a field applies to. */
export type FieldScope = "person" | "vehicle" | "both";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  scope: FieldScope;
  /** Choice list for select/multiselect fields. */
  options: string[];
  required: boolean;
  /** Rendered in the form. */
  visible: boolean;
  /** Rendered on the search/result card. */
  onCard: boolean;
  /** Spans the full width of the form grid. */
  full: boolean;
  placeholder?: string;
  /**
   * Built-in fields map to a dedicated BoloRecord property and a column that
   * ships with the app. They can be hidden and reordered but never removed,
   * because removing one would orphan data the rest of the app reads.
   */
  builtin: boolean;
  /**
   * Dataverse column backing a discovered (non-built-in) field. Discovered
   * fields are found by reading the live table schema, so unlike the previous
   * in-app "add a field" flow the column always exists by the time the app
   * knows about it — there is no pending state to reconcile.
   */
  logicalName?: string;
}

export interface FieldConfig {
  version: number;
  fields: FieldDef[];
}

/** Fields whose values the app itself reads, so they may never be made optional. */
export const PROTECTED_KEYS = ["boloType", "details"];

function def(partial: Partial<FieldDef> & Pick<FieldDef, "key" | "label" | "type" | "scope">): FieldDef {
  return {
    options: [],
    required: false,
    visible: true,
    onCard: false,
    full: false,
    builtin: true,
    ...partial,
  };
}

/**
 * The shipped field catalogue. This is the fallback when no saved config
 * exists, and the source of truth for what a built-in field means.
 */
export const BUILTIN_FIELDS: FieldDef[] = [
  def({ key: "boloType", label: "BOLO type", type: "select", scope: "both", required: true, onCard: true,
    options: [...new Set([...PERSON_BOLO_TYPE_OPTIONS, ...VEHICLE_BOLO_TYPE_OPTIONS])] }),

  def({ key: "firstName", label: "First name", type: "text", scope: "person", required: true, onCard: true, placeholder: "First name" }),
  def({ key: "middleName", label: "Middle name", type: "text", scope: "person", placeholder: "Middle name (optional)" }),
  def({ key: "lastName", label: "Last name", type: "text", scope: "person", required: true, onCard: true, placeholder: "Last name" }),
  def({ key: "aka", label: "AKA", type: "text", scope: "person", placeholder: "Alias or nickname" }),
  def({ key: "dateOfBirth", label: "Date of birth", type: "date", scope: "person" }),
  def({ key: "age", label: "Age range", type: "select", scope: "person", options: AGE_OPTIONS, onCard: true }),
  def({ key: "height", label: "Height", type: "select", scope: "person", options: HEIGHT_OPTIONS, onCard: true }),
  def({ key: "hairColor", label: "Hair color", type: "select", scope: "person", options: HAIR_COLOR_OPTIONS }),
  def({ key: "eyeColor", label: "Eye color", type: "select", scope: "person", options: EYE_COLOR_OPTIONS }),
  def({ key: "race", label: "Race", type: "multiselect", scope: "person", options: RACE_OPTIONS, full: true, onCard: true }),

  def({ key: "vehicleYear", label: "Year", type: "select", scope: "vehicle", options: VEHICLE_YEAR_OPTIONS, required: true, onCard: true }),
  def({ key: "vehicleMake", label: "Make", type: "select", scope: "vehicle", options: VEHICLE_MAKE_OPTIONS, required: true, onCard: true }),
  def({ key: "vehicleModel", label: "Model", type: "text", scope: "vehicle", required: true, onCard: true, placeholder: "e.g. Explorer" }),
  def({ key: "vehicleColor", label: "Color", type: "select", scope: "vehicle", options: VEHICLE_COLOR_OPTIONS, onCard: true }),
  def({ key: "plateNumber", label: "Plate number", type: "text", scope: "vehicle", onCard: true, placeholder: "e.g. ABC1234" }),
  def({ key: "plateState", label: "Plate issuing state", type: "select", scope: "vehicle", options: STATE_OPTIONS, onCard: true }),

  def({ key: "city", label: "City", type: "text", scope: "both", required: true, onCard: true, placeholder: "City" }),
  def({ key: "state", label: "State", type: "select", scope: "both", options: STATE_OPTIONS, required: true, onCard: true }),
  def({ key: "caseNumber", label: "Case number", type: "text", scope: "both", onCard: true, placeholder: "e.g. MP-2025-1042" }),
  def({ key: "photoUrl", label: "Photo", type: "photo", scope: "both", full: true }),
  def({ key: "details", label: "Case details", type: "textarea", scope: "both", required: true, full: true,
    placeholder: "Add details your team should know." }),
];

export const DEFAULT_CONFIG: FieldConfig = { version: 1, fields: BUILTIN_FIELDS };

/**
 * Columns the built-in fields already own, plus the identifiers every table
 * carries. Anything else on the table is a column an administrator added,
 * which is exactly what discovery should surface.
 */
export const RESERVED_COLUMNS = new Set([
  "new_name", "new_bolotype", "new_bolostatus", "new_casenumber", "new_casedetails",
  "new_ownername", "new_photourl", "new_city", "new_state",
  "new_firstname", "new_middlename", "new_lastname", "new_aka", "new_dateofbirth",
  "new_age", "new_race", "new_height", "new_haircolor", "new_eyecolor",
  "new_vehicleyear", "new_vehiclemake", "new_vehiclemodel", "new_vehiclecolor",
  "new_platenumber", "new_platestate",
  "new_personboloid", "new_vehicleboloid", "new_boloconfigid", "new_configjson",
]);

/** A discovered field's key derives from its column, so it stays stable. */
export function keyForColumn(logicalName: string): string {
  return `col_${logicalName.toLowerCase()}`;
}

/** Fields that apply to a record kind, in configured order. */
export function fieldsFor(config: FieldConfig, kind: RecordKind, opts?: { onCard?: boolean }): FieldDef[] {
  return config.fields.filter((field) => {
    if (field.scope !== "both" && field.scope !== kind) return false;
    if (opts?.onCard) return field.onCard;
    return field.visible;
  });
}

/**
 * Reconciles a saved config against the current build's catalogue and the
 * columns discovered on the live tables.
 *
 * Three inputs have to agree: the admin's saved presentation choices, the
 * built-in catalogue this build ships, and the real table schema. The build
 * owns type and scope, the admin owns presentation, and Dataverse decides
 * which discovered fields exist at all — a column deleted from the table drops
 * out here rather than lingering and failing every query that selects it.
 */
export function mergeConfig(saved: FieldConfig | null, discovered: FieldDef[] = []): FieldConfig {
  const discoveredByKey = new Map(discovered.map((field) => [field.key, field]));
  const savedFields = saved?.fields ?? [];
  const savedKeys = new Set(savedFields.map((field) => field.key));
  const merged: FieldDef[] = [];

  for (const field of savedFields) {
    if (field.builtin) {
      const builtin = BUILTIN_FIELDS.find((candidate) => candidate.key === field.key);
      // Drop built-ins this build no longer ships.
      if (!builtin) continue;
      // Admins own presentation; the build owns type and scope so the renderer
      // and the record shape can never disagree.
      merged.push({
        ...builtin,
        label: field.label || builtin.label,
        options: field.options?.length ? field.options : builtin.options,
        required: field.required,
        visible: field.visible,
        onCard: field.onCard,
      });
      continue;
    }

    // A saved discovered field survives only as long as its column does. When
    // no discovery ran (local dev, or the metadata call failed) `discovered` is
    // empty and saved fields are kept as-is rather than silently wiped.
    if (!discovered.length) {
      merged.push(field);
      continue;
    }
    const live = discoveredByKey.get(field.key);
    if (!live) continue;
    merged.push({
      ...live,
      label: field.label || live.label,
      options: field.options?.length ? field.options : live.options,
      required: field.required,
      visible: field.visible,
      onCard: field.onCard,
      full: field.full,
    });
  }

  // Newly shipped built-ins and newly created columns both append, so neither
  // needs an admin edit before it shows up.
  for (const builtin of BUILTIN_FIELDS) {
    if (!savedKeys.has(builtin.key)) merged.push(builtin);
  }
  for (const field of discovered) {
    if (!savedKeys.has(field.key)) merged.push(field);
  }

  return { version: saved?.version ?? 1, fields: merged };
}
