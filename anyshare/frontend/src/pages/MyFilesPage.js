import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { listMyFiles, downloadFile, deleteFile } from "../utils/api";
import { formatBytes, formatDate, fileIcon, triggerDownload } from "../utils/fileUtils";
import ShareModal from "../components/ShareModal";

export default function MyFilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState({});
  const [deleting, setDeleting] = useState({});
  const [shareTarget, setShareTarget] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await listMyFiles();
      setFiles(res.data.files);
    } catch {
      setError("Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (file) => {
    setDownloading((d) => ({ ...d, [file.fileId]: true }));
    try {
      const res = await downloadFile(file.fileId);
      triggerDownload(res.data, file.originalName);
    } catch {
      alert("Download failed");
    } finally {
      setDownloading((d) => ({ ...d, [file.fileId]: false }));
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.originalName}"? This cannot be undone.`)) return;
    setDeleting((d) => ({ ...d, [file.fileId]: true }));
    try {
      await deleteFile(file.fileId);
      setFiles((f) => f.filter((x) => x.fileId !== file.fileId));
    } catch {
      alert("Delete failed");
    } finally {
      setDeleting((d) => ({ ...d, [file.fileId]: false }));
    }
  };

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">My Files</h1>
          <p className="page-subtitle">{files.length} file{files.length !== 1 ? "s" : ""} in your vault</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/upload")}>
          ⬆️ Upload file
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <div className="empty-title">Loading…</div>
          </div>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No files yet</div>
            <div className="empty-desc">Upload your first file to get started.</div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/upload")}>
              Upload now
            </button>
          </div>
        ) : (
          <table className="file-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Storage</th>
                <th>Uploaded</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.fileId}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="file-icon">{fileIcon(file.mimeType, file.originalName)}</span>
                      <span className="file-name">{file.originalName}</span>
                    </div>
                  </td>
                  <td><span className="file-size">{formatBytes(file.size)}</span></td>
                  <td>
                    <span className={`storage-badge ${file.storageType === "disk" ? "badge-disk" : "badge-inline"}`}>
                      {file.storageType === "disk" ? "💾 Disk" : "☁️ DB"}
                    </span>
                  </td>
                  <td className="text-muted text-sm">{formatDate(file.uploadedAt)}</td>
                  <td>
                    <div className="actions-row">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDownload(file)}
                        disabled={downloading[file.fileId]}>
                        {downloading[file.fileId] ? "…" : "⬇️ Download"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShareTarget(file)}>
                        🔗 Share
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(file)}
                        disabled={deleting[file.fileId]}>
                        {deleting[file.fileId] ? "…" : "🗑️"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {shareTarget && (
        <ShareModal file={shareTarget} onClose={() => setShareTarget(null)} />
      )}
    </div>
  );
}
