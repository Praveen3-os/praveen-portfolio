# 🚀 Command Center AI: Enterprise Assistant & Telemetry Platform

An intelligent, full-stack cybernetic command center and portfolio platform for **PRAVEEN. A** (Mechatronics Engineering, Full Stack Development, AI Prompt Engineering), integrating real-time Google Gemini streaming, native SQL databases, MongoDB telemetry logging, and request monitoring.

---

## 📌 Submission Overview

1. **Individual Task Title**:  
   **Command Center AI: Enterprise Assistant & Telemetry Platform for Praveen's Engineering Portfolio**

2. **Live Website Link (HTTPS)**:  
   **[https://praveen3-os.github.io/praveen-portfolio/](https://praveen3-os.github.io/praveen-portfolio/)**  
   *(Local Server: `http://localhost:3000`)*

3. **GitHub Repository Link**:  
   **[https://github.com/Praveen3-os/praveen-portfolio.git](https://github.com/Praveen3-os/praveen-portfolio.git)**

---

## ✨ Features & Requirements Verification

| Requirement | Implementation Detail | Status |
| --- | --- | :---: |
| **Responsive Website (3+ Pages)** | Includes `index.html`, `about.html`, `faqs.html`, `errors.html`, `health.html`, `skills.html`, `experience.html`, `protosem.html`, `iot.html`, and `contact.html` with mobile-first CSS. | ✅ Complete |
| **Chat Widget on Every Page** | Universal `chat-widget.js` + `chat-widget.css` floating launcher and interactive chat window dynamically active across all pages. | ✅ Complete |
| **Minimum 10 FAQs in SQL** | 12 detailed FAQs stored in native `node:sqlite` database (`data/portfolio.db`), queryable via `/api/faqs` with live search and category filtering on `faqs.html`. | ✅ Complete |
| **Minimum 8 Error Codes** | 8 error codes (`400`, `401`, `403`, `404`, `429`, `500`, `503`, and site-specific `599 PRAVEEN_CORE_TIMEOUT`) stored in SQL and documented on `errors.html`. | ✅ Complete |
| **Custom 404 & 500 Pages** | Dedicated `404.html` and `500.html` pages styled in the Command Center design, featuring an interactive **"Ask the Assistant"** option. | ✅ Complete |
| **AI Assistant (RAG & Tickets)** | Powered by Google Gemini 2.0 streaming. Retrieves relevant SQL FAQs, explains error codes, and automatically generates SQL support tickets when it cannot answer. | ✅ Complete |
| **Dual Database Architecture** | **SQL Database (`node:sqlite`)**: Stores FAQs, Error Codes, and Support Tickets.<br>**MongoDB**: Stores chat conversation logs (`chat_logs`) and user ratings/feedback (`feedback`). | ✅ Complete |
| **Security & Env Variables** | All keys (`GEMINI_API_KEY`, `MONGODB_URI`, `PORT`) managed via `.env`. `.gitignore` ensures zero secrets or database binaries are committed to GitHub. | ✅ Complete |
| **Request Logging & Health Check** | Structured Express logging middleware capturing timestamp, method, path, status, IP, and duration. Live `/health.html` telemetry dashboard. | ✅ Complete |
| **Third-Party API with Timeout** | `/api/third-party-quote` calls external quotes API enforced by `AbortController` with a **2000ms timeout threshold** and seamless cached offline fallback. | ✅ Complete |

---

## 🏛️ System Architecture

```
[ Client Browser (All Pages + Mobile) ]
             │
             ├── Universal Floating Chat Widget (`chat-widget.js`)
             ├── FAQs Page (`faqs.html` with Live SQL Search)
             ├── Error Codes Registry (`errors.html` with 8 Codes)
             ├── Custom Error Pages (`404.html` & `500.html`)
             └── Telemetry Health Dashboard (`health.html`)
             │
             ▼
[ Express.js Full-Stack Server (`server.js`) ]
 ├── Request Logger Middleware (Ring Buffer Telemetry)
 ├── Third-Party API Controller (2000ms AbortController Timeout + Fallback)
 ├── Google Gemini 2.0 Streaming Engine (SSE Stream + RAG Context)
 │
 ├──► [ SQL Database (node:sqlite) ]
 │      ├── `faqs` (12 Detailed Portfolio & Engineering Entries)
 │      ├── `error_codes` (400, 401, 403, 404, 429, 500, 503, 599)
 │      └── `support_tickets` (Auto-generated Support Tickets)
 │
 └──► [ MongoDB Database ]
        ├── `chat_logs` Collection (User queries, responses, IP, timestamps)
        └── `feedback` Collection (Thumbs Up/Down ratings, comments)
```

---

## 🛠️ Quick Start & Local Execution

### 1. Clone & Install
```bash
git clone https://github.com/Praveen3-os/praveen-portfolio.git
cd praveen-portfolio
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your configuration:
```env
GEMINI_API_KEY=your_google_ai_studio_api_key_here
MONGODB_URI=mongodb://localhost:27017/praveen_portfolio
PORT=3000
```
*(Note: If MongoDB is not running locally, the server automatically enables a resilient persistent local document store fallback so the app runs with zero friction).*

### 3. Launch Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Testing Verification Checklist

1. **Mobile Verification**:
   - Open browser developer tools (`Cmd + Option + I` or `F12`), toggle Device Mode (iPhone / Pixel), and verify smooth responsive layout and floating chat widget accessibility.
2. **Custom 404 Verification**:
   - Navigate to any invalid address like `http://localhost:3000/invalid-url-test`.
   - Verify that the custom `404.html` page renders with status 404 and clicking **"Ask the Assistant"** pre-fills the inquiry.
3. **Custom 500 Verification**:
   - Navigate to `http://localhost:3000/trigger-500`.
   - Verify that the custom `500.html` page renders with status 500 and the **"Ask the Assistant"** option.
4. **Automated Ticket Creation**:
   - In the chat widget, ask: *"I have an issue that cannot be answered, please create a support ticket."*
   - Verify that the assistant files an official ticket (`TICK-XXXX-XXXX`) into the SQL database.
5. **Third-Party API Timeout & Fallback**:
   - Navigate to `http://localhost:3000/health.html` and click **"Test API Call"**.
   - Verify that the external quote is retrieved, or fallback is served if simulated latency exceeds 2000ms.

---

## 💡 Proposed Improvement

### **Hybrid Vector Semantic RAG with Automated Knowledge Ingestion**

While the current architecture successfully leverages SQL keyword search and category filtering to ground the Gemini AI Assistant on portfolio FAQs and error codes, a proposed future improvement is to implement **Hybrid Vector Semantic RAG (Retrieval-Augmented Generation)**:

1. **High-Dimensional Embeddings (`text-embedding-004`)**:
   Convert all SQL FAQs, technical project documentation (such as CAD schematics, ProtoSem hardware logs, and IoT telemetry code), and error resolution histories into dense 768-dimensional vector embeddings stored using `sqlite-vss` or a managed vector store (e.g., Pinecone or pgvector).
2. **Semantic Similarity Search**:
   Enable cosine-similarity search so that visitors asking colloquial questions (e.g. *"How does Praveen control hardware over the internet?"*) automatically retrieve the technical IoT MQTT Task 4 records even if exact keywords do not match.
3. **Proactive Knowledge Ingestion**:
   Analyze unanswered questions logged in the MongoDB `chat_logs` collection. When multiple visitors inquire about a topic not yet in the SQL database, automatically summarize the gap and propose draft FAQs for Praveen to approve with one click.
