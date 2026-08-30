import { useState } from "react";
import type { FieldConfig, FieldDef, FieldScope, FieldType } from "./fieldConfig";
import { PROTECTED_KEYS, isPending, slugToLogicalName } from "./fieldConfig";

interface FieldAdminProps {
  config: FieldConfig;
  onSave: (config: FieldConfig) => Promise<void>;
  onClose: () => void;
}

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  textarea: "Long text",
  select: "Dropdown",
  multiselect: "Checkboxes",
  photo: "Photo",
};

const SCOPE_LABELS: Record<FieldScope, string> = {
  person: "Person only",
  vehicle: "Vehicle only",
  both: "Both",
};

export function FieldAdmin({ config, onSave, onClose }: FieldAdminProps) {
  const [draft, setDraft] = useState<FieldDef[]>(config.fields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [newScope, setNewScope] = useState<FieldScope>("both");

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

  function addField() {
    const label = newLabel.trim();
    if (!label) return;

    const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
    if (draft.some((field) => field.key === key)) {
      setError(`A field named "${label}" already exists.`);
      return;
    }

    setError(null);
    setDraft((current) => [
      ...current,
      {
        key,
        label,
        type: newType,
        scope: newScope,
        options: newType === "select" || newType === "multiselect" ? ["Option 1"] : [],
        required: false,
        visible: true,
        onCard: false,
        full: newType === "textarea" || newType === "multiselect",
        builtin: false,
        logicalName: slugToLogicalName(label),
        provisioned: false,
      },
    ]);
    setNewLabel("");
    setExpanded(key);
  }

  function removeField(key: string) {
    setDraft((current) => current.filter((field) => field.key !== key));
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

  const pendingCount = draft.filter((field) => isPending(field)).length;

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

        <p className="admin-intro">
          Choose which fields appear on the BOLO form and the search results card, reorder them,
          and edit dropdown choices. Changes apply to everyone using the app.
        </p>

        {pendingCount > 0 && (
          <div className="admin-warning" role="status">
            {pendingCount} field{pendingCount === 1 ? " is" : "s are"} pending. Run{" "}
            <code>scripts/provision-custom-fields.ps1</code> to create the Dataverse columns, then reload.
            Pending fields are hidden from the form until then.
          </div>
        )}

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
                      {!field.builtin && " · Custom"}
                    </span>
                  </button>
                  {isPending(field) && <span className="pending-tag">Pending</span>}
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
                        Applies to
                        <select
                          value={field.scope}
                          disabled={field.provisioned}
                          onChange={(event) => patch(field.key, { scope: event.target.value as FieldScope })}
                        >
                          {Object.entries(SCOPE_LABELS).map(([value, text]) => (
                            <option key={value} value={value}>{text}</option>
                          ))}
                        </select>
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
                      {field.builtin ? (
                        <span className="muted">
                          Built-in fields can be hidden and reordered, but not deleted.
                        </span>
                      ) : (
                        <button type="button" className="danger-button" onClick={() => removeField(field.key)}>
                          Delete field
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="admin-add">
          <h3>Add a field</h3>
          <div className="admin-add-row">
            <label>
              Label
              <input value={newLabel} placeholder="e.g. Tattoos" onChange={(event) => setNewLabel(event.target.value)} />
            </label>
            <label>
              Type
              <select value={newType} onChange={(event) => setNewType(event.target.value as FieldType)}>
                {Object.entries(TYPE_LABELS)
                  .filter(([value]) => value !== "photo")
                  .map(([value, text]) => (
                    <option key={value} value={value}>{text}</option>
                  ))}
              </select>
            </label>
            <label>
              Applies to
              <select value={newScope} onChange={(event) => setNewScope(event.target.value as FieldScope)}>
                {Object.entries(SCOPE_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>{text}</option>
                ))}
              </select>
            </label>
            <button type="button" className="secondary-button" onClick={addField} disabled={!newLabel.trim()}>
              Add
            </button>
          </div>
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
