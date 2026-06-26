# OPPO x MakeMyTrip (MMT) UGC Campaign Platform

Welcome to the **OPPO x MakeMyTrip (MMT) UGC Campaign Platform** workspace. This repository contains the complete scaffolding, layout, and fully functional core components for the UGC Campaign.

---

## 📂 Directory Structure

The workspace is organized into two primary segments:

```
├── Frontend/
│   ├── Traveler_Landing_Page/
│   │   └── index.html               # Mobile-first user portal (OTP validation, query location, S3 Upload)
│   ├── Operator_Landing_Page/
│   │   └── index.html               # Partner portal (Operator code verification, autocomplete search, S3 Upload)
│   ├── MMT_Dashboard/
│   │   └── index.html               # Admin portal (Overview analytics, moderation Approve/Reject actions)
│   └── Oppo_Dashboard/
│       └── index.html               # Client portal (Approved submission gallery, Winner tool, SheetJS Exporter)
│
└── Backend/
    ├── config/
    │   ├── db.js                    # Database pool connection with PostgreSQL (with Mock Memory fallback)
    │   └── s3.js                    # AWS S3 connection client (with S3 Mock upload simulator)
    ├── controllers/
    │   ├── uploadController.js      # S3 Pre-signed upload validation & generator
    │   └── submissionController.js  # DB logging controllers, winner selectors, and statistics aggregators
    ├── db/
    │   └── schema.sql               # Database schemas, relational tables, indexes, and triggers
    ├── routes/
    │   └── api.js                   # API endpoint Router
    ├── app.js                       # Standard Express application setting up middlewares and listeners
    ├── handler.js                   # serverless-http Lambda adapter wrapper
    ├── serverless.yml               # Serverless Framework configuration for deployment on AWS Lambda
    ├── package.json                 # Dependency definitions
    └── .env.example                 # Configuration blueprint
```

---

## ⚡ Key Highlights & Core Features

### 1. Direct-to-S3 Upload (with Pre-signed URLs)
To bypass Serverless limits on AWS Lambda (e.g., maximum payload limit of 6MB), the Traveler and Operator pages upload directly to AWS S3. 
- The client requests a secure pre-signed upload URL from the Express backend (`POST /api/upload/presigned-url`).
- The backend validates file sizes (**10MB limit for Traveler**, **15MB limit for Operator**).
- The client executes a direct binary `PUT` upload from the browser to the S3 bucket.
- The client logs the success details to database table records (`POST /api/submissions`).

### 2. Mock Fallback System (Zero-Dependency Offline Testing)
To enable testing without configuring live AWS S3 credentials or local PostgreSQL instances:
- **Mock DB Mode**: If environment settings are omitted, `Backend/config/db.js` spawns an in-memory database simulation that mimics SQL inserts, queries, KPI stats, updates, and filters automatically.
- **Mock S3 Mode**: If S3 credentials are missing, `Backend/config/s3.js` routes uploads to a local simulator route (`PUT /api/upload/mock-s3-put`) and returns visual placeholder mock images (`https://picsum.photos`) so thumbnails look vibrant.

### 3. Integrated Excel Report Generator
Inside the `Oppo_Dashboard/index.html`, the client integrates SheetJS (`xlsx`) from a CDN. Clicking "Generate Multi-Sheet Excel Report" executes a direct database scan, designs multi-tab spreadsheets:
- **Sheet 1**: Campaign Overview KPIs
- **Sheet 2**: Moderated & Approved Submissions List
- **Sheet 3**: Chosen Campaign Winners List
Downloads directly to the user's desktop with zero backend processing overhead!

---

## 🛠️ Local Development Quickstart

### Step 1: Install Backend Dependencies
Navigate to the `Backend/` directory and install required NPM packages:
```bash
cd Backend
npm install
```

### Step 2: Configure Environment Settings (Optional)
Copy `.env.example` to `.env` and fill in your connection credentials:
```bash
cp .env.example .env
```
*(If you leave `.env` empty or default, the server runs in **Zero-Dependency Mock Fallback mode**).*

### Step 3: Run the Express Server
```bash
npm start
```
The server will bind to port `5000` (http://localhost:5000) by default.

### Step 4: Open Frontends
Open any landing page/dashboard file in your browser directly:
- Traveler: [index.html](file:///d:/Client%20Work/Creative%20Catalysts%20%5BHans%20Bellani%5D/OppoxMMT%20Tour%20Contest/Frontend/Traveler_Landing_Page/index.html)
- Operator: [index.html](file:///d:/Client%20Work/Creative%20Catalysts%20%5BHans%20Bellani%5D/OppoxMMT%20Tour%20Contest/Frontend/Operator_Landing_Page/index.html)
- MMT Dashboard: [index.html](file:///d:/Client%20Work/Creative%20Catalysts%20%5BHans%20Bellani%5D/OppoxMMT%20Tour%20Contest/Frontend/MMT_Dashboard/index.html)
- Oppo Dashboard: [index.html](file:///d:/Client%20Work/Creative%20Catalysts%20%5BHans%20Bellani%5D/OppoxMMT%20Tour%20Contest/Frontend/Oppo_Dashboard/index.html)

*Each frontend page includes an **API Server URL box** in the header where you can re-target the client to any staging, localhost, or production Serverless API Gateway URL.*

---

## ☁️ Deployment on AWS (Serverless)

The backend is configured for the Serverless Framework. Deploy using:
```bash
cd Backend
npm install -g serverless
serverless deploy
```
This sets up an AWS Lambda instance, API Gateway endpoints with HTTP CORS support, and maps them to `handler.js`.
