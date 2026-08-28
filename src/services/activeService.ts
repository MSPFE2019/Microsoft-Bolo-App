import { boloService as mockService, currentUser as mockUser, isHosted } from "./boloService";
import { createDataverseBoloService, getHostUser } from "./dataverseService";
import type { AppUser } from "../types";
import type { BoloService } from "./boloService";

/**
 * Uses Dataverse when the app runs in the Power Apps player and falls back to
 * the local mock service during `npm run dev`.
 */
function resolveService(): BoloService {
  if (!isHosted) return mockService;
  try {
    return createDataverseBoloService();
  } catch (error) {
    console.warn("Falling back to mock BOLO data.", error);
    return mockService;
  }
}

export const activeService: BoloService = resolveService();

export async function resolveActiveUser(): Promise<AppUser> {
  if (!isHosted) return mockUser;
  return getHostUser(mockUser);
}

export const fallbackUser: AppUser = mockUser;