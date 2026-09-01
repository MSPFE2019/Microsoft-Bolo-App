import { getContext } from "@microsoft/power-apps/app";
import { New_personbolosService } from "../generated/services/New_personbolosService";
import { New_vehiclebolosService } from "../generated/services/New_vehiclebolosService";
import { RolesService } from "../generated/services/RolesService";
import type { New_personbolos } from "../generated/models/New_personbolosModel";
import type { New_vehiclebolos } from "../generated/models/New_vehiclebolosModel";
import { displayName } from "../types";
import type { AppUser, BoloRecord, BoloStatus, NewBoloRecord, RecordKind } from "../types";
import type { FieldConfig } from "../fieldConfig";
import { DEFAULT_CONFIG } from "../fieldConfig";
import { customColumns as buildCustomColumns, customSelect, readCustom as readCustomValues, toDateInput } from "../customColumns";
import type { BoloService } from "./boloService";
import { parsePhotos, serializePhotos } from "../photo";

type PersonRow = Partial<New_personbolos> & {
  /** Provisioned alongside this build; see scripts/provision-dateofbirth.ps1. */
  new_dateofbirth?: string | null;
  /** Provisioned alongside this build; see scripts/provision-weight.ps1. */
  new_weight?: string | null;
  /** Provisioned alongside this build; see scripts/provision-tattoos.ps1. */
  new_tattoos?: string | null;
};
type VehicleRow = Partial<New_vehiclebolos>;
type AnyRow = PersonRow & VehicleRow;

/**
 * Custom fields live in their own provisioned columns. The config is mutable at
 * runtime, so the adapter reads it through a getter rather than capturing it.
 */
let readConfig: () => FieldConfig = () => DEFAULT_CONFIG;

export function setDataverseFieldConfig(getter: () => FieldConfig) {
  readConfig = getter;
}

function customColumns(input: NewBoloRecord): Record<string, string | null> {
  return buildCustomColumns(readConfig(), input);
}

function readCustom(row: AnyRow, kind: RecordKind): Record<string, string | string[]> {
  return readCustomValues(readConfig(), row as Record<string, unknown>, kind);
}

function splitRace(value?: string): string[] {
  return value ? value.split(";").map((entry) => entry.trim()).filter(Boolean) : [];
}

function toRecord(row: AnyRow, kind: RecordKind): BoloRecord {
  const id =
    kind === "person"
      ? (row as PersonRow).new_personboloid
      : (row as VehicleRow).new_vehicleboloid;

  return {
    id: id ?? crypto.randomUUID(),
    kind,
    boloType: row.new_bolotype ?? (kind === "person" ? "Missing Person" : "Stolen Vehicle"),
    status: (row.new_bolostatus as BoloRecord["status"]) ?? "Open",
    caseNumber: row.new_casenumber ?? "",
    details: row.new_casedetails ?? "",
    createdAt: row.createdon ?? new Date().toISOString(),
    ownerId: row._owninguser_value ?? row.ownerid ?? "",
    ownerName: row.new_ownername ?? row.owneridname ?? "Unknown",
    firstName: (row as PersonRow).new_firstname ?? "",
    middleName: (row as PersonRow).new_middlename ?? "",
    lastName: (row as PersonRow).new_lastname ?? "",
    aka: (row as PersonRow).new_aka ?? "",
    dateOfBirth: toDateInput(((row as PersonRow).new_dateofbirth as string | undefined) ?? ""),
    age: (row as PersonRow).new_age ?? "",
    race: splitRace((row as PersonRow).new_race),
    height: (row as PersonRow).new_height ?? "",
    weight: (row as PersonRow).new_weight ?? "",
    tattoos: (row as PersonRow).new_tattoos ?? "",
    hairColor: (row as PersonRow).new_haircolor ?? "",
    eyeColor: (row as PersonRow).new_eyecolor ?? "",
    city: row.new_city ?? "",
    state: row.new_state ?? "",
    vehicleYear: (row as VehicleRow).new_vehicleyear ?? "",
    vehicleMake: (row as VehicleRow).new_vehiclemake ?? "",
    vehicleModel: (row as VehicleRow).new_vehiclemodel ?? "",
    vehicleColor: (row as VehicleRow).new_vehiclecolor ?? "",
    plateNumber: (row as VehicleRow).new_platenumber ?? "",
    plateState: (row as VehicleRow).new_platestate ?? "",
    photoUrl: parsePhotos(row.new_photourl),
    custom: readCustom(row, kind),
  };
}

function sharedColumns(input: NewBoloRecord) {
  return {
    new_name: displayName({ ...input, id: "", status: "Open", createdAt: "", ownerId: "", ownerName: "" }),
    new_bolotype: input.boloType,
    new_bolostatus: "Open",
    new_casenumber: input.caseNumber,
    new_casedetails: input.details,
    new_city: input.city,
    new_state: input.state,
    new_photourl: serializePhotos(input.photoUrl),
    ...customColumns(input),
  };
}

function personColumns(input: NewBoloRecord) {
  return {
    ...sharedColumns(input),
    new_firstname: input.firstName,
    new_middlename: input.middleName,
    new_lastname: input.lastName,
    new_aka: input.aka,
    // A date column rejects "", so an unset date has to clear the column.
    new_dateofbirth: input.dateOfBirth || null,
    new_age: input.age,
    new_race: input.race.join(";"),
    new_height: input.height,
    new_weight: input.weight,
    new_tattoos: input.tattoos,
    new_haircolor: input.hairColor,
    new_eyecolor: input.eyeColor,
  };
}

function vehicleColumns(input: NewBoloRecord) {
  return {
    ...sharedColumns(input),
    new_vehicleyear: input.vehicleYear,
    new_vehiclemake: input.vehicleMake,
    new_vehiclemodel: input.vehicleModel,
    new_vehiclecolor: input.vehicleColor,
    new_platenumber: input.plateNumber,
    new_platestate: input.plateState,
  };
}

/** Resolves the signed-in user from the Power Apps host context. */
export async function getHostUser(fallback: AppUser): Promise<AppUser> {
  try {
    const context = await getContext();
    const user = context?.user;
    if (!user?.objectId) return fallback;
    return {
      id: user.objectId,
      name: user.fullName ?? user.userPrincipalName ?? fallback.name,
      role: await resolveRole(user.objectId, fallback.role),
    };
  } catch {
    return fallback;
  }
}

/**
 * The host context carries no Dataverse role membership, so the app asks
 * Dataverse whether the caller actually holds the BOLO Administrator role.
 * This only gates UI affordances; Dataverse still enforces the real privileges
 * server side, so being wrong here grants no additional access.
 */
const ADMIN_ROLE_NAME = "BOLO Administrator";

async function resolveRole(objectId: string, fallbackRole: AppUser["role"]): Promise<AppUser["role"]> {
  try {
    // Match the role to *this* user via the membership association. Querying
    // `roles` alone would return every role in the org and make everyone admin.
    const result = await RolesService.getAll({
      select: ["roleid"],
      filter:
        `name eq '${ADMIN_ROLE_NAME}' and ` +
        `systemuserroles_association/any(u:u/azureactivedirectoryobjectid eq ${objectId})`,
      top: 1,
    } as never);
    const isAdmin = (result.data ?? []).length > 0;
    console.info(
      `[BOLO] role check for ${objectId}: ${isAdmin ? "admin" : "officer"} ` +
      `(matched ${(result.data ?? []).length} '${ADMIN_ROLE_NAME}' role rows)`,
    );
    return isAdmin ? "admin" : "officer";
  } catch (error) {
    // Role lookup is best-effort; fall back rather than locking the user out.
    // Surfaced so a missing prvReadRole privilege is diagnosable instead of
    // silently demoting every admin to officer.
    console.warn("[BOLO] role lookup failed; falling back to", fallbackRole, error);
    return fallbackRole;
  }
}

const PERSON_SELECT_BASE = [
  "new_personboloid", "new_name", "new_bolotype", "new_bolostatus", "new_casenumber",
  "new_casedetails", "new_ownername", "new_photourl", "new_city", "new_state",
  "new_firstname", "new_middlename", "new_lastname", "new_aka", "new_dateofbirth", "new_age",
  "new_race", "new_height", "new_weight", "new_haircolor", "new_eyecolor", "new_tattoos", "createdon",
];

const VEHICLE_SELECT_BASE = [
  "new_vehicleboloid", "new_name", "new_bolotype", "new_bolostatus", "new_casenumber",
  "new_casedetails", "new_ownername", "new_photourl", "new_city", "new_state",
  "new_vehicleyear", "new_vehiclemake", "new_vehiclemodel", "new_vehiclecolor",
  "new_platenumber", "new_platestate", "createdon",
];

/**
 * Built as a function because provisioned custom columns are only known at
 * runtime. Selecting a column that doesn't exist fails the whole query, so
 * pending fields are excluded by liveCustomFields.
 */
function selectFor(kind: RecordKind): string[] {
  const base = kind === "person" ? PERSON_SELECT_BASE : VEHICLE_SELECT_BASE;
  return [...base, ...customSelect(readConfig(), kind)];
}

/**
 * Dataverse create/update calls return a bare id (or nothing) rather than the
 * full row. Surface the real server error, then read the record back so the UI
 * always gets a complete record.
 */
async function resolveWritten(
  result: { success?: boolean; data?: unknown; error?: unknown },
  kind: RecordKind,
  fallbackId?: string,
): Promise<BoloRecord> {
  if (result.success === false || result.error) {
    const error = result.error as { message?: string } | undefined;
    throw new Error(error?.message ?? `Dataverse rejected the ${kind} BOLO write.`);
  }

  const row = (result.data ?? {}) as Record<string, unknown>;
  const idField = kind === "person" ? "new_personboloid" : "new_vehicleboloid";
  const id = (row[idField] as string | undefined) ?? fallbackId;

  if (row[idField] && row.new_name !== undefined) {
    return toRecord(row as never, kind);
  }
  if (!id) throw new Error(`Dataverse did not return an id for the ${kind} BOLO.`);

  const fetched =
    kind === "person"
      ? await New_personbolosService.get(id, { select: selectFor("person") })
      : await New_vehiclebolosService.get(id, { select: selectFor("vehicle") });
  if (!fetched.data) throw new Error(`Could not read back the saved ${kind} BOLO.`);
  return toRecord(fetched.data as never, kind);
}

export function createDataverseBoloService(): BoloService {
  return {
    async list() {
      const [people, vehicles] = await Promise.all([
        New_personbolosService.getAll({ select: selectFor("person") }),
        New_vehiclebolosService.getAll({ select: selectFor("vehicle") }),
      ]);
      return [
        ...((people.data ?? []) as PersonRow[]).map((row) => toRecord(row, "person")),
        ...((vehicles.data ?? []) as VehicleRow[]).map((row) => toRecord(row, "vehicle")),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async create(input: NewBoloRecord, user: AppUser) {
      const owner = { new_ownername: user.name };
      if (input.kind === "person") {
        const result = await New_personbolosService.create({ ...personColumns(input), ...owner } as never);
        return resolveWritten(result, "person");
      }
      const result = await New_vehiclebolosService.create({ ...vehicleColumns(input), ...owner } as never);
      return resolveWritten(result, "vehicle");
    },

    async update(id: string, changes: NewBoloRecord, status: BoloStatus) {
      if (changes.kind === "person") {
        const result = await New_personbolosService.update(id, {
          ...personColumns(changes),
          new_bolostatus: status,
        } as never);
        return resolveWritten(result, "person", id);
      }
      const result = await New_vehiclebolosService.update(id, {
        ...vehicleColumns(changes),
        new_bolostatus: status,
      } as never);
      return resolveWritten(result, "vehicle", id);
    },
  };
}
