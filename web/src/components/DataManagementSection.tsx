import { useId, useRef, useState } from "react";
import { EXPENSE_HORIZON_AGE } from "../calc";
import { useAppData } from "../state/AppDataContext";
import { withdrawalRateFromSettings } from "../state/withdrawalRate";
import { buildExportPayload, downloadJson, validateImportPayload, type ExportPayload } from "../storage/importExport";

const today = () => new Date().toISOString().slice(0, 10);

/** Data Management: export the whole household to a JSON file, import one
 * back (replacing current data, after a preview + confirm), and a
 * confirm-gated Clear All. Rendered inside a Modal (see App.tsx) rather
 * than as a permanent on-page section, so it stays out of the way until
 * actually needed — the modal supplies its own title/close chrome. */
export function DataManagementSection() {
  const uid = useId();
  const id = (suffix: string) => `${uid}-${suffix}`;
  const {
    people,
    expenses,
    currentAge,
    setCurrentAge,
    withdrawalRate,
    setWithdrawalRate,
    replacePeople,
    clearPeople,
    replaceExpenses,
    clearExpenses,
  } = useAppData();

  const [fileName, setFileName] = useState(`investment-scenarios-${today()}.json`);

  const [importPayload, setImportPayload] = useState<ExportPayload | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmClear, setConfirmClear] = useState(false);

  function handleSave() {
    const name = fileName.trim() || `investment-scenarios-${today()}.json`;
    downloadJson(buildExportPayload(people, expenses, currentAge, withdrawalRate), name.toLowerCase().endsWith(".json") ? name : `${name}.json`);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setImportPayload(null);
    setImportError(null);
    setImportedFileName(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch {
        setImportError("This isn't a valid JSON file. Please upload a scenario file previously saved from this app.");
        return;
      }
      const validationError = validateImportPayload(parsed);
      if (validationError) {
        setImportError(validationError);
        return;
      }
      setImportPayload(parsed as ExportPayload);
      setImportedFileName(file.name);
    };
    reader.readAsText(file);
  }

  function handleLoadImport() {
    if (!importPayload) return;
    replacePeople(importPayload.people);
    replaceExpenses(importPayload.expenses);
    if (importPayload.settings?.currentAge != null) {
      setCurrentAge(Math.max(1, Math.min(EXPENSE_HORIZON_AGE - 1, importPayload.settings.currentAge)));
    }
    const importedRate = importPayload.settings && withdrawalRateFromSettings(importPayload.settings);
    if (importedRate) setWithdrawalRate(importedRate);
    setImportPayload(null);
    setImportError(null);
    setImportedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClearConfirmed() {
    clearPeople();
    clearExpenses();
    setConfirmClear(false);
  }

  return (
    <div>
      <p className="caption" style={{ marginTop: 0, marginBottom: "1rem" }}>
        Save your household to a file, load a prior file, or start over.
      </p>

      <div className="field-row">
        <div className="card">
          <h4 style={{ margin: "0 0 0.6rem" }}>Save Scenarios</h4>
          <div className="field">
            <label htmlFor={id("filename")}>File name</label>
            <input id={id("filename")} type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </div>
          <button type="button" className="primary" onClick={handleSave}>
            Save Scenarios
          </button>
          <p className="caption" style={{ marginTop: "0.5rem" }}>
            Downloads all people, scenarios, and expenses as a JSON file.
          </p>
        </div>

        <div className="card">
          <h4 style={{ margin: "0 0 0.6rem" }}>Load Prior Scenarios</h4>
          <div className="field">
            <label htmlFor={id("upload")}>Upload a scenario file</label>
            <input id={id("upload")} ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileSelected} />
          </div>
          {importError && <p className="error-text">{importError}</p>}
          {importPayload && (
            <>
              <p className="success-text">
                Found {importPayload.people.length} people and {importPayload.expenses.length} expenses in{" "}
                {importedFileName}.
              </p>
              <button type="button" className="primary" onClick={handleLoadImport}>
                Load This File (replaces current data)
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h4 style={{ margin: "0 0 0.6rem" }}>Clear All Inputs</h4>
        {confirmClear ? (
          <>
            <p className="error-text">This will permanently delete all people, scenarios, and expenses. Are you sure?</p>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button type="button" className="danger" onClick={handleClearConfirmed}>
                Yes, clear
              </button>
              <button type="button" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="danger" onClick={() => setConfirmClear(true)}>
            Clear All Inputs
          </button>
        )}
      </div>
    </div>
  );
}
