export type RecordKind = "person" | "vehicle";
export type BoloStatus = "Open" | "Closed" | "Archived";

export const STATUS_OPTIONS: BoloStatus[] = ["Open", "Closed", "Archived"];

/** Statuses shown before the user explicitly filters for something else. */
export const DEFAULT_STATUSES: BoloStatus[] = ["Open"];
export type UserRole = "officer" | "admin";

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface BoloRecord {
  id: string;
  kind: RecordKind;
  boloType: string;
  status: BoloStatus;
  caseNumber: string;
  details: string;
  createdAt: string;
  ownerId: string;
  ownerName: string;

  firstName: string;
  middleName: string;
  lastName: string;
  aka: string;
  /** Date-only ISO string (YYYY-MM-DD). Optional. */
  dateOfBirth: string;
  age: string;
  race: string[];
  height: string;
  weight: string;
  hairColor: string;
  eyeColor: string;

  city: string;
  state: string;

  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  plateNumber: string;
  plateState: string;

  /** Data URL (local demo) or Dataverse image download URL. */
  photoUrl: string;

  /**
   * Values for admin-defined custom fields, keyed by FieldDef.key. Each key is
   * backed by its own Dataverse column once provisioned; this bag only exists
   * so the record shape doesn't have to be regenerated for every added field.
   */
  custom: Record<string, string | string[]>;
}

export type NewBoloRecord = Omit<
  BoloRecord,
  "id" | "status" | "createdAt" | "ownerId" | "ownerName"
>;

/** Reads a built-in or custom field off a record by its config key. */
export function fieldValue(record: BoloRecord | NewBoloRecord, key: string): string | string[] {
  if (key in record) return (record as unknown as Record<string, string | string[]>)[key] ?? "";
  return record.custom?.[key] ?? "";
}

export function fieldValueText(record: BoloRecord | NewBoloRecord, key: string): string {
  const value = fieldValue(record, key);
  return Array.isArray(value) ? value.join(", ") : value;
}

export function displayName(record: BoloRecord): string {
  if (record.kind === "vehicle") {
    const description = [record.vehicleYear, record.vehicleMake, record.vehicleModel].filter(Boolean).join(" ");
    return description || "Unidentified vehicle";
  }
  const name = [record.firstName, record.middleName, record.lastName].filter(Boolean).join(" ");
  return name || "Unidentified person";
}

export function vehicleSummary(record: BoloRecord): string {
  const plate = record.plateNumber
    ? `${record.plateState ? `${record.plateState} ` : ""}${record.plateNumber}`
    : "";
  return [record.vehicleColor, plate].filter(Boolean).join(" · ");
}

export function lastKnownLocation(record: BoloRecord): string {
  return [record.city, record.state].filter(Boolean).join(", ");
}

export function canEdit(user: AppUser, record: BoloRecord): boolean {
  if (user.role === "admin") return true;
  // The host context gives an Entra object id, while Dataverse stamps ownerid
  // with the systemuser id, so those never match. Fall back to the owner name
  // we record on the row. Dataverse enforces the real rule server-side.
  if (record.ownerId && user.id && record.ownerId === user.id) return true;
  return Boolean(record.ownerName) && record.ownerName === user.name;
}

export const AGE_OPTIONS = [
  "Under 13",
  "13-17",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
  "Unknown",
];

export const RACE_OPTIONS = [
  "White",
  "Black",
  "Hispanic",
  "Asian",
  "Native American",
  "Native Hawaiian or Other Pacific Islander",
  "Middle Eastern",
  "Other/Unknown",
];

export const HEIGHT_OPTIONS = [
  "Under 4'6\"",
  "4'6\" - 4'11\"",
  "5'0\" - 5'3\"",
  "5'4\" - 5'7\"",
  "5'8\" - 5'11\"",
  "6'0\" - 6'3\"",
  "6'4\" and over",
  "Unknown",
];

export const WEIGHT_OPTIONS = [
  "Under 100 lbs",
  "100 - 119 lbs",
  "120 - 139 lbs",
  "140 - 159 lbs",
  "160 - 179 lbs",
  "180 - 199 lbs",
  "200 - 224 lbs",
  "225 - 249 lbs",
  "250 lbs and over",
  "Unknown",
];

export const HAIR_COLOR_OPTIONS = [
  "Black",
  "Brown",
  "Blonde",
  "Red",
  "Gray",
  "White",
  "Bald",
  "Other/Unknown",
];

export const EYE_COLOR_OPTIONS = [
  "Brown",
  "Blue",
  "Green",
  "Hazel",
  "Gray",
  "Black",
  "Other/Unknown",
];

export const PERSON_BOLO_TYPE_OPTIONS = [
  "Missing Person",
  "Wanted Person",
  "Person of Interest",
  "Person at Risk",
];

export const VEHICLE_BOLO_TYPE_OPTIONS = [
  "Stolen Vehicle",
  "Used in Crime",
];

export function boloTypeOptions(kind: RecordKind, current?: string): string[] {
  const options = kind === "person" ? PERSON_BOLO_TYPE_OPTIONS : VEHICLE_BOLO_TYPE_OPTIONS;
  // Keep a legacy or unrecognized value selectable so editing never silently
  // rewrites it to the first option.
  return current && !options.includes(current) ? [...options, current] : options;
}

export const VEHICLE_COLOR_OPTIONS = [
  "Black",
  "White",
  "Gray",
  "Silver",
  "Red",
  "Blue",
  "Green",
  "Brown",
  "Beige/Tan",
  "Gold",
  "Yellow",
  "Orange",
  "Purple",
  "Maroon",
  "Other/Unknown",
];

export const VEHICLE_MAKE_OPTIONS = [
  "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler",
  "Dodge", "Ford", "GMC", "Honda", "Hyundai", "Infiniti", "Jeep", "Kia",
  "Lexus", "Lincoln", "Mazda", "Mercedes-Benz", "Nissan", "Ram", "Subaru",
  "Tesla", "Toyota", "Volkswagen", "Volvo", "Other/Unknown",
];

export const VEHICLE_YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() + 1 - 1980 + 1 },
  (_, index) => String(new Date().getFullYear() + 1 - index),
);

export const STATE_OPTIONS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI",
  "WY", "PR", "VI", "GU", "AS", "MP",
];
