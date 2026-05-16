import React, { useEffect, useState, useCallback } from "react";
import { listSharedFiles, downloadFile } from "../utils/api";
import { formatBytes, formatDate, fileIcon, triggerDownload } from "../utils/fileUtils";

export default function SharedPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState({});

  const load = useCallback(async () => {
    try {
      const res = await listSharedFiles();
      setFiles(res.data.files);
    } catch {
      setError("Failed to load shared files");
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Shared With Me</h1>
        <p className="page-subtitle">Files others have granted you access to</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤝</div>
            <div className="empty-title">No shared files</div>
            <div className="empty-desc">Use a PIN to unlock access to files shared with you.</div>
          </div>
        ) : (
          <table className="file-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Shared by</th>
                <th>Shared on</th>
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
                  <td className="text-muted text-sm">{file.ownerName}</td>
                  <td className="text-muted text-sm">{formatDate(file.shareGrantedAt)}</td>
                  <td>
                    <div className="actions-row">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleDownload(file)}
                        disabled={downloading[file.fileId]}>
                        {downloading[file.fileId] ? "…" : "⬇️ Download"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
