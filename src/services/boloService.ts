import type { AppUser, BoloRecord, NewBoloRecord } from "../types";

// Represents the signed-in user. In a deployed code app this comes from the
// Power Platform host context rather than a constant.
export const currentUser: AppUser = {
  id: "user-officer-1",
  name: "Officer M. Rich",
  role: "officer",
};

const seedRecords: BoloRecord[] = [
  {
    id: "P-1042",
    kind: "person",
    boloType: "Missing Person",
    status: "Open",
    caseNumber: "MP-2025-1042",
    details: "Last seen near the downtown transit center wearing a dark jacket.",
    createdAt: "2025-02-18T14:30:00.000Z",
    ownerId: "user-officer-1",
    ownerName: "Officer M. Rich",
    firstName: "Jordan",
    middleName: "Avery",
    lastName: "Lee",
    aka: "JL",
    age: "25-34",
    race: ["Black"],
    height: "5'8\" - 5'11\"",
    hairColor: "Black",
    eyeColor: "Brown",
    city: "Seattle",
    state: "WA",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleColor: "",
    plateNumber: "",
    plateState: "",
    photoUrl: "",
  },
  {
    id: "P-1043",
    kind: "person",
    boloType: "Wanted Person",
    status: "Open",
    caseNumber: "",
    details: "Wanted for questioning related to an ongoing investigation.",
    createdAt: "2025-02-16T11:00:00.000Z",
    ownerId: "user-officer-2",
    ownerName: "Officer D. Cole",
    firstName: "Riley",
    middleName: "",
    lastName: "Sanchez",
    aka: "R.S.",
    age: "35-44",
    race: ["Hispanic"],
    height: "5'4\" - 5'7\"",
    hairColor: "Brown",
    eyeColor: "Hazel",
    city: "Tacoma",
    state: "WA",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleColor: "",
    plateNumber: "",
    plateState: "",
    photoUrl: "",
  },
  {
    id: "V-0871",
    kind: "vehicle",
    boloType: "Stolen Vehicle",
    status: "Open",
    caseNumber: "SV-2025-0871",
    details: "Rear bumper has visible damage on the driver side.",
    createdAt: "2025-02-17T09:15:00.000Z",
    ownerId: "user-officer-1",
    ownerName: "Officer M. Rich",
    firstName: "",
    middleName: "",
    lastName: "",
    aka: "",
    age: "",
    race: [],
    height: "",
    hairColor: "",
    eyeColor: "",
    city: "Redmond",
    state: "WA",
    vehicleYear: "2021",
    vehicleMake: "Ford",
    vehicleModel: "Explorer",
    vehicleColor: "White",
    plateNumber: "ABC1234",
    plateState: "WA",
    photoUrl: "",
  },
  {
    id: "V-0864",
    kind: "vehicle",
    boloType: "Used in Crime",
    status: "Transferred",
    caseNumber: "UC-2025-0864",
    details: "Share sightings with the assigned investigator.",
    createdAt: "2025-02-12T18:05:00.000Z",
    ownerId: "user-officer-3",
    ownerName: "Officer P. Nguyen",
    firstName: "",
    middleName: "",
    lastName: "",
    aka: "",
    age: "",
    race: [],
    height: "",
    hairColor: "",
    eyeColor: "",
    city: "Bellevue",
    state: "WA",
    vehicleYear: "2018",
    vehicleMake: "Honda",
    vehicleModel: "Civic",
    vehicleColor: "Gray",
    plateNumber: "XYZ9876",
    plateState: "WA",
    photoUrl: "",
  },
];

export interface BoloService {
  list(): Promise<BoloRecord[]>;
  create(input: NewBoloRecord, user: AppUser): Promise<BoloRecord>;
  update(id: string, changes: NewBoloRecord): Promise<BoloRecord>;
}

export class MockBoloService implements BoloService {
  private records = [...seedRecords];

  async list(): Promise<BoloRecord[]> {
    return [...this.records];
  }

  async create(input: NewBoloRecord, user: AppUser): Promise<BoloRecord> {
    const record: BoloRecord = {
      ...input,
      id: `${input.kind === "person" ? "P" : "V"}-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "Open",
      createdAt: new Date().toISOString(),
      ownerId: user.id,
      ownerName: user.name,
    };
    this.records = [record, ...this.records];
    return record;
  }

  async update(id: string, changes: NewBoloRecord): Promise<BoloRecord> {
    const existing = this.records.find((record) => record.id === id);
    if (!existing) throw new Error(`BOLO record ${id} was not found.`);
    const updated: BoloRecord = { ...existing, ...changes };
    this.records = this.records.map((record) => (record.id === id ? updated : record));
    return updated;
  }
}

export const boloService: BoloService = new MockBoloService();
