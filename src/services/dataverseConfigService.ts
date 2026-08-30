import { New_boloconfigsService } from "../generated/services/New_boloconfigsService";
import type { FieldConfig } from "../fieldConfig";
import { DEFAULT_CONFIG, mergeWithBuiltins } from "../fieldConfig";
import type { ConfigService } from "./configService";

interface ConfigRow {
  new_boloconfigid?: string;
  new_configjson?: string;
}

const SELECT = ["new_boloconfigid", "new_configjson"];

/**
 * Stores the field configuration in a single Dataverse row so every user of
 * the app sees the same form. Falls back to the caller's local service if the
 * config table isn't reachable, which keeps the app usable rather than failing
 * to start.
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

  return {
    async load() {
      try {
        const row = await readRow();
        if (!row?.new_configjson) return DEFAULT_CONFIG;
        return mergeWithBuiltins(JSON.parse(row.new_configjson) as FieldConfig);
      } catch (error) {
        console.warn("Field config table unavailable; using local config.", error);
        unavailable = true;
        return fallback.load();
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
