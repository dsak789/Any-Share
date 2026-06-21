import React, { useState, useEffect, useCallback } from "react";
import { getSystemInfo } from "../utils/api";

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (b == null || b === 0) return "0 B";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
  return (b / 1073741824).toFixed(2) + " GB";
}
function fmtUptime(sec) {
  if (!sec) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (d) parts.push(d + "d");
  if (h) parts.push(h + "h");
  parts.push(m + "m");
  if (!d && !h) parts.push(s + "s");
  return parts.join(" ");
}
function fmtMs(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return ms + " ms";
  return (ms / 1000).toFixed(1) + " s";
}
function fmtPlatform(p) {
  return { win32: "Windows", linux: "Linux", darwin: "macOS" }[p] || p;
}

// ── Keyframe injection (once) ────────────────────────────────────────────────
let _kfDone = false;
function injectKF() {
  if (_kfDone) return;
  _kfDone = true;
  const el = document.createElement("style");
  el.textContent =
    "@keyframes si-pulse{0%,80%,100%{opacity:.15;transform:scale(.75)}40%{opacity:1;transform:scale(1)}}" +
    "@keyframes si-bar{from{width:0}}";
  document.head.appendChild(el);
}

// ── Design token shortcuts ───────────────────────────────────────────────────
const mono = "'JetBrains Mono', monospace";
const C = {
  surface: "var(--surface)",
  surface2: "var(--surface2)",
  surface3: "var(--surface3)",
  border: "var(--border)",
  accent: "var(--accent)",
  accent2: "var(--accent2)",
  green: "var(--green)",
  red: "var(--red)",
  yellow: "var(--yellow)",
  text: "var(--text)",
  text2: "var(--text2)",
  text3: "var(--text3)",
  radius: "var(--radius)",
  radiusSm: "var(--radius-sm)",
};

// ── Primitives ─────────────────────────────────────────────────────────────────
function Card({ title, icon, children, glow, span2 }) {
  return (
    <div
      style={{
        background: C.surface,
        border: "1px solid " + (glow ? "rgba(108,99,255,0.35)" : C.border),
        borderRadius: C.radius,
        overflow: "hidden",
        boxShadow: glow ? "0 0 28px rgba(108,99,255,0.07)" : "none",
        gridColumn: span2 ? "span 2" : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          background: C.surface2,
          borderBottom: "1px solid " + C.border,
        }}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span
          style={{
            fontFamily: mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: C.text2,
          }}
        >
          {title}
        </span>
      </div>
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 9,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, color, mono: useMono = true }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 8,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontFamily: mono,
          fontSize: 11,
          color: C.text3,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: useMono ? mono : "inherit",
          fontSize: 12,
          color: color || C.text,
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function Div() {
  return (
    <div style={{ borderTop: "1px solid " + C.border, margin: "2px 0" }} />
  );
}

function Note({ children }) {
  return (
    <span
      style={{
        fontFamily: mono,
        fontSize: 10,
        color: C.text3,
        lineHeight: 1.6,
      }}
    >
      {children}
    </span>
  );
}

function Meter({ pct, warn, barColor }) {
  const p = Math.min(pct || 0, 100);
  const c = barColor || (p >= (warn || 85) ? C.red : C.accent);
  return (
    <div style={{ marginTop: 2 }}>
      <div
        style={{
          height: 5,
          background: C.surface3,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: p + "%",
            background: c,
            borderRadius: 3,
            animation: "si-bar 0.5s ease",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <span style={{ fontFamily: mono, fontSize: 10, color: C.text3 }}>
          {p >= (warn || 85) ? (p >= 95 ? "⚠️ Critical" : "⚠️ High") : "Normal"}
        </span>
        <span
          style={{ fontFamily: mono, fontSize: 10, color: c, fontWeight: 700 }}
        >
          {p}%
        </span>
      </div>
    </div>
  );
}

function Badge({ label, value, color, sub }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "10px 6px",
        background: C.surface2,
        border: "1px solid " + C.border,
        borderRadius: C.radiusSm,
      }}
    >
      <span
        style={{
          fontFamily: mono,
          fontSize: 18,
          fontWeight: 700,
          color: color || C.accent2,
        }}
      >
        {value ?? 0}
      </span>
      <span
        style={{
          fontFamily: mono,
          fontSize: 10,
          color: C.text3,
          marginTop: 3,
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
      {sub && (
        <span
          style={{
            fontFamily: mono,
            fontSize: 9,
            color: C.text3,
            marginTop: 2,
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

function StatusDot({ ok, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: ok ? C.green : C.red,
          boxShadow: "0 0 6px " + (ok ? C.green : C.red),
        }}
      />
      <span
        style={{
          fontFamily: mono,
          fontSize: 11,
          color: ok ? C.green : C.red,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// Mini horizontal bar for file type breakdown
function TypeBar({ label, count, total, color, icon }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  if (count === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontFamily: mono,
          fontSize: 11,
          color: C.text3,
          width: 72,
          flexShrink: 0,
        }}
      >
        {icon} {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 5,
          background: C.surface3,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: pct + "%",
            background: color,
            borderRadius: 3,
            animation: "si-bar 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: mono,
          fontSize: 11,
          color: C.text2,
          width: 28,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SystemInfo() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshed, setRefreshed] = useState(null);

  injectKF();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getSystemInfo();
      setInfo(data);
      setRefreshed(new Date());
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load system info");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !info)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "64px 0",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", gap: 7 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: C.accent,
                animation:
                  "si-pulse 1.4s ease-in-out " + i * 0.2 + "s infinite",
              }}
            />
          ))}
        </div>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.text3 }}>
          Collecting server info…
        </span>
      </div>
    );

  if (error)
    return (
      <div
        style={{
          padding: 20,
          background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.2)",
          borderRadius: C.radiusSm,
        }}
      >
        <span style={{ fontFamily: mono, fontSize: 12, color: C.red }}>
          ⚠ {error}
        </span>
      </div>
    );

  if (!info) return null;

  const {
    app,
    os: o,
    cpu,
    memory,
    process: proc,
    disk,
    dynamo,
    network,
  } = info;
  const heapPct = proc
    ? Math.round((proc.heapUsedBytes / proc.heapTotalBytes) * 100)
    : 0;
  const totalFiles = dynamo?.files?.total || 0;
  const bt = dynamo?.files?.byType || {};
  const dbOk = dynamo?.status === "ok";
  const latency = dynamo?.latencyMs;
  const latencyColor = !latency
    ? C.text3
    : latency < 50
      ? C.green
      : latency < 200
        ? C.yellow
        : C.red;
  const thresholdMB = app?.storageThresholdBytes
    ? Math.round(app.storageThresholdBytes / 1048576)
    : 100;

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
         
          {refreshed && (
            <span style={{ fontFamily: mono, fontSize: 12, color: C.text2 }}>
              Updated {refreshed.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StatusDot
            ok={dbOk}
            label={dbOk ? "DynamoDB connected" : "DynamoDB error"}
          />
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "1px solid " + C.border,
              borderRadius: C.radiusSm,
              color: loading ? C.text3 : C.text2,
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "7px 14px",
              cursor: loading ? "wait" : "pointer",
              transition: "all 0.15s",
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
          gap: 14,
        }}
      >
        {/* ── 1. App Config ── */}
        <Card title="Application Config" icon="🔧">
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <Badge
              label="Environment"
              value={app?.env || "—"}
              color={app?.env === "production" ? C.green : C.yellow}
            />
            <Badge label="Port" value={app?.port} color={C.accent2} />
          </div>
          <Div />
          <Row label="AWS Region" value={app?.awsRegion} />
          <Row label="Storage limit" value={thresholdMB + " MB"} />
          <Row label="Upload dir" value={app?.uploadDir} />
          <Div />
          <Note>
            Files ≥ {thresholdMB} MB → disk. Smaller files → DynamoDB.
          </Note>
        </Card>

        {/* ── 2. OS ── */}
        <Card title="Operating System" icon="💻">
          <Row
            label="Platform"
            value={fmtPlatform(o?.platform)}
            color={C.accent2}
          />
          <Row label="OS Type" value={o?.type} />
          <Row label="Release" value={o?.release} />
          <Row label="Arch" value={o?.arch} />
          <Row label="Hostname" value={o?.hostname} />
          <Div />
          <Row label="OS Uptime" value={fmtUptime(o?.uptime)} color={C.green} />
        </Card>

        {/* ── 3. CPU ── */}
        <Card title="CPU" icon="⚙️">
          <Row label="Model" value={cpu?.model} />
          <Row label="Cores" value={cpu?.cores} color={C.accent2} />
          <Row label="Speed" value={(cpu?.speedMHz || 0) + " MHz"} />
          <Div />
          <Row
            label="Load  1 min"
            value={cpu?.loadAvg1m}
            color={cpu?.loadAvg1m > cpu?.cores ? C.red : C.text}
          />
          <Row
            label="Load  5 min"
            value={cpu?.loadAvg5m}
            color={cpu?.loadAvg5m > cpu?.cores ? C.red : C.text}
          />
          <Row
            label="Load 15 min"
            value={cpu?.loadAvg15m}
            color={cpu?.loadAvg15m > cpu?.cores ? C.red : C.text}
          />
          <Note>
            Load {">"} {cpu?.cores} cores = overloaded
          </Note>
        </Card>

        {/* ── 4. System RAM ── */}
        <Card title="System RAM" icon="🧠">
          <Row label="Total" value={fmtBytes(memory?.totalBytes)} />
          <Row
            label="Used"
            value={fmtBytes(memory?.usedBytes)}
            color={memory?.usedPercent > 85 ? C.red : C.accent2}
          />
          <Row
            label="Free"
            value={fmtBytes(memory?.freeBytes)}
            color={C.green}
          />
          <Div />
          <Meter pct={memory?.usedPercent} warn={85} />
        </Card>

        {/* ── 5. Node Process ── */}
        <Card title="Node.js Process" icon="⬡">
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <Badge label="Version" value={proc?.nodeVersion} color={C.green} />
            <Badge label="PID" value={proc?.pid} color={C.text2} />
          </div>
          <Row
            label="Process uptime"
            value={fmtUptime(proc?.uptimeSec)}
            color={C.accent2}
          />
          <Div />
          <Row
            label="Heap used"
            value={fmtBytes(proc?.heapUsedBytes)}
            color={heapPct > 80 ? C.red : C.text}
          />
          <Row label="Heap total" value={fmtBytes(proc?.heapTotalBytes)} />
          <Row label="RSS" value={fmtBytes(proc?.rssBytes)} />
          <Row label="External" value={fmtBytes(proc?.externalBytes)} />
          <Div />
          <Row label="CPU user time" value={fmtMs(proc?.cpuUserMs)} />
          <Row label="CPU system time" value={fmtMs(proc?.cpuSystemMs)} />
          <Div />
          <Note>Heap usage</Note>
          <Meter pct={heapPct} warn={80} barColor={C.yellow} />
        </Card>

        {/* ── 6. Server Disk ── */}
        <Card
          title="Server Disk Storage"
          icon="💾"
          glow={disk?.diskFileCount > 0}
        >
          <Badge
            label="Large files on disk"
            value={disk?.diskFileCount}
            color={C.yellow}
          />
          <Div />
          <Row label="Upload dir" value={disk?.uploadDir} />
          <Row
            label="Total on disk"
            value={fmtBytes(disk?.uploadDirBytes)}
            color={C.yellow}
          />
          <Div />
          <Note>
            Only files ≥ {thresholdMB} MB land here. The rest live in DynamoDB.
          </Note>
        </Card>

        {/* ── 7. DynamoDB Connection ── */}
        <Card title="DynamoDB — Connection" icon="☁️" glow={dbOk}>
          <Row
            label="Status"
            value={dbOk ? "Connected" : "Error"}
            color={dbOk ? C.green : C.red}
          />
          <Row
            label="Latency"
            value={latency != null ? latency + " ms" : "—"}
            color={latencyColor}
          />
          <Row label="Region" value={app?.awsRegion} />
          <Div />
          <Note>Table names</Note>
          <Row label="Users" value={app?.tables?.users} />
          <Row label="Files" value={app?.tables?.files} />
          <Row label="Shares" value={app?.tables?.shares} />
          <Row label="Link shares" value={app?.tables?.linkShares} />
        </Card>

        {/* ── 8. DynamoDB Files ── */}
        <Card title="DynamoDB — Files" icon="🗄️" glow>
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <Badge
              label="Total"
              value={dynamo?.files?.total}
              color={C.accent2}
            />
            <Badge
              label="Inline"
              value={dynamo?.files?.inlineCount}
              color={C.green}
            />
            <Badge
              label="Disk refs"
              value={dynamo?.files?.diskCount}
              color={C.yellow}
            />
          </div>
          <Div />
          <Row
            label="Inline size"
            value={fmtBytes(dynamo?.files?.inlineBytes)}
            color={dynamo?.files?.inlineBytes > 307200 ? C.yellow : C.text}
          />
          <Row
            label="Disk-ref total"
            value={fmtBytes(dynamo?.files?.diskBytes)}
          />
          <Row
            label="Total managed"
            value={fmtBytes(dynamo?.files?.totalManagedBytes)}
            color={C.accent2}
          />
          <Row
            label="Avg file size"
            value={fmtBytes(dynamo?.files?.avgFileSizeBytes)}
          />
          <Div />
          <Note>Base64 in DB adds ~33% overhead over inline size above</Note>
        </Card>

        {/* ── 9. File Type Breakdown ── */}
        <Card title="Files by Type" icon="📊">
          {totalFiles === 0 ? (
            <Note>No files uploaded yet.</Note>
          ) : (
            <>
              <TypeBar
                label="Images"
                count={bt.images}
                total={totalFiles}
                color={C.accent2}
                icon="🖼️"
              />
              <TypeBar
                label="Video"
                count={bt.video}
                total={totalFiles}
                color={C.red}
                icon="🎬"
              />
              <TypeBar
                label="Audio"
                count={bt.audio}
                total={totalFiles}
                color={C.yellow}
                icon="🎵"
              />
              <TypeBar
                label="Documents"
                count={bt.documents}
                total={totalFiles}
                color={C.green}
                icon="📄"
              />
              <TypeBar
                label="Archives"
                count={bt.archives}
                total={totalFiles}
                color="var(--accent)"
                icon="🗜️"
              />
              <TypeBar
                label="Text"
                count={bt.text}
                total={totalFiles}
                color={C.text2}
                icon="📝"
              />
              <TypeBar
                label="Other"
                count={bt.other}
                total={totalFiles}
                color={C.text3}
                icon="📦"
              />
              <Div />
              <Row label="Total files" value={totalFiles} color={C.accent2} />
            </>
          )}
        </Card>

        {/* ── 10. Shares & Activity ── */}
        <Card title="Shares & Activity" icon="🔗">
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <Badge
              label="Users"
              value={dynamo?.users?.total}
              color={C.accent2}
            />
            <Badge
              label="Email shares"
              value={dynamo?.emailShares?.total}
              color={C.text2}
            />
          </div>
          <Div />
          <Row label="Link shares total" value={dynamo?.linkShares?.total} />
          <div style={{ display: "flex", gap: 6, margin: "4px 0" }}>
            <Badge
              label="Active"
              value={dynamo?.linkShares?.active}
              color={C.green}
            />
            <Badge
              label="Expired"
              value={dynamo?.linkShares?.expired}
              color={C.red}
            />
          </div>
          <Div />
          <Row
            label="Total downloads"
            value={dynamo?.linkShares?.totalDownloads}
            color={C.accent2}
          />
          <Note>Downloads counted across all anonymous link shares</Note>
        </Card>

        {/* ── 11. Network ── */}
        <Card title="Network" icon="🌐">
          {!network?.interfaces?.length ? (
            <Note>No external IPv4 interfaces found.</Note>
          ) : (
            network.interfaces.map((iface, i) => (
              <Row
                key={i}
                label={iface.name}
                value={iface.address}
                color={C.accent2}
              />
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
