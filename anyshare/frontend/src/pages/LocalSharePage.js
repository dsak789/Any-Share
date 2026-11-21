import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { createSender, createReceiver } from "../utils/webrtc";
import { formatBytes, fileIcon } from "../utils/fileUtils";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_URL || "http://localhost:9999";

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtEta(sec) {
  if (sec == null || sec < 0) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "32px",
  maxWidth: 520,
  margin: "0 auto",
};

function ProgressBar({ pct }) {
  return (
    <div
      style={{
        width: "100%",
        height: 8,
        background: "var(--surface2)",
        borderRadius: 99,
        overflow: "hidden",
        margin: "12px 0",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "var(--accent)",
          borderRadius: 99,
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}

function StatsRow({ pct, stats }) {
  return (
    <>
      <ProgressBar pct={pct} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          color: "var(--text2)",
        }}
      >
        <span>{pct}%</span>
        <span>{stats.mbps > 0 ? `${stats.mbps} Mbps` : "—"}</span>
        <span>ETA {fmtEta(stats.etaSec)}</span>
      </div>
    </>
  );
}

function FileCard({ name, size, mimeType }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 16,
        background: "var(--surface2)",
        borderRadius: "var(--radius-sm)",
        marginBottom: 20,
      }}
    >
      <span style={{ fontSize: 36 }}>{fileIcon?.(mimeType, name) || "📄"}</span>
      <div>
        <div
          style={{
            fontWeight: 700,
            color: "var(--text)",
            wordBreak: "break-all",
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 13, color: "var(--text2)" }}>
          {formatBytes(size)}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LocalSharePage() {
  const { sessionId: paramSessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const cleanupRef = useRef(null);

  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Sender state
  const [file, setFile] = useState(null);
  const [sessionId, setSessionId] = useState(paramSessionId || null);
  const [shareUrl, setShareUrl] = useState("");
  const [senderStep, setSenderStep] = useState("pick");
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ mbps: 0, etaSec: null });
  const [limit, setLimit] = useState(null);

  // Receiver state
  const [fileInfo, setFileInfo] = useState(null);
  const [recvStep, setRecvStep] = useState("loading");
  const [recvProgress, setRecvProgress] = useState(0);
  const [recvStats, setRecvStats] = useState({ mbps: 0, etaSec: null });
  const [recvBlob, setRecvBlob] = useState(null);
  const [recvName, setRecvName] = useState("");

  const isReceiver = !!paramSessionId;

  const getSocket = useCallback(() => {
    if (!socketRef.current)
      socketRef.current = io(API, { transports: ["websocket"] });
    return socketRef.current;
  }, []);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      socketRef.current?.disconnect();
    },
    [],
  );

  useEffect(() => {
    if (isReceiver || user) return;
    fetch(`${API}/api/localshare/limit`)
      .then((r) => r.json())
      .then(setLimit)
      .catch(() => {});
  }, [isReceiver, user]);

  useEffect(() => {
    if (!isReceiver) return;
    fetch(`${API}/api/localshare/session/${paramSessionId}`)
      .then((r) => {
        if (r.status === 404) {
          setRecvStep("error");
          throw new Error();
        }
        if (r.status === 410) {
          setRecvStep("expired");
          throw new Error();
        }
        return r.json();
      })
      .then((data) => {
        setFileInfo(data);
        setRecvStep("ready");
      })
      .catch(() => {});
  }, [isReceiver, paramSessionId]);

  // ── Sender actions ────────────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const startSending = async () => {
    if (!file) return;
    const headers = { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API}/api/localshare/session`, {
      method: "POST",
      headers,
      body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
    });
    if (res.status === 429) {
      alert((await res.json()).error);
      return;
    }
    if (!res.ok) {
      alert("Failed to create session");
      return;
    }

    const { sessionId: sid } = await res.json();
    setSessionId(sid);
    setShareUrl(`${window.location.origin}/local-share/${sid}`);
    setSenderStep("waiting");

    const socket = getSocket();
    cleanupRef.current = createSender(
      socket,
      sid,
      file,
      (pct, s) => {
        setProgress(pct);
        setStats(s);
        setSenderStep("transferring");
      },
      async () => {
        setSenderStep("done");
        await fetch(`${API}/api/localshare/session/${sid}/complete`, {
          method: "POST",
        });
        socket.emit("transfer-done", { sessionId: sid });
      },
      () => setSenderStep("error"),
    );
  };

  const reset = () => {
    setFile(null);
    setSessionId(null);
    setSenderStep("pick");
    setProgress(0);
    setStats({ mbps: 0, etaSec: null });
  };

  // ── Receiver actions ──────────────────────────────────────────────────────────
  const startReceiving = () => {
    setRecvStep("receiving");
    const socket = getSocket();
    cleanupRef.current = createReceiver(
      socket,
      paramSessionId,
      (pct, s) => {
        setRecvProgress(pct);
        setRecvStats(s);
      },
      (blob, name) => {
        setRecvBlob(blob);
        setRecvName(name);
        setRecvStep("done");
      },
      () => setRecvStep("error"),
    );
  };

  // ── Offline ───────────────────────────────────────────────────────────────────
  if (!online)
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
        <h2 style={{ color: "var(--text)" }}>No Internet Connection</h2>
        <p style={{ color: "var(--text2)", marginBottom: 24 }}>
          Local Share needs an internet connection for the initial handshake.
          <br />
          Once connected, files transfer directly — nothing leaves your network.
        </p>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← Go back
        </button>
      </div>
    );

  // ── RECEIVER UI ───────────────────────────────────────────────────────────────
  if (isReceiver)
    return (
      <div style={{ padding: "40px 20px" }}>
        <h1
          style={{
            color: "var(--text)",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          📲 Incoming Local Share
        </h1>
        <div style={card}>
          {recvStep === "loading" && (
            <div style={{ textAlign: "center", color: "var(--text2)" }}>
              Loading…
            </div>
          )}

          {recvStep === "error" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <p style={{ color: "var(--text)" }}>
                Session not found or expired.
              </p>
              <p style={{ color: "var(--text2)", fontSize: 13 }}>
                Ask the sender to generate a new share link.
              </p>
            </div>
          )}

          {recvStep === "expired" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⌛</div>
              <p style={{ color: "var(--text)" }}>
                This transfer has already been completed.
              </p>
            </div>
          )}

          {recvStep === "ready" && fileInfo && (
            <>
              <FileCard name={fileInfo.fileName} size={fileInfo.fileSize} />
              <p
                style={{
                  color: "var(--text2)",
                  fontSize: 13,
                  marginBottom: 20,
                }}
              >
                File transfers directly from the sender's device — no server
                storage involved.
              </p>
              <button
                className="btn btn-primary w-full"
                style={{ justifyContent: "center" }}
                onClick={startReceiving}
              >
                ✅ Accept & Receive
              </button>
            </>
          )}

          {recvStep === "receiving" && fileInfo && (
            <>
              <FileCard name={fileInfo.fileName} size={fileInfo.fileSize} />
              <p
                style={{
                  color: "var(--text)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Receiving…
              </p>
              <StatsRow pct={recvProgress} stats={recvStats} />
            </>
          )}

          {recvStep === "done" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
              <p
                style={{
                  color: "var(--text)",
                  fontWeight: 700,
                  fontSize: 18,
                  marginBottom: 20,
                }}
              >
                Transfer complete!
              </p>
              <button
                className="btn btn-primary"
                onClick={() => triggerDownload(recvBlob, recvName)}
              >
                ⬇️ Download {recvName}
              </button>
            </div>
          )}
        </div>
      </div>
    );

  // ── SENDER UI ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "40px 20px" }}>
      <h1 style={{ color: "var(--text)", marginBottom: 8 }}>📡 Local Share</h1>
      <p style={{ color: "var(--text2)", marginBottom: 32, fontSize: 14 }}>
        Share files directly with nearby devices — P2P, no cloud storage
        involved.
      </p>

      {!user && limit && (
        <div
          className={`alert ${limit.remaining > 0 ? "alert-info" : "alert-error"}`}
          style={{ marginBottom: 24, maxWidth: 520, margin: "0 auto 24px" }}
        >
          {limit.remaining > 0
            ? `${limit.remaining} of ${limit.limit} free transfers remaining. Sign in for unlimited.`
            : `You've used all ${limit.limit} free transfers. Sign in to continue.`}
        </div>
      )}

      <div style={card}>
        {senderStep === "pick" && (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById("ls-file-input").click()}
              style={{
                border: `2px dashed ${file ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                padding: "36px 20px",
                textAlign: "center",
                cursor: "pointer",
                marginBottom: 20,
                background: file ? "rgba(108,99,255,0.05)" : "transparent",
                transition: "all 0.2s",
              }}
            >
              {file ? (
                <FileCard
                  name={file.name}
                  size={file.size}
                  mimeType={file.type}
                />
              ) : (
                <>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
                  <div style={{ color: "var(--text2)" }}>
                    Drop a file here or click to browse
                  </div>
                </>
              )}
              <input
                id="ls-file-input"
                type="file"
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
            </div>
            <button
              className="btn btn-primary w-full"
              style={{ justifyContent: "center" }}
              disabled={!file || (!user && limit?.remaining === 0)}
              onClick={startSending}
            >
              🔗 Generate Share Link
            </button>
          </>
        )}

        {senderStep === "waiting" && (
          <>
            {file && (
              <FileCard
                name={file.name}
                size={file.size}
                mimeType={file.type}
              />
            )}
            <p
              style={{ color: "var(--text)", fontWeight: 600, marginBottom: 4 }}
            >
              Waiting for receiver…
            </p>
            <p
              style={{ color: "var(--text2)", fontSize: 13, marginBottom: 20 }}
            >
              Share this link or scan the QR code.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <div
                style={{ padding: 16, background: "#fff", borderRadius: 12 }}
              >
                <QRCodeSVG value={shareUrl} size={180} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                readOnly
                value={shareUrl}
                style={{ flex: 1, fontSize: 12 }}
              />
              <button
                className="btn btn-secondary"
                onClick={() => navigator.clipboard.writeText(shareUrl)}
              >
                Copy
              </button>
            </div>
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text2)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    display: "inline-block",
                  }}
                />
                Waiting for connection
              </span>
            </div>
          </>
        )}

        {senderStep === "transferring" && (
          <>
            {file && (
              <FileCard
                name={file.name}
                size={file.size}
                mimeType={file.type}
              />
            )}
            <p
              style={{ color: "var(--text)", fontWeight: 600, marginBottom: 4 }}
            >
              Sending…
            </p>
            <StatsRow pct={progress} stats={stats} />
          </>
        )}

        {senderStep === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
            <p
              style={{
                color: "var(--text)",
                fontWeight: 700,
                fontSize: 18,
                marginBottom: 20,
              }}
            >
              File sent successfully!
            </p>
            <button className="btn btn-secondary" onClick={reset}>
              Share another file
            </button>
          </div>
        )}

        {senderStep === "error" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <p style={{ color: "var(--text)" }}>
              Transfer failed. Please try again.
            </p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 16 }}
              onClick={() => setSenderStep("pick")}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
