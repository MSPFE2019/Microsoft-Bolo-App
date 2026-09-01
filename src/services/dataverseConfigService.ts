import { New_boloconfigsService } from "../generated/services/New_boloconfigsService";
import type { FieldConfig } from "../fieldConfig";
import { mergeConfig } from "../fieldConfig";
import { discoverFields } from "./schemaService";
import type { ConfigService } from "./configService";

interface ConfigRow {
  new_boloconfigid?: string;
  new_configjson?: string;
}

const SELECT = ["new_boloconfigid", "new_configjson"];

/**
 * Stores the field configuration in a single Dataverse row so every user of
 * the app sees the same form, and reconciles it against the live table schema
 * so columns added or removed in Power Apps are picked up.
 *
 * Falls back to the caller's local service if the config table isn't
 * reachable, which keeps the app usable rather than failing to start.
 */
export function createDataverseConfigService(fallback: ConfigService): ConfigService {
  let rowId: string | null = null;
  let unavailable = false;

  async function readRow(): Promise<ConfigRow | null> {
    const result = await New_boloconfigsService.getAll({ select: SELECT });
    const row = ((result.data ?? []) as ConfigRow[])[0] ?? null;
    if (row?.new_boloconfigid) rowId = row.new_boloconfigid;
    return row;
  }

  /**
   * Schema discovery is best-effort: if the metadata call fails the app should
   * still open with its built-in fields rather than showing nothing. Returning
   * an empty list makes mergeConfig preserve saved fields untouched.
   */
  async function safeDiscover() {
    try {
      return await discoverFields();
    } catch (error) {
      console.warn("[BOLO] could not read table schema; keeping saved fields.", error);
      return [];
    }
  }

  async function loadMerged(): Promise<FieldConfig> {
    const [row, discovered] = await Promise.all([readRow(), safeDiscover()]);
    const saved = row?.new_configjson ? (JSON.parse(row.new_configjson) as FieldConfig) : null;
    return mergeConfig(saved, discovered);
  }

  return {
    async load() {
      try {
        return await loadMerged();
      } catch (error) {
        console.warn("Field config table unavailable; using local config.", error);
        unavailable = true;
        return fallback.load();
      }
    },

    async refresh() {
      if (unavailable) return fallback.refresh();
      try {
        return await loadMerged();
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? `Could not read the table schema: ${error.message}`
            : "Could not read the table schema.",
        );
      }
    },

    async save(config: FieldConfig) {
      const next = { ...config, version: (config.version ?? 1) + 1 };
      if (unavailable) return fallback.save(config);

      const payload = { new_configjson: JSON.stringify(next) };
      try {
        if (!rowId) await readRow();
        if (rowId) {
          const result = await New_boloconfigsService.update(rowId, payload as never);
          if (result.success === false || result.error) throw asError(result.error);
        } else {
          const result = await New_boloconfigsService.create({
            new_name: "BOLO field configuration",
            ...payload,
          } as never);
          if (result.success === false || result.error) throw asError(result.error);
          rowId = (result.data as ConfigRow | undefined)?.new_boloconfigid ?? null;
        }
        return next;
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? `Could not save configuration: ${error.message}`
            : "Could not save configuration.",
        );
      }
    },
  };
}

function asError(error: unknown): Error {
  const message = (error as { message?: string } | undefined)?.message;
  return new Error(message ?? "Dataverse rejected the configuration write.");
}
