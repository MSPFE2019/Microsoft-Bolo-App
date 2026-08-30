import type { FieldDef } from "./fieldConfig";
import { isPending } from "./fieldConfig";
import type { NewBoloRecord } from "./types";
import { fieldValue } from "./types";

interface FieldInputProps {
  field: FieldDef;
  form: NewBoloRecord;
  onChange: (key: string, value: string | string[]) => void;
  onPhoto: (file: File | undefined) => void;
}

/** Renders one configured field as its matching input control. */
export function FieldInput({ field, form, onChange, onPhoto }: FieldInputProps) {
  const value = fieldValue(form, field.key);
  const text = Array.isArray(value) ? "" : value;
  const pending = isPending(field);

  const label = (
    <>
      {field.label}
      {!field.required && field.type !== "multiselect" && <span className="hint">Optional</span>}
      {pending && <span className="pending-tag" title="Run provision-custom-fields.ps1 to create this column">Pending</span>}
    </>
  );

  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className={field.full ? "full checkbox-group" : "checkbox-group"} disabled={pending}>
        <legend>
          {field.label} <span className="hint">Select all that apply</span>
          {pending && <span className="pending-tag">Pending</span>}
        </legend>
        <div className="checkbox-grid">
          {field.options.map((option) => (
            <label className="checkbox" key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() =>
                  onChange(
                    field.key,
                    selected.includes(option)
                      ? selected.filter((entry) => entry !== option)
                      : [...selected, option],
                  )
                }
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.type === "photo") {
    return (
      <label className="full">
        {label}
        <div className="photo-field">
          {text ? (
            <img className="photo-preview" src={text} alt="Selected BOLO" />
          ) : (
            <div className="photo-placeholder">No photo</div>
          )}
          <div className="photo-actions">
            <input type="file" accept="image/*" onChange={(event) => onPhoto(event.target.files?.[0])} />
            {text && (
              <button type="button" className="secondary-button" onClick={() => onChange(field.key, "")}>
                Remove photo
              </button>
            )}
          </div>
        </div>
      </label>
    );
  }

  return (
    <label className={field.full ? "full" : undefined}>
      {label}
      {field.type === "select" ? (
        <select
          required={field.required}
          disabled={pending}
          value={text}
          onChange={(event) => onChange(field.key, event.target.value)}
        >
          <option value="">{`Select ${field.label.toLowerCase()}`}</option>
          {/* Keep an unrecognized stored value selectable so editing never silently rewrites it. */}
          {(field.options.includes(text) || !text ? field.options : [...field.options, text]).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          required={field.required}
          disabled={pending}
          rows={4}
          value={text}
          placeholder={field.placeholder}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      ) : (
        <input
          required={field.required}
          disabled={pending}
          value={text}
          placeholder={field.placeholder}
          onChange={(event) =>
            onChange(field.key, field.key === "plateNumber" ? event.target.value.toUpperCase() : event.target.value)
          }
        />
      )}
    </label>
  );
}
