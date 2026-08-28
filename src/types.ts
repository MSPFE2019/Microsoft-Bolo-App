export type RecordKind = "person" | "vehicle";
export type BoloStatus = "Open" | "Closed" | "Transferred";
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
  age: string;
  race: string[];
  height: string;
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
}

export type NewBoloRecord = Omit<
  BoloRecord,
  "id" | "status" | "createdAt" | "ownerId" | "ownerName"
>;

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
