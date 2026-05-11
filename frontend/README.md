# Vault — File Storage Application

A full-stack file storage app built with **Node.js + Express** (backend) and **React** (frontend). Users can upload, list, download, and delete files with no authentication required.

---

## Folder Structure

```
file-storage-app/
├── backend/
│   ├── uploads/            # Stored files (auto-created, git-ignored)
│   ├── server.js           # Express API
│   ├── package.json
│   └── .gitignore
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── FileList.js / .css
    │   │   ├── Toast.js    / .css
    │   │   └── UploadZone.js / .css
    │   ├── api.js          # Axios helpers
    │   ├── App.js / .css
    │   └── index.js / .css
    └── package.json
```

---

## Prerequisites

- **Node.js** v18+ and **npm** v9+

---

## Local Development

### 1. Backend

```bash
cd backend
npm install
npm run dev        # starts on http://localhost:5000 with nodemon
# or:
npm start          # production start
```

### 2. Frontend

```bash
cd frontend
npm install
npm start          # starts on http://localhost:3000
```

The React dev server proxies `/api/*` requests to `http://localhost:5000` automatically (via `"proxy"` in `frontend/package.json`).

Open **http://localhost:3000** in your browser.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload one or more files (`multipart/form-data`, field `files`) |
| `GET`  | `/api/files` | List all uploaded files |
| `GET`  | `/api/files/:id` | Get metadata for a single file |
| `GET`  | `/api/download/:id` | Download a file by ID |
| `DELETE` | `/api/files/:id` | Delete a file |

### Upload example (curl)

```bash
curl -X POST http://localhost:5000/api/upload \
  -F "files=@/path/to/file.pdf" \
  -F "files=@/path/to/image.png"
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Port for the Express server |

Set environment variables in a `.env` file in `backend/` (or export before starting):

```env
PORT=5000
```

---

## Production Deployment

### Build the React frontend

```bash
cd frontend
npm run build
```

This creates `frontend/build/`. Serve it statically from your Express server by adding to `server.js`:

```js
const path = require("path");
// Serve React build
app.use(express.static(path.join(__dirname, "../frontend/build")));
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "../frontend/build/index.html"))
);
```

### Run in production

```bash
cd backend
NODE_ENV=production node server.js
```

### Using PM2 (recommended)

```bash
npm install -g pm2
cd backend
pm2 start server.js --name vault
pm2 save
```

---

## Extending the App

### Add a database (SQLite example)

Replace the in-memory `fileMetadata` object in `server.js` with [better-sqlite3](https://github.com/WiseLibs/better-sqlite3):

```bash
npm install better-sqlite3
```

### Add authentication (future)

The API is structured so you can add an auth middleware per-route:

```js
// Example: protect delete
app.delete("/api/files/:id", requireAuth, (req, res) => { ... });
```

### Increase file size limit

In `server.js`, update the multer limits option:

```js
limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
```

---

## License

MIT
