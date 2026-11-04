import { useRef, useState } from "react";
import { exportProgress } from "../progress";
import { applyProgressImport, parseProgress, type ImportMode, type ProgressExport } from "../progressTransfer";

export function ProgressTransfer({ onImport }: { onImport: () => void }) {
  const [pending, setPending] = useState<{ json: string; data: ProgressExport } | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [backupSaved, setBackupSaved] = useState(false);
  const selection = useRef(0);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const download = () => {
    const ok = exportProgress();
    setBackupSaved(false);
    setBackupDownloaded(ok);
    setMessage(ok
      ? "Backup download started. Check that the file is saved before confirming an import."
      : "Could not export progress. Nothing was changed. Do not import until you have a backup.");
  };
  const selectFile = async (file: File | undefined) => {
    const request = ++selection.current;
    setPending(null);
    setBackupDownloaded(false);
    setBackupSaved(false);
    setReplaceConfirmed(false);
    setMode("merge");
    setMessage(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setMessage("This file is larger than 10 MB. Choose a Pianio progress export.");
      return;
    }
    try {
      const json = await file.text();
      if (request !== selection.current) return;
      const result = parseProgress(json);
      if (result.ok) setPending({ json, data: result.value });
      else setMessage(result.message);
    } catch {
      if (request === selection.current) setMessage("Could not read that file. Nothing was changed.");
    }
  };
  const confirm = () => {
    if (!pending || !backupSaved || (mode === "replace" && !replaceConfirmed)) return;
    const result = applyProgressImport(pending.json, mode, localStorage);
    setMessage(result.message);
    if (result.ok) {
      setPending(null);
      onImport();
    }
  };

  return (
    <section className="progress-header" aria-labelledby="progress-transfer-title">
      <h2 id="progress-transfer-title">Back up or import progress</h2>
      <p>Exports stay on your device. Importing merges by default, keeping completed exercises, best stars, and practice dates from both copies.</p>
      <div className="progress-actions">
        <button className="action-link secondary" type="button" onClick={download}>Export backup</button>
        <label className="action-link secondary">
          Choose import file
          <input type="file" accept="application/json,.json" onChange={e => {
            void selectFile(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }} />
        </label>
      </div>
      {pending && (
        <div role="region" aria-label="Import preview">
          <h3>Import preview</h3>
          <p>Exported {new Date(pending.data.exportedAt).toLocaleString()}. Contains {pending.data.completed.length} completed exercises, {Object.keys(pending.data.stars).length} star ratings, and {pending.data.streakDates.length} practice dates.</p>
          <label>Import mode {" "}
            <select value={mode} onChange={e => {
              setMode(e.currentTarget.value as ImportMode);
              setReplaceConfirmed(false);
            }}>
              <option value="merge">Merge and keep best progress</option>
              <option value="replace">Replace existing progress</option>
            </select>
          </label>
          {mode === "replace" && (
            <p><label><input type="checkbox" checked={replaceConfirmed} onChange={e => setReplaceConfirmed(e.currentTarget.checked)} /> I understand that replacement removes progress not included in this file.</label></p>
          )}
          <p>Before importing, use Export backup above and verify that the download was saved. A separate recovery snapshot is also saved in this browser before any changes.</p>
          <p><label><input type="checkbox" disabled={!backupDownloaded} checked={backupSaved} onChange={e => setBackupSaved(e.currentTarget.checked)} /> I have saved the backup file.</label></p>
          <div className="progress-actions">
            <button type="button" className="action-link primary" disabled={!backupSaved || (mode === "replace" && !replaceConfirmed)} onClick={confirm}>Confirm import</button>
            <button type="button" className="action-link secondary" onClick={() => setPending(null)}>Cancel import</button>
          </div>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
