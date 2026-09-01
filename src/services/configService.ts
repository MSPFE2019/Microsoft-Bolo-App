import type { FieldConfig, FieldDef } from "../fieldConfig";
import { DEFAULT_CONFIG, mergeConfig } from "../fieldConfig";

export interface ConfigService {
  load(): Promise<FieldConfig>;
  /** Re-reads the table schema and reconciles it with the saved config. */
  refresh(): Promise<FieldConfig>;
  save(config: FieldConfig): Promise<FieldConfig>;
}

const STORAGE_KEY = "bolo.fieldConfig";

/**
 * Local-only config used by `npm run dev` and as a fallback if Dataverse is
 * unreachable. There is no schema to read locally, so refresh just reloads
 * what was saved.
 */
export function createLocalConfigService(discovered: FieldDef[] = []): ConfigService {
  function read(): FieldConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return mergeConfig(raw ? (JSON.parse(raw) as FieldConfig) : null, discovered);
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  return {
    async load() {
      return read();
    },
    async refresh() {
      return read();
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
