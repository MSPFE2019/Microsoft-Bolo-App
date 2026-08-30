import type { FieldConfig } from "../fieldConfig";
import { DEFAULT_CONFIG, mergeWithBuiltins } from "../fieldConfig";

export interface ConfigService {
  load(): Promise<FieldConfig>;
  save(config: FieldConfig): Promise<FieldConfig>;
}

const STORAGE_KEY = "bolo.fieldConfig";

/** Local-only config used by `npm run dev` and as a fallback if Dataverse is unreachable. */
export function createLocalConfigService(): ConfigService {
  return {
    async load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return mergeWithBuiltins(raw ? (JSON.parse(raw) as FieldConfig) : null);
      } catch {
        return DEFAULT_CONFIG;
      }
    },
    async save(config: FieldConfig) {
      const next = { ...config, version: (config.version ?? 1) + 1 };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // A full or blocked storage quota shouldn't break the editor.
      }
      return next;
    },
  };
}
