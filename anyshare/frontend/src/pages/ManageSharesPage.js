import React, { useEffect, useState, useCallback } from "react";
import { listMyShares, revokeShare } from "../utils/api";
import { formatDate } from "../utils/fileUtils";

export default function ManageSharesPage() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState({});

  const load = useCallback(async () => {
    try {
      const res = await listMyShares();
      setShares(res.data.shares);
    } catch {
      setError("Failed to load shares");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (share) => {
    const key = `${share.fileId}:${share.granteeId}`;
    if (!window.confirm(`Revoke ${share.granteeName}'s access to "${share.fileName}"?`)) return;
    setRevoking((r) => ({ ...r, [key]: true }));
    try {
      await revokeShare(share.fileId, share.granteeId);
      setShares((s) => s.filter((x) => !(x.fileId === share.fileId && x.granteeId === share.granteeId)));
    } catch {
      alert("Failed to revoke access");
    } finally {
      setRevoking((r) => ({ ...r, [key]: false }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Manage Shares</h1>
        <p className="page-subtitle">See and revoke all PIN-based shares you've granted</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div>
        ) : shares.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔗</div>
            <div className="empty-title">No active shares</div>
            <div className="empty-desc">Use the Share button on any file to grant access with a PIN.</div>
          </div>
        ) : (
          <table className="file-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Shared with</th>
                <th>PIN</th>
                <th>Granted on</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((share) => {
                const key = `${share.fileId}:${share.granteeId}`;
                return (
                  <tr key={key}>
                    <td>
                      <div className="file-name">{share.fileName}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{share.granteeName}</div>
                      <div className="text-muted text-xs">{share.granteeEmail}</div>
                    </td>
                    <td>
                      <div className="pin-display" style={{ justifyContent: "flex-start", margin: 0, gap: 4 }}>
                        {share.pin.split("").map((d, i) => (
                          <div key={i} className="pin-digit" style={{ width: 28, height: 36, fontSize: 16 }}>{d}</div>
                        ))}
                      </div>
                    </td>
                    <td className="text-muted text-sm">{formatDate(share.grantedAt)}</td>
                    <td>
                      <div className="actions-row">
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRevoke(share)}
                          disabled={revoking[key]}>
                          {revoking[key] ? "…" : "🚫 Revoke"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
