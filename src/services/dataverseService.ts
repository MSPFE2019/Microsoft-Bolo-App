import type { AppUser, BoloRecord, NewBoloRecord, RecordKind } from "../types";
import type { BoloService } from "./boloService";

/**
 * Shape returned by the generated Power Apps Dataverse services.
 * Pass the generated services to createDataverseBoloService after
 * `pac code add-data-source` creates the environment-specific files.
 */
export interface DataverseBoloRow {
  boloid?: string;
  new_boloid?: string;
  new_bolotype?: string;
  new_bolostatus?: string;
  new_casenumber?: string;
  new_details?: string;
  new_firstname?: string;
  new_middlename?: string;
  new_lastname?: string;
  new_aka?: string;
  new_age?: string;
  new_race?: string;
  new_height?: string;
  new_haircolor?: string;
  new_eyecolor?: string;
  new_city?: string;
  new_state?: string;
  new_vehicleyear?: string;
  new_vehiclemake?: string;
  new_vehiclemodel?: string;
  new_vehiclecolor?: string;
  new_platenumber?: string;
  new_platestate?: string;
  new_photourl?: string;
  _ownerid_value?: string;
  new_ownername?: string;
  createdon?: string;
}

export interface GeneratedDataverseService {
  getAll(options?: {
    select?: string[];
    filter?: string;
    orderBy?: string[];
    top?: number;
  }): Promise<{ data?: DataverseBoloRow[] }>;
  create(input: Record<string, string>): Promise<{ data?: DataverseBoloRow }>;
  update(id: string, changes: Record<string, string>): Promise<{ data?: DataverseBoloRow }>;
}

function toRecord(row: DataverseBoloRow, kind: RecordKind): BoloRecord {
  return {
    id: row.boloid ?? row.new_boloid ?? crypto.randomUUID(),
    kind,
    boloType: row.new_bolotype ?? "Uncategorized",
    status: (row.new_bolostatus as BoloRecord["status"]) ?? "Open",
    caseNumber: row.new_casenumber ?? "",
    details: row.new_details ?? "",
    createdAt: row.createdon ?? new Date().toISOString(),
    ownerId: row._ownerid_value ?? "",
    ownerName: row.new_ownername ?? "Unknown",
    firstName: row.new_firstname ?? "",
    middleName: row.new_middlename ?? "",
    lastName: row.new_lastname ?? "",
    aka: row.new_aka ?? "",
    age: row.new_age ?? "",
    race: row.new_race ? row.new_race.split(";").map((value) => value.trim()).filter(Boolean) : [],
    height: row.new_height ?? "",
    hairColor: row.new_haircolor ?? "",
    eyeColor: row.new_eyecolor ?? "",
    city: row.new_city ?? "",
    state: row.new_state ?? "",
    vehicleYear: row.new_vehicleyear ?? "",
    vehicleMake: row.new_vehiclemake ?? "",
    vehicleModel: row.new_vehiclemodel ?? "",
    vehicleColor: row.new_vehiclecolor ?? "",
    plateNumber: row.new_platenumber ?? "",
    plateState: row.new_platestate ?? "",
    photoUrl: row.new_photourl ?? "",
  };
}

function toColumns(input: NewBoloRecord): Record<string, string> {
  return {
    new_bolotype: input.boloType,
    new_casenumber: input.caseNumber,
    new_details: input.details,
    new_firstname: input.firstName,
    new_middlename: input.middleName,
    new_lastname: input.lastName,
    new_aka: input.aka,
    new_age: input.age,
    new_race: input.race.join(";"),
    new_height: input.height,
    new_haircolor: input.hairColor,
    new_eyecolor: input.eyeColor,
    new_city: input.city,
    new_state: input.state,
    new_vehicleyear: input.vehicleYear,
    new_vehiclemake: input.vehicleMake,
    new_vehiclemodel: input.vehicleModel,
    new_vehiclecolor: input.vehicleColor,
    new_platenumber: input.plateNumber,
    new_platestate: input.plateState,
    new_photourl: input.photoUrl,
  };
}

export function createDataverseBoloService(
  personService: GeneratedDataverseService,
  vehicleService: GeneratedDataverseService,
): BoloService {
  const serviceFor = (kind: RecordKind) => (kind === "person" ? personService : vehicleService);

  return {
    async list() {
      const [people, vehicles] = await Promise.all([
        personService.getAll({ top: 100, orderBy: ["createdon desc"] }),
        vehicleService.getAll({ top: 100, orderBy: ["createdon desc"] }),
      ]);
      return [
        ...(people.data ?? []).map((row) => toRecord(row, "person")),
        ...(vehicles.data ?? []).map((row) => toRecord(row, "vehicle")),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async create(input: NewBoloRecord, user: AppUser) {
      const result = await serviceFor(input.kind).create({
        ...toColumns(input),
        new_ownername: user.name,
      });
      if (!result.data) throw new Error("Dataverse did not return the created BOLO record.");
      return toRecord(result.data, input.kind);
    },

    async update(id: string, changes: NewBoloRecord) {
      const result = await serviceFor(changes.kind).update(id, toColumns(changes));
      if (!result.data) throw new Error("Dataverse did not return the updated BOLO record.");
      return toRecord(result.data, changes.kind);
    },
  };
}
