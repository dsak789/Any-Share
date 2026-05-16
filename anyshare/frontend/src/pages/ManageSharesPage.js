import React, { useEffect, useState, useCallback } from "react";
import { listMyShares, revokeEmailShare, listMyLinks, deleteLinkShare } from "../utils/api";
import { formatDate } from "../utils/fileUtils";

export default function ManageSharesPage() {
  const [tab, setTab] = useState("email");
  const [emailShares, setEmailShares] = useState([]);
  const [linkShares, setLinkShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [esRes, lsRes] = await Promise.all([listMyShares(), listMyLinks()]);
      setEmailShares(esRes.data.shares || []);
      setLinkShares(lsRes.data.links || []);
    } catch {
      setError("Failed to load shares");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (share) => {
    const key = `e-${share.fileId}-${share.granteeId}`;
    if (!window.confirm(`Revoke ${share.granteeName}'s access to "${share.fileName}"?`)) return;
    setActing((a) => ({ ...a, [key]: true }));
    try {
      await revokeEmailShare(share.fileId, share.granteeId);
      setEmailShares((s) => s.filter((x) => !(x.fileId === share.fileId && x.granteeId === share.granteeId)));
    } catch { alert("Failed to revoke"); }
    finally { setActing((a) => ({ ...a, [key]: false })); }
  };

  const handleDeleteLink = async (link) => {
    const key = `l-${link.linkId}`;
    if (!window.confirm(`Delete link for "${link.fileName}"?`)) return;
    setActing((a) => ({ ...a, [key]: true }));
    try {
      await deleteLinkShare(link.linkId);
      setLinkShares((s) => s.filter((x) => x.linkId !== link.linkId));
    } catch { alert("Failed to delete link"); }
    finally { setActing((a) => ({ ...a, [key]: false })); }
  };

  const copyLink = (link) => {
    const url = `${window.location.origin}/share/${link.linkId}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Manage Shares</h1>
        <p className="page-subtitle">All access you've granted to your files</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface)", padding: 4, borderRadius: "var(--radius-sm)", marginBottom: 20, border: "1px solid var(--border)", width: "fit-content" }}>
        {[
          { key: "email", label: `✉️ Email shares (${emailShares.length})` },
          { key: "link", label: `🔗 Link shares (${linkShares.length})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-ghost"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div>
        ) : tab === "email" ? (
          emailShares.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✉️</div>
              <div className="empty-title">No email shares</div>
              <div className="empty-desc">Share a file directly with a registered user via the Share button.</div>
            </div>
          ) : (
            <table className="file-table">
              <thead>
                <tr>
                  <th>File</th><th>Shared with</th><th>Granted on</th><th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {emailShares.map((share) => {
                  const key = `e-${share.fileId}-${share.granteeId}`;
                  return (
                    <tr key={key}>
                      <td><div className="file-name">{share.fileName}</div></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{share.granteeName}</div>
                        <div className="text-xs text-muted">{share.granteeEmail}</div>
                      </td>
                      <td className="text-muted text-sm">{formatDate(share.grantedAt)}</td>
                      <td>
                        <div className="actions-row">
                          <button className="btn btn-danger btn-sm" disabled={acting[key]} onClick={() => handleRevoke(share)}>
                            {acting[key] ? "…" : "🚫 Revoke"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          linkShares.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔗</div>
              <div className="empty-title">No link shares</div>
              <div className="empty-desc">Generate an anonymous link from the Share button on any file.</div>
            </div>
          ) : (
            <table className="file-table">
              <thead>
                <tr>
                  <th>File</th><th>PIN</th><th>Downloads</th><th>Expires</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {linkShares.map((link) => {
                  const key = `l-${link.linkId}`;
                  return (
                    <tr key={link.linkId}>
                      <td><div className="file-name">{link.fileName}</div></td>
                      <td><span className="font-mono text-sm text-accent">{link.pin}</span></td>
                      <td className="text-sm text-muted">
                        {link.downloadCount}{link.maxDownloads ? `/${link.maxDownloads}` : ""}
                      </td>
                      <td className="text-sm text-muted">
                        {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : "Never"}
                      </td>
                      <td>
                        <span style={{
                          padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: link.expired ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)",
                          color: link.expired ? "var(--red)" : "var(--green)",
                        }}>
                          {link.expired ? "Expired" : "Active"}
                        </span>
                      </td>
                      <td>
                        <div className="actions-row">
                          <button className="btn btn-ghost btn-sm" onClick={() => copyLink(link)}>📋 Copy link</button>
                          <button className="btn btn-danger btn-sm" disabled={acting[key]} onClick={() => handleDeleteLink(link)}>
                            {acting[key] ? "…" : "🗑️ Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
