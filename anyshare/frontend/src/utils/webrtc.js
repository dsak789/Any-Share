/**
 * utils/webrtc.js
 * WebRTC DataChannel file transfer — optimized for large files.
 * onProgress(pct, stats) where stats = { mbps, etaSec, bytesSent }
 */

const CHUNK_SIZE = 256 * 1024;
const BUFFER_LOW_THRESHOLD = 512 * 1024;
const BUFFER_HIGH_MARK = 4 * 1024 * 1024;

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

function makePeerConnection() {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

// ── Speed tracker ─────────────────────────────────────────────────────────────
function makeSpeedTracker(totalBytes) {
  let startTime = null;
  let lastTime = null;
  let lastBytes = 0;
  let smoothMbps = 0;

  return function track(bytesSent) {
    const now = Date.now();
    if (!startTime) {
      startTime = now;
      lastTime = now;
      lastBytes = 0;
    }

    const intervalMs = now - lastTime;
    const intervalBytes = bytesSent - lastBytes;

    if (intervalMs >= 500 && intervalBytes > 0) {
      const instantMbps = (intervalBytes * 8) / (intervalMs / 1000) / 1_000_000;
      smoothMbps =
        smoothMbps === 0 ? instantMbps : smoothMbps * 0.6 + instantMbps * 0.4;
      lastTime = now;
      lastBytes = bytesSent;
    }

    const remaining = totalBytes - bytesSent;
    const etaSec =
      smoothMbps > 0
        ? Math.round(remaining / ((smoothMbps * 1_000_000) / 8))
        : null;

    return { mbps: +smoothMbps.toFixed(2), etaSec, bytesSent };
  };
}

// ── SENDER ────────────────────────────────────────────────────────────────────
export function createSender(
  socket,
  sessionId,
  file,
  onProgress,
  onDone,
  onError,
) {
  const pc = makePeerConnection();
  const channel = pc.createDataChannel("file", { ordered: true });
  channel.binaryType = "arraybuffer";
  channel.bufferedAmountLowThreshold = BUFFER_LOW_THRESHOLD;

  const track = makeSpeedTracker(file.size);
  let offset = 0;
  let sending = false;
  let paused = false;

  async function sendNextChunk() {
    if (offset >= file.size) {
      channel.send(JSON.stringify({ done: true }));
      onDone();
      return;
    }
    if (channel.bufferedAmount >= BUFFER_HIGH_MARK) {
      paused = true;
      return;
    }

    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await slice.arrayBuffer();
    channel.send(buffer);
    offset += buffer.byteLength;

    const pct = Math.min(100, Math.round((offset / file.size) * 100));
    const stats = track(offset);
    onProgress(pct, stats);

    if (channel.bufferedAmount < BUFFER_HIGH_MARK) {
      Promise.resolve().then(sendNextChunk);
    } else {
      paused = true;
    }
  }

  channel.onbufferedamountlow = () => {
    if (paused) {
      paused = false;
      sendNextChunk();
    }
  };
  channel.onopen = () => {
    channel.send(
      JSON.stringify({ name: file.name, size: file.size, type: file.type }),
    );
    if (!sending) {
      sending = true;
      sendNextChunk();
    }
  };
  channel.onerror = (e) => onError?.(e);

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit("ice-candidate", { sessionId, candidate });
  };
  socket.on("guest-joined", async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { sessionId, offer });
  });
  socket.on("answer", async ({ answer }) => {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  });
  socket.on("ice-candidate", async ({ candidate }) => {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (_) {}
  });

  socket.emit("host-session", { sessionId });

  return () => {
    pc.close();
    socket.off("guest-joined");
    socket.off("answer");
    socket.off("ice-candidate");
  };
}

// ── RECEIVER ──────────────────────────────────────────────────────────────────
export function createReceiver(socket, sessionId, onProgress, onDone, onError) {
  const pc = makePeerConnection();
  let tracker = null;

  pc.ondatachannel = ({ channel }) => {
    channel.binaryType = "arraybuffer";
    let meta = null,
      chunks = [],
      received = 0;

    channel.onmessage = ({ data }) => {
      if (typeof data === "string") {
        const msg = JSON.parse(data);
        if (msg.done) {
          const blob = new Blob(chunks, {
            type: meta?.type || "application/octet-stream",
          });
          onDone(blob, meta?.name || "file");
          chunks = [];
        } else {
          meta = msg;
          tracker = makeSpeedTracker(msg.size);
        }
      } else {
        chunks.push(data);
        received += data.byteLength;
        if (meta?.size) {
          const pct = Math.min(100, Math.round((received / meta.size) * 100));
          const stats = tracker
            ? tracker(received)
            : { mbps: 0, etaSec: null, bytesSent: received };
          onProgress(pct, stats);
        }
      }
    };
    channel.onerror = (e) => onError?.(e);
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit("ice-candidate", { sessionId, candidate });
  };
  socket.on("offer", async ({ offer }) => {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { sessionId, answer });
  });
  socket.on("ice-candidate", async ({ candidate }) => {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (_) {}
  });

  socket.emit("join-session", { sessionId });

  return () => {
    pc.close();
    socket.off("offer");
    socket.off("ice-candidate");
  };
}
