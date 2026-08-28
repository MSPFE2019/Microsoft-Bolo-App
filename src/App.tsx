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

import { activeService as boloService, fallbackUser, resolveActiveUser } from "./services/activeService";
import {
  AGE_OPTIONS,
  EYE_COLOR_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HEIGHT_OPTIONS,
  RACE_OPTIONS,
  STATE_OPTIONS,
  boloTypeOptions,
  STATUS_OPTIONS,
  DEFAULT_STATUSES,
  VEHICLE_COLOR_OPTIONS,
  VEHICLE_MAKE_OPTIONS,
  VEHICLE_YEAR_OPTIONS,
  canEdit,
  displayName,
  lastKnownLocation,
  vehicleSummary,
} from "./types";
import type { BoloRecord, BoloStatus, NewBoloRecord, RecordKind } from "./types";
import { fileToStoredPhoto } from "./photo";

const emptyForm: NewBoloRecord = {
  kind: "person",
  boloType: "Missing Person",
  caseNumber: "",
  details: "",
  firstName: "",
  middleName: "",
  lastName: "",
  aka: "",
  age: "",
  race: [],
  height: "",
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
  photoUrl: "",
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewBoloRecord>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formStatus, setFormStatus] = useState<BoloStatus>("Open");
  const [statusFilter, setStatusFilter] = useState<BoloStatus[]>(DEFAULT_STATUSES);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(fallbackUser);
  const [loadError, setLoadError] = useState("");
  const isMobile = useIsMobile();
  const now = useNow();
  const canManage = !isMobile;

  useEffect(() => {
    void resolveActiveUser().then(setCurrentUser);
  }, []);

  useEffect(() => {
    void boloService
      .list()
      .then(setRecords)
      .catch((error: unknown) => setLoadError(String(error)));
  }, []);

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
      return [
        displayName(record),
        record.aka,
        record.caseNumber,
        record.boloType,
        lastKnownLocation(record),
        record.age,
        record.height,
        record.hairColor,
        record.eyeColor,
        record.vehicleColor,
        record.plateNumber,
        record.plateState,
        ...record.race,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [kind, query, records, statusFilter]);

  const selectedRecord = records.find((record) => record.id === selectedId) ?? null;
  const openCount = records.filter((record) => record.status === "Open").length;

  function changeKind(nextKind: RecordKind) {
    setKind(nextKind);
    setForm((current) => ({
      ...current,
      kind: nextKind,
      boloType: boloTypeOptions(nextKind)[0],
    }));
  }

  function toggleRace(option: string) {
    setForm((current) => ({
      ...current,
      race: current.race.includes(option)
        ? current.race.filter((value) => value !== option)
        : [...current.race, option],
    }));
  }

  async function selectPhoto(file: File | undefined) {
    if (!file) return;
    setSaveError(null);
    try {
      setForm((current) => ({ ...current, photoUrl: "" }));
      const photoUrl = await fileToStoredPhoto(file);
      setForm((current) => ({ ...current, photoUrl }));
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
        <div className="brand"><span className="brand-mark">B</span><span>BOLO App</span></div>
        <div className="topbar-right">
          <span className="environment">{currentUser.name} · {currentUser.role === "admin" ? "Administrator" : "Officer"} · {canManage ? "Dispatch console" : "Field lookup"}</span>
          <div className="clock">
            <time dateTime={now.toISOString()}>
              {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
          {canManage && <button className="primary-button" onClick={startCreate}>＋ New BOLO</button>}
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
              <article className="record-card" key={record.id} onClick={() => setSelectedId(record.id)} role="button" tabIndex={0}
                onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setSelectedId(record.id)}>
                {record.photoUrl
                  ? <img className="record-photo" src={record.photoUrl} alt={displayName(record)} />
                  : <div className={`record-icon ${record.kind}`}>{record.kind === "person" ? "♙" : "▱"}</div>}
                <div className="record-main">
                  <div className="record-heading"><h2>{displayName(record)}</h2><span className={`status ${record.status.toLowerCase()}`}>{record.status}</span></div>
                  <p>{record.boloType}{record.caseNumber && <> <span className="dot">·</span> {record.caseNumber}</>}</p>
                  <p className="muted">
                    {record.kind === "person"
                      ? [record.age, record.height, record.race.join(", ")].filter(Boolean).join(" · ")
                      : vehicleSummary(record)}
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
              {selectedRecord.photoUrl && (
                <div className="full detail-photo-wrap">
                  <dt>Photo</dt>
                  <dd><img className="detail-photo" src={selectedRecord.photoUrl} alt={displayName(selectedRecord)} /></dd>
                </div>
              )}
              {selectedRecord.kind === "person" ? (
                <>
                  <div><dt>First name</dt><dd>{selectedRecord.firstName || "—"}</dd></div>
                  <div><dt>Middle name</dt><dd>{selectedRecord.middleName || "—"}</dd></div>
                  <div><dt>Last name</dt><dd>{selectedRecord.lastName || "—"}</dd></div>
                  <div><dt>AKA</dt><dd>{selectedRecord.aka || "—"}</dd></div>
                  <div><dt>Age range</dt><dd>{selectedRecord.age || "—"}</dd></div>
                  <div><dt>Height</dt><dd>{selectedRecord.height || "—"}</dd></div>
                  <div><dt>Hair color</dt><dd>{selectedRecord.hairColor || "—"}</dd></div>
                  <div><dt>Eye color</dt><dd>{selectedRecord.eyeColor || "—"}</dd></div>
                  <div className="full"><dt>Race</dt><dd>{selectedRecord.race.length ? selectedRecord.race.join(", ") : "—"}</dd></div>
                </>
              ) : (
                <>
                  <div><dt>Year</dt><dd>{selectedRecord.vehicleYear || "—"}</dd></div>
                  <div><dt>Make</dt><dd>{selectedRecord.vehicleMake || "—"}</dd></div>
                  <div><dt>Model</dt><dd>{selectedRecord.vehicleModel || "—"}</dd></div>
                  <div><dt>Color</dt><dd>{selectedRecord.vehicleColor || "—"}</dd></div>
                  <div><dt>Plate number</dt><dd>{selectedRecord.plateNumber || "—"}</dd></div>
                  <div><dt>Plate issuing state</dt><dd>{selectedRecord.plateState || "—"}</dd></div>
                </>
              )}
              <div><dt>City</dt><dd>{selectedRecord.city || "—"}</dd></div>
              <div><dt>State</dt><dd>{selectedRecord.state || "—"}</dd></div>
              <div><dt>Case number</dt><dd>{selectedRecord.caseNumber || "Not provided"}</dd></div>
              <div className="full"><dt>Case details</dt><dd>{selectedRecord.details || "—"}</dd></div>
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
            <label>BOLO type<select value={form.boloType} onChange={(event) => setForm({ ...form, boloType: event.target.value })}>{boloTypeOptions(form.kind, form.boloType).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>

            {form.kind === "person" ? <>
              <label>First name<input required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="First name" /></label>
              <label>Middle name<input value={form.middleName} onChange={(event) => setForm({ ...form, middleName: event.target.value })} placeholder="Middle name (optional)" /></label>
              <label>Last name<input required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder="Last name" /></label>
              <label>AKA<input value={form.aka} onChange={(event) => setForm({ ...form, aka: event.target.value })} placeholder="Alias or nickname" /></label>
              <label>Age range<select value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })}><option value="">Select an age range</option>{AGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label>Height<select value={form.height} onChange={(event) => setForm({ ...form, height: event.target.value })}><option value="">Select a height range</option>{HEIGHT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label>Hair color<select value={form.hairColor} onChange={(event) => setForm({ ...form, hairColor: event.target.value })}><option value="">Select a hair color</option>{HAIR_COLOR_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label>Eye color<select value={form.eyeColor} onChange={(event) => setForm({ ...form, eyeColor: event.target.value })}><option value="">Select an eye color</option>{EYE_COLOR_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <fieldset className="full checkbox-group">
                <legend>Race <span className="hint">Select all that apply</span></legend>
                <div className="checkbox-grid">
                  {RACE_OPTIONS.map((option) => (
                    <label className="checkbox" key={option}>
                      <input type="checkbox" checked={form.race.includes(option)} onChange={() => toggleRace(option)} />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </> : <>
              <label>Year<select required value={form.vehicleYear} onChange={(event) => setForm({ ...form, vehicleYear: event.target.value })}><option value="">Select a year</option>{VEHICLE_YEAR_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label>Make<select required value={form.vehicleMake} onChange={(event) => setForm({ ...form, vehicleMake: event.target.value })}><option value="">Select a make</option>{VEHICLE_MAKE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label>Model<input required value={form.vehicleModel} onChange={(event) => setForm({ ...form, vehicleModel: event.target.value })} placeholder="e.g. Explorer" /></label>
              <label>Color<select value={form.vehicleColor} onChange={(event) => setForm({ ...form, vehicleColor: event.target.value })}><option value="">Select a color</option>{VEHICLE_COLOR_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label>Plate number<input value={form.plateNumber} onChange={(event) => setForm({ ...form, plateNumber: event.target.value.toUpperCase() })} placeholder="e.g. ABC1234" /></label>
              <label>Plate issuing state<select value={form.plateState} onChange={(event) => setForm({ ...form, plateState: event.target.value })}><option value="">Select a state</option>{STATE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            </>}

            <label>City<input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="City" /></label>
            <label>State<select required value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })}><option value="">Select a state</option>{STATE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label>Case number <span className="hint">Optional</span><input value={form.caseNumber} onChange={(event) => setForm({ ...form, caseNumber: event.target.value })} placeholder="e.g. MP-2025-1042" /></label>
            <label className="full">Photo <span className="hint">Optional</span>
              <div className="photo-field">
                {form.photoUrl
                  ? <img className="photo-preview" src={form.photoUrl} alt="Selected BOLO" />
                  : <div className="photo-placeholder">No photo</div>}
                <div className="photo-actions">
                  <input type="file" accept="image/*" onChange={(event) => selectPhoto(event.target.files?.[0])} />
                  {form.photoUrl && <button type="button" className="secondary-button" onClick={() => setForm({ ...form, photoUrl: "" })}>Remove photo</button>}
                </div>
              </div>
            </label>
            <label className="full">Case details<textarea required rows={4} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="Add details your team should know." /></label>
          </div>
          <div className="modal-actions">
            {saveError && <span className="save-error">{saveError}</span>}
            <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="primary-button" disabled={isSaving}>{isSaving ? "Saving..." : editingId ? "Save changes" : "Create BOLO"}</button>
          </div>
        </form>
      </div>}
    </div>
  );
}

export default App;
