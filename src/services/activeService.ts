import { boloService as mockService, currentUser as mockUser, isHosted } from "./boloService";
import { createDataverseBoloService, getHostUser } from "./dataverseService";
import { createLocalConfigService } from "./configService";
import { createDataverseConfigService } from "./dataverseConfigService";
import type { AppUser } from "../types";
import type { BoloService } from "./boloService";
import type { ConfigService } from "./configService";

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

/** Field configuration comes from Dataverse when hosted so every user shares it. */
function resolveConfigService(): ConfigService {
  const local = createLocalConfigService();
  if (!isHosted) return local;
  try {
    return createDataverseConfigService(local);
  } catch (error) {
    console.warn("Falling back to local field configuration.", error);
    return local;
  }
}

export const activeConfigService: ConfigService = resolveConfigService();

export async function resolveActiveUser(): Promise<AppUser> {
  if (!isHosted) return mockUser;
  return getHostUser(mockUser);
}

export const fallbackUser: AppUser = mockUser;