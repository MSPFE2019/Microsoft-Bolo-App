import { New_personbolosService } from "../generated/services/New_personbolosService";
import { New_vehiclebolosService } from "../generated/services/New_vehiclebolosService";
import type { FieldDef, FieldScope, FieldType } from "../fieldConfig";
import { RESERVED_COLUMNS, keyForColumn } from "../fieldConfig";
import type { RecordKind } from "../types";

/**
 * Discovers admin-added columns by reading the live table schema.
 *
 * Administrators add fields in Dataverse (the maker portal or Excel-style
 * table editor) rather than in the app, so the app's job is to notice what is
 * already there. Reading the schema is what makes the Refresh button work: a
 * column added minutes ago shows up without a redeploy.
 */

/** The subset of Dataverse attribute metadata this module relies on. */
interface Attribute {
  LogicalName?: string;
  AttributeType?: string | number;
  AttributeTypeName?: { Value?: string };
  DisplayName?: { UserLocalizedLabel?: { Label?: string } };
  IsValidForCreate?: boolean;
  IsValidForUpdate?: boolean;
  IsCustomAttribute?: boolean;
  IsLogical?: boolean;
  AttributeOf?: string | null;
  MaxLength?: number;
  RequiredLevel?: { Value?: string };
  OptionSet?: { Options?: OptionSetOption[] };
  GlobalOptionSet?: { Options?: OptionSetOption[] };
}

interface OptionSetOption {
  Value?: number;
  Label?: { UserLocalizedLabel?: { Label?: string } };
}

/**
 * Dataverse reports the attribute type either as a numeric code or its name
 * depending on the shape of the metadata response, so normalize to the name.
 */
const TYPE_CODE_NAMES: Record<number, string> = {
  0: "Boolean", 2: "DateTime", 3: "Decimal", 4: "Double", 5: "Integer",
  6: "Lookup", 7: "Memo", 8: "Money", 11: "Picklist", 12: "State",
  13: "Status", 14: "String", 15: "Uniqueidentifier", 18: "BigInt",
};

function typeName(attribute: Attribute): string {
  const raw = attribute.AttributeType;
  if (typeof raw === "number") return TYPE_CODE_NAMES[raw] ?? "";
  if (typeof raw === "string" && raw) return raw;
  return (attribute.AttributeTypeName?.Value ?? "").replace(/Type$/, "");
}

/** Maps a Dataverse column type onto the input control the form should render. */
function fieldTypeFor(attribute: Attribute): FieldType | null {
  switch (typeName(attribute)) {
    case "String":
      // A generous max length is how the app stores multi-value columns, and
      // is also the shape a long note takes, so treat it as a text area.
      return (attribute.MaxLength ?? 0) > 2000 ? "textarea" : "text";
    case "Memo":
      return "textarea";
    case "DateTime":
      return "date";
    case "Picklist":
      return "select";
    case "Integer":
    case "Decimal":
    case "Double":
    case "Money":
      return "text";
    case "Boolean":
      return "select";
    default:
      // Lookups, owners, and identifiers have no sensible plain-text control,
      // so they are skipped rather than rendered as something they are not.
      return null;
  }
}

function optionsFor(attribute: Attribute): string[] {
  const options = attribute.OptionSet?.Options ?? attribute.GlobalOptionSet?.Options ?? [];
  const labels = options
    .map((option) => option.Label?.UserLocalizedLabel?.Label ?? "")
    .filter(Boolean);
  if (labels.length) return labels;
  return typeName(attribute) === "Boolean" ? ["Yes", "No"] : [];
}

/** True when a column is one an administrator could meaningfully fill in. */
function isUsable(attribute: Attribute): boolean {
  if (!attribute.LogicalName) return false;
  if (attribute.IsLogical) return false;
  // Calculated/rollup companions and split columns (e.g. `_value` halves of a
  // lookup) are projections of another column, not fields in their own right.
  if (attribute.AttributeOf) return false;
  if (attribute.IsValidForCreate === false || attribute.IsValidForUpdate === false) return false;
  if (RESERVED_COLUMNS.has(attribute.LogicalName.toLowerCase())) return false;
  // System columns are noise here; only columns someone added are of interest.
  if (attribute.IsCustomAttribute === false) return false;
  return true;
}

function toFieldDef(attribute: Attribute, scope: FieldScope): FieldDef | null {
  const logicalName = attribute.LogicalName!;
  const type = fieldTypeFor(attribute);
  if (!type) return null;

  const label = attribute.DisplayName?.UserLocalizedLabel?.Label || logicalName;
  return {
    key: keyForColumn(logicalName),
    label,
    type,
    scope,
    options: type === "select" ? optionsFor(attribute) : [],
    // Dataverse already enforces its own required level; mirroring it here
    // just keeps the form from submitting something the server would reject.
    required: attribute.RequiredLevel?.Value === "ApplicationRequired",
    // Discovered fields stay off the form until an administrator turns them on,
    // so a stray column can never disrupt the form for every user.
    visible: false,
    onCard: false,
    full: type === "textarea",
    builtin: false,
    logicalName,
  };
}

async function attributesFor(kind: RecordKind): Promise<Attribute[]> {
  const service = kind === "person" ? New_personbolosService : New_vehiclebolosService;
  const result = await service.getMetadata({ schema: { columns: "all" } } as never);
  const metadata = result.data as { Attributes?: Attribute[] } | undefined;
  return metadata?.Attributes ?? [];
}

/**
 * Reads both tables and returns the admin-added columns as fields.
 *
 * A column present on both tables becomes one `both`-scoped field so it is
 * configured once rather than appearing twice under the same name.
 */
export async function discoverFields(): Promise<FieldDef[]> {
  const [personAttributes, vehicleAttributes] = await Promise.all([
    attributesFor("person"),
    attributesFor("vehicle"),
  ]);

  const byKey = new Map<string, FieldDef>();

  for (const [attributes, scope] of [
    [personAttributes, "person"],
    [vehicleAttributes, "vehicle"],
  ] as const) {
    for (const attribute of attributes) {
      if (!isUsable(attribute)) continue;
      const field = toFieldDef(attribute, scope);
      if (!field) continue;

      const existing = byKey.get(field.key);
      byKey.set(field.key, existing ? { ...existing, scope: "both" } : field);
    }
  }

  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}
