import { useState } from "react";
import type { FieldConfig, FieldDef, FieldType } from "./fieldConfig";
import { PROTECTED_KEYS } from "./fieldConfig";

interface FieldAdminProps {
  config: FieldConfig;
  /** Re-reads the Dataverse schema and returns the reconciled config. */
  onRefresh: () => Promise<FieldConfig>;
  onSave: (config: FieldConfig) => Promise<void>;
  onClose: () => void;
}

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  textarea: "Long text",
  select: "Dropdown",
  multiselect: "Checkboxes",
  photo: "Photo",
  date: "Date",
};

const SCOPE_LABELS: Record<FieldDef["scope"], string> = {
  person: "Person only",
  vehicle: "Vehicle only",
  both: "Both",
};

export function FieldAdmin({ config, onRefresh, onSave, onClose }: FieldAdminProps) {
  const [draft, setDraft] = useState<FieldDef[]>(config.fields);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function patch(key: string, changes: Partial<FieldDef>) {
    setDraft((current) => current.map((field) => (field.key === key ? { ...field, ...changes } : field)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= draft.length) return;
    setDraft((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  /**
   * Picks up columns added to the tables since the app loaded. Discovery is
   * reconciled against the *draft* rather than the saved config so unsaved
   * edits survive a refresh.
   */
  async function refresh() {
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const before = new Set(draft.map((field) => field.key));
      const latest = await onRefresh();
      const merged = latest.fields.map((field) => {
        const edited = draft.find((candidate) => candidate.key === field.key);
        return edited ? { ...field, ...edited } : field;
      });
      setDraft(merged);

      const added = merged.filter((field) => !before.has(field.key));
      const removed = [...before].filter(
        (key) => !merged.some((field) => field.key === key),
      );
      setNotice(describeRefresh(added.map((field) => field.label), removed.length));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setRefreshing(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...config, fields: draft });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  const discoveredCount = draft.filter((field) => !field.builtin).length;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal admin-modal">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Administration</p>
            <h2>Customize fields</h2>
          </div>
          <button type="button" className="close" onClick={onClose}>×</button>
        </div>

        <div className="admin-intro">
          <p>
            Choose which fields appear on the BOLO form and the search results card, reorder them,
            and edit dropdown choices. Changes apply to everyone using the app.
          </p>
          <p className="admin-hint">
            To add a new field, add a column to the <code>new_personbolo</code> or{" "}
            <code>new_vehiclebolo</code> table in Power Apps, then select <strong>Refresh</strong>{" "}
            below to pick it up. Refresh also removes fields whose column was deleted.
          </p>
          <div className="admin-refresh-row">
            <button type="button" className="secondary-button" onClick={refresh} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "↻ Refresh from Dataverse"}
            </button>
            <span className="muted">
              {discoveredCount === 0
                ? "No added columns found yet."
                : `${discoveredCount} added column${discoveredCount === 1 ? "" : "s"} found.`}
            </span>
          </div>
          {notice && <div className="admin-notice" role="status">{notice}</div>}
        </div>

        <div className="admin-list">
          {draft.map((field, index) => {
            const open = expanded === field.key;
            const protectedField = PROTECTED_KEYS.includes(field.key);
            return (
              <div className={open ? "admin-row open" : "admin-row"} key={field.key}>
                <div className="admin-row-head">
                  <div className="admin-reorder">
                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">▲</button>
                    <button type="button" onClick={() => move(index, 1)} disabled={index === draft.length - 1} aria-label="Move down">▼</button>
                  </div>
                  <button type="button" className="admin-name" onClick={() => setExpanded(open ? null : field.key)}>
                    <strong>{field.label}</strong>
                    <span className="admin-meta">
                      {TYPE_LABELS[field.type]} · {SCOPE_LABELS[field.scope]}
                      {!field.builtin && " · From Dataverse"}
                    </span>
                  </button>
                  <label className="admin-toggle" title="Show on the BOLO form">
                    <input type="checkbox" checked={field.visible} onChange={(event) => patch(field.key, { visible: event.target.checked })} />
                    <span>Form</span>
                  </label>
                  <label className="admin-toggle" title="Show on the search results card">
                    <input type="checkbox" checked={field.onCard} onChange={(event) => patch(field.key, { onCard: event.target.checked })} />
                    <span>Card</span>
                  </label>
                </div>

                {open && (
                  <div className="admin-row-body">
                    <label>
                      Label
                      <input value={field.label} onChange={(event) => patch(field.key, { label: event.target.value })} />
                    </label>

                    {!field.builtin && (
                      <label>
                        Dataverse column
                        <input value={field.logicalName ?? ""} readOnly disabled />
                      </label>
                    )}

                    <label className="admin-check">
                      <input
                        type="checkbox"
                        checked={field.required}
                        disabled={protectedField}
                        onChange={(event) => patch(field.key, { required: event.target.checked })}
                      />
                      <span>Required</span>
                    </label>

                    {(field.type === "select" || field.type === "multiselect") && (
                      <label className="full">
                        Choices <span className="hint">One per line</span>
                        <textarea
                          rows={6}
                          value={field.options.join("\n")}
                          onChange={(event) =>
                            patch(field.key, {
                              options: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
                            })
                          }
                        />
                      </label>
                    )}

                    <div className="admin-row-actions">
                      <span className="muted">
                        {field.builtin
                          ? "Built-in fields can be hidden and reordered, but not deleted."
                          : "Delete the column in Power Apps, then Refresh, to remove this field."}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="modal-actions">
          {error && <span className="save-error">{error}</span>}
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-button" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Plain-language summary of what a refresh changed. */
function describeRefresh(addedLabels: string[], removedCount: number): string {
  const parts: string[] = [];
  if (addedLabels.length) {
    parts.push(
      `Found ${addedLabels.length} new field${addedLabels.length === 1 ? "" : "s"}: ` +
      `${addedLabels.join(", ")}. Tick "Form" to show ${addedLabels.length === 1 ? "it" : "them"}.`,
    );
  }
  if (removedCount) {
    parts.push(`Removed ${removedCount} field${removedCount === 1 ? "" : "s"} whose column no longer exists.`);
  }
  if (!parts.length) return "Up to date — no column changes found.";
  return `${parts.join(" ")} Select Save configuration to keep these changes.`;
}
