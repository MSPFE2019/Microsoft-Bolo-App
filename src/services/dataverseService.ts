import { getContext } from "@microsoft/power-apps/app";
import { New_personbolosService } from "../generated/services/New_personbolosService";
import { New_vehiclebolosService } from "../generated/services/New_vehiclebolosService";
import type { New_personbolos } from "../generated/models/New_personbolosModel";
import type { New_vehiclebolos } from "../generated/models/New_vehiclebolosModel";
import { displayName } from "../types";
import type { AppUser, BoloRecord, NewBoloRecord, RecordKind } from "../types";
import type { BoloService } from "./boloService";

type PersonRow = Partial<New_personbolos>;
type VehicleRow = Partial<New_vehiclebolos>;
type AnyRow = PersonRow & VehicleRow;

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
    age: (row as PersonRow).new_age ?? "",
    race: splitRace((row as PersonRow).new_race),
    height: (row as PersonRow).new_height ?? "",
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
    photoUrl: row.new_photourl ?? "",
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
    new_photourl: input.photoUrl,
  };
}

function personColumns(input: NewBoloRecord) {
  return {
    ...sharedColumns(input),
    new_firstname: input.firstName,
    new_middlename: input.middleName,
    new_lastname: input.lastName,
    new_aka: input.aka,
    new_age: input.age,
    new_race: input.race.join(";"),
    new_height: input.height,
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
      role: fallback.role,
    };
  } catch {
    return fallback;
  }
}

export function createDataverseBoloService(): BoloService {
  return {
    async list() {
      const [people, vehicles] = await Promise.all([
        New_personbolosService.getAll(),
        New_vehiclebolosService.getAll(),
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
        if (!result.data) throw new Error("Dataverse did not return the created person BOLO.");
        return toRecord(result.data, "person");
      }
      const result = await New_vehiclebolosService.create({ ...vehicleColumns(input), ...owner } as never);
      if (!result.data) throw new Error("Dataverse did not return the created vehicle BOLO.");
      return toRecord(result.data, "vehicle");
    },

    async update(id: string, changes: NewBoloRecord) {
      if (changes.kind === "person") {
        const result = await New_personbolosService.update(id, personColumns(changes) as never);
        if (!result.data) throw new Error("Dataverse did not return the updated person BOLO.");
        return toRecord(result.data, "person");
      }
      const result = await New_vehiclebolosService.update(id, vehicleColumns(changes) as never);
      if (!result.data) throw new Error("Dataverse did not return the updated vehicle BOLO.");
      return toRecord(result.data, "vehicle");
    },
  };
}
