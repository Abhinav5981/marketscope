import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useUploadPortfolio } from "../api/hooks";

export function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const upload = useUploadPortfolio();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    upload.mutate(file);
  }

  const columnErrors =
    upload.error instanceof ApiError && Array.isArray((upload.error.details as any)?.columnErrors)
      ? ((upload.error.details as any).columnErrors as { column: string; message: string }[])
      : [];

  return (
    <div>
      <h1 className="page-title">Step 1 · Upload your portfolio</h1>
      <p className="page-subtitle">
        Upload a CSV or XLSX of your own stores. Required columns: <code>store_name</code>, <code>address</code>,{" "}
        <code>city</code>, <code>state</code>, <code>country</code>. Optional: <code>category</code>,{" "}
        <code>latitude</code>, <code>longitude</code>.
      </p>

      <div className="card">
        <div className="form-row">
          <label htmlFor="portfolio-file">Portfolio file (.csv or .xlsx)</label>
          <input
            ref={fileInputRef}
            id="portfolio-file"
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileChange}
          />
        </div>

        {upload.isPending && (
          <div className="alert alert-warning">
            <span className="spinner" /> Validating {selectedFileName}…
          </div>
        )}

        {upload.isError && (
          <div className="alert alert-danger">
            <strong>{upload.error instanceof ApiError ? upload.error.message : "Upload failed."}</strong>
            {columnErrors.length > 0 && (
              <ul style={{ marginTop: "0.5rem", marginBottom: 0 }}>
                {columnErrors.map((e) => (
                  <li key={e.column}>{e.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {upload.isSuccess && (
          <div>
            <div className="alert alert-success">
              Accepted {upload.data.insertedCount} row{upload.data.insertedCount === 1 ? "" : "s"}
              {upload.data.rejectedCount > 0 && `, rejected ${upload.data.rejectedCount}`} from{" "}
              {selectedFileName}.
            </div>

            {upload.data.rowWarnings.length > 0 && (
              <div className="alert alert-warning">
                {upload.data.rowWarnings.map((w, i) => (
                  <div key={i}>{w.message}</div>
                ))}
              </div>
            )}

            {upload.data.rowErrors.length > 0 && (
              <div className="card" style={{ boxShadow: "none" }}>
                <h2>Rows skipped ({upload.data.rowErrors.length})</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Column</th>
                      <th>Value</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upload.data.rowErrors.map((e, i) => (
                      <tr key={i}>
                        <td>{e.row}</td>
                        <td>{e.column}</td>
                        <td>{String(e.value ?? "")}</td>
                        <td>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <button className="btn btn-primary" disabled={!upload.isSuccess} onClick={() => navigate("/markets/new")}>
        Continue to Market Setup →
      </button>
    </div>
  );
}
