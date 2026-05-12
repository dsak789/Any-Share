import React, { useState, useEffect, useCallback } from "react";
import { getSystemInfo } from "../api";
import "./SystemInfo.css";

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (b == null) return "—";
  if (b < 1024)        return `${b} B`;
  if (b < 1024 ** 2)   return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3)   return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function platformLabel(p) {
  return { win32: "Windows", linux: "Linux", darwin: "macOS" }[p] || p;
}

// ── subcomponent: a stat row ──────────────────────────────────────────────────
function Row({ label, value, accent }) {
  return (
    <div className="si-row">
      <span className="si-label">{label}</span>
      <span className={`si-value ${accent ? "si-accent" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

// ── subcomponent: meter bar ───────────────────────────────────────────────────
function Meter({ pct, warn = 80 }) {
  const danger = pct >= warn;
  return (
    <div className="si-meter">
      <div
        className={`si-meter-fill ${danger ? "si-meter-warn" : ""}`}
        style={{ width: `${pct}%` }}
      />
      <span className="si-meter-label">{pct}%</span>
    </div>
  );
}

// ── subcomponent: card wrapper ────────────────────────────────────────────────
function Card({ title, icon, children }) {
  return (
    <div className="si-card">
      <div className="si-card-head">
        <span className="si-card-icon">{icon}</span>
        <span className="si-card-title">{title}</span>
      </div>
      <div className="si-card-body">{children}</div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function SystemInfo() {
  const [info,    setInfo]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getSystemInfo();
      setInfo(data);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load system info.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return (
    <div className="si-loading">
      <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
    </div>
  );

  if (error) return <p className="si-error">{error}</p>;
  if (!info)  return null;

  const { os: osInfo, cpu, memory, storage, network, node, pid } = info;

  return (
    <div className="si-grid">

      {/* OS */}
      <Card title="Operating System" icon="💻">
        <Row label="Platform"  value={platformLabel(osInfo.platform)} accent />
        <Row label="OS Type"   value={osInfo.type} />
        <Row label="Release"   value={osInfo.release} />
        <Row label="Arch"      value={osInfo.arch} />
        <Row label="Hostname"  value={osInfo.hostname} />
        <Row label="Uptime"    value={fmtUptime(osInfo.uptime)} />
      </Card>

      {/* CPU */}
      <Card title="CPU" icon="⚙️">
        <Row label="Model"  value={cpu.model} />
        <Row label="Cores"  value={cpu.cores} accent />
        <Row label="Speed"  value={`${cpu.speedMHz} MHz`} />
        <Row label="Node.js" value={node} />
        <Row label="PID"    value={pid} />
      </Card>

      {/* Memory */}
      <Card title="Memory" icon="🧠">
        <Row label="Total"  value={fmtBytes(memory.totalBytes)} />
        <Row label="Used"   value={fmtBytes(memory.usedBytes)} accent />
        <Row label="Free"   value={fmtBytes(memory.freeBytes)} />
        <div className="si-meter-wrap">
          <Meter pct={memory.usedPercent} warn={85} />
        </div>
      </Card>

      {/* Storage (uploads) */}
      <Card title="Vault Storage" icon="🗄">
        <Row label="Files stored"  value={storage.fileCount} accent />
        <Row label="Upload folder" value={fmtBytes(storage.uploadDirBytes)} />
      </Card>

      {/* Network */}
      <Card title="Network" icon="🌐">
        {network.interfaces.length === 0
          ? <p className="si-empty">No external interfaces found.</p>
          : network.interfaces.map((iface, i) => (
              <Row key={i} label={iface.name} value={iface.address} />
            ))
        }
      </Card>

      {/* Refresh */}
      <div className="si-refresh-row">
        <button className="si-refresh-btn" onClick={fetch}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

    </div>
  );
}
