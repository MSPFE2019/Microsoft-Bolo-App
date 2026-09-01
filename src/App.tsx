import { FormEvent, useEffect, useMemo, useState } from "react";

const MOBILE_BREAKPOINT = 820;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT,
  );
  useEffect(() => {
    const media = window.matchMedia(`(max-width:${MOBILE_BREAKPOINT}px)`);
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return isMobile;
}

/** Ticking wall clock for the dispatch header. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

import { activeService as boloService, activeConfigService, fallbackUser, resolveActiveUser } from "./services/activeService";
import {
  boloTypeOptions,
  STATUS_OPTIONS,
  DEFAULT_STATUSES,
  canEdit,
  displayName,
  fieldValueText,
  lastKnownLocation,
  vehicleSummary,
} from "./types";
import type { BoloRecord, BoloStatus, NewBoloRecord, RecordKind } from "./types";
import { DEFAULT_CONFIG, fieldsFor } from "./fieldConfig";
import type { FieldConfig } from "./fieldConfig";
import { setDataverseFieldConfig } from "./services/dataverseService";
import { FieldInput } from "./FieldInput";
import { FieldAdmin } from "./FieldAdmin";
import { fileToStoredPhoto, MAX_PHOTOS, PHOTO_BUDGET } from "./photo";
import { logoDataUri as logoUrl } from "./assets/logo";

const emptyForm: NewBoloRecord = {
  kind: "person",
  boloType: "Missing Person",
  caseNumber: "",
  details: "",
  firstName: "",
  middleName: "",
  lastName: "",
  aka: "",
  dateOfBirth: "",
  age: "",
  race: [],
  height: "",
  weight: "",
  hairColor: "",
  eyeColor: "",
  city: "",
  state: "",
  vehicleYear: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleColor: "",
  plateNumber: "",
  plateState: "",
  photoUrl: [],
  tattoos: "",
  custom: {},
};

function toForm(record: BoloRecord): NewBoloRecord {
  const { id, status, createdAt, ownerId, ownerName, ...rest } = record;
  return rest;
}

function App() {
  const [records, setRecords] = useState<BoloRecord[]>([]);
  const [kind, setKind] = useState<RecordKind>("person");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewBoloRecord>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formStatus, setFormStatus] = useState<BoloStatus>("Open");
  const [statusFilter, setStatusFilter] = useState<BoloStatus[]>(DEFAULT_STATUSES);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(fallbackUser);
  const [loadError, setLoadError] = useState("");
  const [config, setConfig] = useState<FieldConfig>(DEFAULT_CONFIG);
  const [showAdmin, setShowAdmin] = useState(false);
  const isMobile = useIsMobile();
  const now = useNow();
  const canManage = !isMobile;
  const isAdmin = currentUser.role === "admin";

  useEffect(() => {
    void resolveActiveUser().then(setCurrentUser);
  }, []);

  useEffect(() => {
    void activeConfigService.load().then(setConfig);
  }, []);

  // The Dataverse adapter needs the live config to know which custom columns
  // to select and write, and the config can change while the app is running.
  useEffect(() => {
    setDataverseFieldConfig(() => config);
  }, [config]);

  async function saveConfig(next: FieldConfig) {
    const saved = await activeConfigService.save(next);
    setConfig(saved);
    // Custom columns may have been added or removed, so re-read the records.
    setRecords(await boloService.list());
  }

  /**
   * Re-reads the table schema so columns added in Power Apps appear without a
   * redeploy. The config isn't committed here — the admin reviews what was
   * found and then saves.
   */
  async function refreshConfig(): Promise<FieldConfig> {
    return activeConfigService.refresh();
  }

  useEffect(() => {
    void boloService
      .list()
      .then(setRecords)
      .catch((error: unknown) => setLoadError(String(error)));
  }, []);

  useEffect(() => {
    setActivePhoto(0);
  }, [selectedId]);

  useEffect(() => {
    if (isMobile && showForm) {
      setShowForm(false);
      setEditingId(null);
    }
  }, [isMobile, showForm]);

  const visibleRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      if (record.kind !== kind) return false;
      if (!statusFilter.includes(record.status)) return false;
      if (!normalizedQuery) return true;
      // Search every configured field for this kind plus the always-present
      // identifiers, so admin-added fields are searchable too. Photos are
      // skipped: their base64 data would both bloat the haystack and produce
      // nonsense matches on strings like "jpeg".
      const haystack = [
        displayName(record),
        record.caseNumber,
        lastKnownLocation(record),
        ...fieldsFor(config, kind)
          .filter((field) => field.type !== "photo")
          .map((field) => fieldValueText(record, field.key)),
      ];
      return haystack.join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [config, kind, query, records, statusFilter]);

  const selectedRecord = records.find((record) => record.id === selectedId) ?? null;
  const openCount = records.filter((record) => record.status === "Open").length;

  // Every configured field is backed by a real column, so all of them render.
  const formFields = useMemo(
    () => fieldsFor(config, form.kind),
    [config, form.kind],
  );
  const cardFields = useMemo(
    () => fieldsFor(config, kind, { onCard: true }),
    [config, kind],
  );
  const detailFields = useMemo(
    () => (selectedRecord ? fieldsFor(config, selectedRecord.kind) : []),
    [config, selectedRecord],
  );

  function changeKind(nextKind: RecordKind) {
    setKind(nextKind);
    setForm((current) => ({
      ...current,
      kind: nextKind,
      boloType: boloTypeOptions(nextKind)[0],
    }));
  }

  /** Writes a built-in property or a custom value depending on the field key. */
  function setFieldValue(key: string, value: string | string[]) {
    setForm((current) =>
      key in current
        ? ({ ...current, [key]: value } as NewBoloRecord)
        : { ...current, custom: { ...current.custom, [key]: value } },
    );
  }

  async function selectPhoto(files: File[]) {
    if (files.length === 0) return;
    setSaveError(null);
    const existing = form.photoUrl;
    const room = MAX_PHOTOS - existing.length;
    if (room <= 0) {
      setSaveError(`A BOLO can hold ${MAX_PHOTOS} photos. Remove one before adding another.`);
      return;
    }
    const accepted = files.slice(0, room);
    try {
      // All photos share one column, so each new one only gets its fair share
      // of whatever budget the existing photos left behind.
      const used = existing.reduce((total, photo) => total + photo.length, 0);
      const budget = Math.floor((PHOTO_BUDGET - used) / accepted.length);
      const added: string[] = [];
      for (const file of accepted) {
        added.push(await fileToStoredPhoto(file, budget));
      }
      setForm((current) => ({ ...current, photoUrl: [...current.photoUrl, ...added].slice(0, MAX_PHOTOS) }));
      if (files.length > accepted.length) {
        setSaveError(`Only ${accepted.length} of ${files.length} photos were added — the limit is ${MAX_PHOTOS}.`);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }

  function startCreate() {
    setEditingId(null);
    setFormStatus("Open");
    setSaveError(null);
    setForm({ ...emptyForm, kind, boloType: boloTypeOptions(kind)[0] });
    setShowForm(true);
  }

  function startEdit(record: BoloRecord) {
    setEditingId(record.id);
    setFormStatus(record.status);
    setSaveError(null);
    setForm(toForm(record));
    setShowForm(true);
  }

  function toggleStatusFilter(status: BoloStatus) {
    setStatusFilter((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status],
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      if (editingId) {
        const updated = await boloService.update(editingId, form, formStatus);
        setRecords((current) => current.map((record) => (record.id === editingId ? updated : record)));
      } else {
        const created = await boloService.create(form, currentUser);
        setRecords((current) => [created, ...current]);
        setKind(form.kind);
        setQuery("");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={logoUrl} alt="" />
          <span>BOLO App</span>
        </div>
        <div className="topbar-right">
          <span className="environment">{currentUser.name} · {currentUser.role === "admin" ? "Administrator" : "Officer"} · {canManage ? "Dispatch console" : "Field lookup"}</span>
          <div className="clock">
            <time dateTime={now.toISOString()}>
              {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </time>
            <span>{now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>
      </header>
      <main className="content">
        <section className="hero">
          <div>
            <p className="eyebrow">Be on the lookout</p>
            <h1>{canManage ? "Dispatch every alert. Cover every shift." : "Run a BOLO from the field."}</h1>
            <p className="hero-copy">
              {canManage
                ? "Issue, update, and broadcast active person and vehicle BOLOs so every unit on patrol is working from the same information."
                : "Search active person and vehicle BOLOs on scene. Records are issued and updated from the dispatch console."}
            </p>
          </div>
          {(canManage || isAdmin) && (
            <div className="hero-actions">
              {isAdmin && (
                <button className="secondary-button" onClick={() => setShowAdmin(true)}>⚙ Customize fields</button>
              )}
              {canManage && (
                <button className="primary-button" onClick={startCreate}>＋ New BOLO</button>
              )}
            </div>
          )}
        </section>

        {loadError && (
          <div className="load-error" role="alert">
            Could not load BOLO records: {loadError}
          </div>
        )}

        <section className="stats" aria-label="BOLO summary">
          <div><strong>{openCount}</strong><span>Open alerts</span></div>
          <div><strong>{records.filter((r) => r.kind === "person").length}</strong><span>Person records</span></div>
          <div><strong>{records.filter((r) => r.kind === "vehicle").length}</strong><span>Vehicle records</span></div>
        </section>

        <section className="workspace">
          <div className="toolbar">
            <div className="tabs">
              <button className={kind === "person" ? "tab active" : "tab"} onClick={() => changeKind("person")}>People</button>
              <button className={kind === "vehicle" ? "tab active" : "tab"} onClick={() => changeKind("vehicle")}>Vehicles</button>
            </div>
            <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${kind} BOLOs`} /></label>
          </div>
          <div className="status-filter" role="group" aria-label="Filter by status">
            <span className="status-filter-label">Status</span>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                className={statusFilter.includes(status) ? "status-chip active" : "status-chip"}
                aria-pressed={statusFilter.includes(status)}
                onClick={() => toggleStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
          <div className="record-list">
            {visibleRecords.map((record) => (
              <article
                className={record.id === selectedId ? "record-card selected" : "record-card"}
                key={record.id}
                aria-current={record.id === selectedId}
                onClick={() => setSelectedId(record.id)} role="button" tabIndex={0}
                onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setSelectedId(record.id)}>
                {record.photoUrl.length > 0
                  ? <img className="record-photo" src={record.photoUrl[0]} alt={displayName(record)} />
                  : <div className={`record-icon ${record.kind}`}>{record.kind === "person" ? "♙" : "▱"}</div>}
                <div className="record-main">
                  <div className="record-heading"><h2>{displayName(record)}</h2><span className={`status ${record.status.toLowerCase()}`}>{record.status}</span></div>
                  <p>{record.boloType}{record.caseNumber && <> <span className="dot">·</span> {record.caseNumber}</>}</p>
                  <p className="muted">
                    {cardFields
                      // Name and BOLO type already headline the card, and the
                      // photo is the thumbnail rather than a summary value.
                      .filter((field) => field.type !== "photo")
                      .filter((field) => !["firstName", "middleName", "lastName", "boloType", "caseNumber", "vehicleYear", "vehicleMake", "vehicleModel"].includes(field.key))
                      .map((field) => fieldValueText(record, field.key).replace(/\s*\n\s*/g, "; "))
                      .filter(Boolean)
                      .join(" · ") || (record.kind === "vehicle" ? vehicleSummary(record) : "")}
                  </p>
                  <p className="muted">Last seen: {lastKnownLocation(record) || "Unknown"}</p>
                </div>
                <time>{new Date(record.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
              </article>
            ))}
            {visibleRecords.length === 0 && <div className="empty-state"><strong>No matching BOLOs</strong><span>{statusFilter.length === 0 ? "Select at least one status to see records." : canManage ? "Adjust your search or status filter, or issue a new alert." : "Adjust your search or status filter and try again."}</span></div>}
          </div>
        </section>
      </main>

      {selectedRecord && !showForm && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedId(null)}>
          <div className="modal">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{selectedRecord.boloType}</p>
                <h2>{displayName(selectedRecord)}</h2>
              </div>
              <button type="button" className="close" onClick={() => setSelectedId(null)}>×</button>
            </div>

            <div className="detail-status">
              <span className={`status ${selectedRecord.status.toLowerCase()}`}>{selectedRecord.status}</span>
              <span className="muted">Submitted by {selectedRecord.ownerName} on {new Date(selectedRecord.createdAt).toLocaleDateString()}</span>
            </div>

            <dl className="detail-grid">
              {selectedRecord.photoUrl.length > 0 && (
                <div className="full detail-photo-wrap">
                  <dt>{selectedRecord.photoUrl.length > 1 ? `Photos (${selectedRecord.photoUrl.length})` : "Photo"}</dt>
                  <dd>
                    <img
                      className="detail-photo"
                      src={selectedRecord.photoUrl[Math.min(activePhoto, selectedRecord.photoUrl.length - 1)]}
                      alt={displayName(selectedRecord)}
                    />
                    {selectedRecord.photoUrl.length > 1 && (
                      <div className="detail-photo-strip">
                        {selectedRecord.photoUrl.map((photo, index) => (
                          <button
                            type="button"
                            key={`${index}-${photo.slice(-24)}`}
                            className={index === Math.min(activePhoto, selectedRecord.photoUrl.length - 1) ? "active" : undefined}
                            aria-label={`Show photo ${index + 1}`}
                            onClick={() => setActivePhoto(index)}
                          >
                            <img src={photo} alt="" />
                          </button>
                        ))}
                      </div>
                    )}
                  </dd>
                </div>
              )}
              {detailFields
                .filter((field) => field.type !== "photo")
                .map((field) => (
                  <div key={field.key} className={field.full || field.type === "textarea" || field.type === "multiselect" ? "full" : undefined}>
                    <dt>{field.label}</dt>
                    <dd>{fieldValueText(selectedRecord, field.key) || "—"}</dd>
                  </div>
                ))}
            </dl>

            <div className="modal-actions">
              {canManage && canEdit(currentUser, selectedRecord) ? (
                <button className="primary-button" onClick={() => startEdit(selectedRecord)}>Edit BOLO</button>
              ) : (
                <span className="muted lock-note">
                  {!canManage
                    ? "Read-only in the field. Use the desktop dispatch console to issue or update BOLOs."
                    : `Only ${selectedRecord.ownerName} or an administrator can edit this record.`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && canManage && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}>
        <form className="modal" onSubmit={submit}>
          <div className="modal-heading">
            <div><p className="eyebrow">{editingId ? "Update record" : "New record"}</p><h2>{editingId ? "Edit BOLO" : "Create a BOLO"}</h2></div>
            <button type="button" className="close" onClick={() => setShowForm(false)}>×</button>
          </div>
          <div className="form-grid">
            <label>Record type<select value={form.kind} disabled={Boolean(editingId)} onChange={(event) => changeKind(event.target.value as RecordKind)}><option value="person">Person</option><option value="vehicle">Vehicle</option></select></label>
            {editingId && (
              <label>Status<select value={formStatus} onChange={(event) => setFormStatus(event.target.value as BoloStatus)}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            )}
            {formFields.map((field) => (
              <FieldInput
                key={field.key}
                // The BOLO type choices depend on the record kind, so they are
                // resolved here rather than baked into the stored config.
                field={field.key === "boloType"
                  ? { ...field, options: boloTypeOptions(form.kind, form.boloType) }
                  : field}
                form={form}
                onChange={setFieldValue}
                onPhoto={selectPhoto}
              />
            ))}
          </div>
          <div className="modal-actions">
            {saveError && <span className="save-error">{saveError}</span>}
            <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="primary-button" disabled={isSaving}>{isSaving ? "Saving..." : editingId ? "Save changes" : "Create BOLO"}</button>
          </div>
        </form>
      </div>}
      {showAdmin && isAdmin && (
        <FieldAdmin config={config} onRefresh={refreshConfig} onSave={saveConfig} onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
}

export default App;
