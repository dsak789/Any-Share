# 🔐 FileVault

A full-stack file storage system with **DynamoDB persistence**, **JWT authentication**, and **PIN-based sharing**.

---

## Features

- **User Authentication** — Register/login with email + password; sessions persist via JWT stored in localStorage
- **Smart Storage Routing** — Files **≥ 100 MB** are stored on the server filesystem; smaller files are stored inline as base64 in DynamoDB
- **PIN-Based Sharing** — Generate a one-time 6-digit PIN per file per recipient; they enter it to unlock download access
- **Full Persistence** — All metadata, users, files, and shares survive server restarts
- **Access Control** — Downloads require ownership or an active share grant; PINs are user-specific
- **Share Management** — Owners can view and revoke any active share

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Database | AWS DynamoDB (3 tables) |
| File Storage | Multer (disk) + DynamoDB (inline base64) |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Frontend | React 18, React Router 6 |
| HTTP Client | Axios |
| Styling | Custom CSS (no framework) |

---

## Folder Structure

```
filevault/
├── backend/
│   ├── config/
│   │   ├── dynamo.js          # DynamoDB client + table initialization
│   │   └── multer.js          # Multer disk storage config
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js            # POST /register, POST /login, GET /me
│   │   ├── files.js           # Upload, list, download, delete
│   │   └── shares.js          # Create share, validate PIN, list, revoke
│   ├── uploads/               # Large files stored here (auto-created)
│   ├── server.js              # Express entry point
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── ProtectedLayout.js   # Auth guard + sidebar wrapper
    │   │   ├── Sidebar.js           # Navigation sidebar
    │   │   └── ShareModal.js        # PIN generation modal
    │   ├── context/
    │   │   └── AuthContext.js       # Global auth state (login/register/logout)
    │   ├── pages/
    │   │   ├── AuthPage.js          # Login + Register
    │   │   ├── MyFilesPage.js       # File list with share/download/delete
    │   │   ├── SharedPage.js        # Files shared with me
    │   │   ├── UploadPage.js        # Drag-and-drop upload with progress
    │   │   ├── PinPage.js           # Enter PIN to unlock a file
    │   │   └── ManageSharesPage.js  # View/revoke all shares granted
    │   ├── utils/
    │   │   ├── api.js               # Axios instance + all API calls
    │   │   └── fileUtils.js         # formatBytes, formatDate, fileIcon, triggerDownload
    │   ├── App.js                   # Router setup
    │   ├── index.js                 # React entry point
    │   └── index.css                # Global design system (dark theme)
    └── package.json
```

---

## Prerequisites

- **Node.js** v18+
- **AWS Account** with programmatic IAM credentials
- IAM user needs `dynamodb:*` on the three tables (or `AmazonDynamoDBFullAccess` for development)

---

## Setup

### 1. Clone and configure

```bash
git clone <your-repo>
cd filevault
```

### 2. Backend environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
JWT_SECRET=change_this_to_a_random_32char_string

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

DYNAMO_USERS_TABLE=filevault_users
DYNAMO_FILES_TABLE=filevault_files
DYNAMO_SHARES_TABLE=filevault_shares

UPLOAD_DIR=./uploads
LARGE_FILE_THRESHOLD=104857600    # 100 MB in bytes (adjust as needed)

FRONTEND_URL=http://localhost:3000
```

### 3. Install dependencies and start backend

```bash
cd backend
npm install
npm run dev        # nodemon auto-reload
# or: npm start
```

On first start, the server will automatically create the three DynamoDB tables if they don't exist.

### 4. Frontend environment

```bash
cd frontend
cp .env.example .env
```

Edit `.env`:

```env
REACT_APP_API_URL=http://localhost:5000
```

### 5. Install and start frontend

```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000.

---

## DynamoDB Tables

The backend creates these automatically:

| Table | Primary Key | GSI | Purpose |
|---|---|---|---|
| `filevault_users` | `userId` (hash) | `email-index` on `email` | User accounts |
| `filevault_files` | `fileId` (hash) | `owner-index` on `ownerId` | File metadata + inline content |
| `filevault_shares` | `fileId` (hash) + `granteeId` (range) | `pin-index` on `pin`, `grantee-index` on `granteeId` | Share grants + PINs |

---

## Storage Strategy

| File Size | Where Stored | DynamoDB Field |
|---|---|---|
| < 100 MB | DynamoDB inline as `content` (base64) | `storageType: "inline"` |
| ≥ 100 MB | Server filesystem at `UPLOAD_DIR` | `storageType: "disk"`, `storagePath: "..."` |

The threshold is controlled by `LARGE_FILE_THRESHOLD` in `.env` (default: 104857600 bytes = 100 MB).

> **DynamoDB item size limit is 400 KB.** The 100 MB threshold keeps small files in the database while routing large ones to disk. Adjust the threshold to suit your use case, but keep in mind this hard limit.

---

## API Reference

### Auth

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | — | `{name, email, password}` | Create account |
| POST | `/api/auth/login` | — | `{email, password}` | Sign in, get JWT |
| GET | `/api/auth/me` | ✅ | — | Get current user |

### Files

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/files/upload` | ✅ | Upload a file (multipart/form-data, field: `file`) |
| GET | `/api/files` | ✅ | List your own files |
| GET | `/api/files/shared` | ✅ | List files shared with you |
| GET | `/api/files/:fileId/download` | ✅ | Download (owner or grantee) |
| DELETE | `/api/files/:fileId` | ✅ | Delete (owner only) |

### Shares

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/shares` | ✅ | `{fileId, granteeEmail}` | Create share, get PIN |
| POST | `/api/shares/validate-pin` | ✅ | `{pin}` | Validate PIN, returns file info |
| GET | `/api/shares/my-shares` | ✅ | — | List all shares you've granted |
| DELETE | `/api/shares/:fileId/:granteeId` | ✅ | — | Revoke share |

---

## PIN Sharing Flow

1. **Owner** goes to My Files → clicks 🔗 Share on any file
2. Enters the recipient's **email address** (they must have an account)
3. A **6-digit PIN** is generated and displayed — owner sends it to the recipient out-of-band (e.g. via message)
4. **Recipient** goes to Enter PIN → types the 6 digits
5. If the PIN matches their account, they get immediate download access
6. The file also appears permanently in their **Shared With Me** tab
7. Owner can revoke anytime from **Manage Shares**

---

## Production Deployment

### Backend (e.g. Railway, Render, EC2)

1. Set all environment variables from `.env.example`
2. Set `NODE_ENV=production`
3. Set `FRONTEND_URL` to your deployed frontend URL
4. Ensure the `UPLOAD_DIR` path is writable and **persistent** (use a mounted volume for large file storage)
5. `npm start`

### Frontend (e.g. Vercel, Netlify)

1. Set `REACT_APP_API_URL` to your deployed backend URL
2. `npm run build` — serve the `build/` directory

### IAM Policy (minimum required)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/filevault_*",
        "arn:aws:dynamodb:*:*:table/filevault_*/index/*"
      ]
    }
  ]
}
```

---

## Security Notes

- Passwords are hashed with **bcrypt** (12 rounds)
- JWTs expire after **7 days**
- PINs are **user-specific**: even if someone guesses a PIN, it won't work on a different account
- Rate limiting: 20 auth requests / 15 min; 200 API requests / 15 min per IP
- CORS is restricted to `FRONTEND_URL`

---

## Customization

| What | Where |
|---|---|
| File size threshold | `LARGE_FILE_THRESHOLD` in `.env` |
| JWT expiry | `server.js` → `jwt.sign(..., { expiresIn: '7d' })` |
| Upload size limit | `backend/config/multer.js` → `fileSize` |
| PIN length | `backend/routes/shares.js` → `generatePin(6)` |
| DynamoDB table names | `.env` `DYNAMO_*_TABLE` variables |
