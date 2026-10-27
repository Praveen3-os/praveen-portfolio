/**
 * PRAVEEN.A // Database Management Layer
 * - SQL Database: Native node:sqlite storing FAQs (12+ items), Error Codes (8 items), and Support Tickets.
 * - MongoDB Database: Official MongoClient storing Chat Logs and User Feedback (with resilient local document fallback).
 */

import { DatabaseSync } from 'node:sqlite';
import { MongoClient } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
const MONGO_FALLBACK_DIR = path.join(DATA_DIR, 'mongo_fallback');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MONGO_FALLBACK_DIR)) fs.mkdirSync(MONGO_FALLBACK_DIR, { recursive: true });

// ============================================================================
// 1. SQL DATABASE INITIALIZATION (node:sqlite)
// ============================================================================
const SQL_DB_PATH = path.join(DATA_DIR, 'portfolio.db');
const sqlDb = new DatabaseSync(SQL_DB_PATH);

// Create SQL Tables
sqlDb.exec(`
  CREATE TABLE IF NOT EXISTS faqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT
  );

  CREATE TABLE IF NOT EXISTS error_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    cause TEXT NOT NULL,
    resolution TEXT NOT NULL,
    category TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_code TEXT UNIQUE NOT NULL,
    user_name TEXT,
    email TEXT,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'Normal',
    status TEXT DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed FAQs (Minimum 10 FAQs required, providing 12 detailed entries)
const faqCount = sqlDb.prepare('SELECT COUNT(*) as count FROM faqs').get().count;
if (faqCount === 0) {
  const insertFaq = sqlDb.prepare(`
    INSERT INTO faqs (category, question, answer, keywords)
    VALUES (?, ?, ?, ?)
  `);

  const INITIAL_FAQS = [
    {
      category: 'Profile & Background',
      question: 'Who is Praveen A and what are his core engineering disciplines?',
      answer: 'Praveen A is a Mechatronics Engineering student, Full Stack Developer, and AI Prompt Engineer. He focuses on the convergence of robotics, PLC automation, IoT telemetry, embedded systems, and modern web software architectures.',
      keywords: 'praveen, mechatronics, profile, disciplines, background, engineering'
    },
    {
      category: 'Profile & Background',
      question: 'What is Praveen’s personality type and engineering approach?',
      answer: 'Praveen is identified as an INFJ-T (Advocate) on the 16 Personalities framework. His approach combines rigorous systems thinking and analytical precision with collaborative empathy and continuous innovation.',
      keywords: 'personality, infj, advocate, approach, style, philosophy'
    },
    {
      category: 'ProtoSem Fellowship',
      question: 'What is the ProtoSem Fellowship at KCT Forge?',
      answer: 'ProtoSem is an intensive fellowship program based at KCT Forge. It immerses engineering students in rapid prototyping, hardware-software integration, system design, failure mode analysis, and bringing industrial-grade concepts to life.',
      keywords: 'protosem, kct forge, fellowship, prototyping, hardware'
    },
    {
      category: 'IoT Sessions',
      question: 'What was achieved in IoT Practical Task 1?',
      answer: 'Task 1 focused on Microcontroller Firmware & Telemetry Setup using the NodeMCU (ESP8266) development board, establishing Wi-Fi connectivity, flashing firmware, and hardware LED telemetry control.',
      keywords: 'iot, task 1, nodemcu, esp8266, firmware, wifi'
    },
    {
      category: 'IoT Sessions',
      question: 'How was environmental sensing handled in IoT Task 2?',
      answer: 'Task 2 interfaced DHT temperature and humidity sensors with the microcontroller, calibrated raw analog/digital signals, and verified reliable data sampling loops.',
      keywords: 'iot, task 2, dht, temperature, humidity, sensor'
    },
    {
      category: 'IoT Sessions',
      question: 'What was demonstrated in IoT Task 3 regarding actuators?',
      answer: 'Task 3 explored physical actuator and relay module driving, controlling high-load circuits from low-voltage microcontroller digital output pins safely.',
      keywords: 'iot, task 3, actuators, relays, motor, control'
    },
    {
      category: 'IoT Sessions',
      question: 'How did IoT Task 4 implement cloud communication?',
      answer: 'Task 4 established real-time bidirectional communication using the MQTT lightweight messaging protocol, publishing live sensor telemetry to a remote cloud dashboard.',
      keywords: 'iot, task 4, mqtt, cloud, broker, telemetry, dashboard'
    },
    {
      category: 'IoT Sessions',
      question: 'What is the complete architecture of IoT Task 5?',
      answer: 'Task 5 synthesized an autonomous closed-loop cyber-physical system, linking sensors, edge threshold logic, cloud reporting, and automated actuator responses without human intervention.',
      keywords: 'iot, task 5, closed-loop, cyber-physical, automation'
    },
    {
      category: 'Technical Stack',
      question: 'What programming languages and web frameworks does Praveen use?',
      answer: 'Praveen works with modern JavaScript (ES6+), React, Node.js, HTML5/CSS3, Python, C/C++ for embedded microcontrollers, and PLC ladder logic.',
      keywords: 'skills, stack, javascript, react, nodejs, python, c++, plc'
    },
    {
      category: 'AI Assistant',
      question: 'How does the on-site Gemini AI Assistant work?',
      answer: 'The assistant uses Google Gemini API with RAG (Retrieval-Augmented Generation) grounded directly on this SQL database. It answers portfolio queries, explains error codes, supports speech/vision, and automatically creates SQL support tickets if a query needs human intervention.',
      keywords: 'ai assistant, gemini, rag, support tickets, vision, voice'
    },
    {
      category: 'Contact & Collaboration',
      question: 'How can engineering recruiters or collaborators reach Praveen?',
      answer: 'You can submit an inquiry through the Contact page form, trigger a ticket through the AI Assistant, or email Praveen directly at ap5550135@gmail.com.',
      keywords: 'contact, email, hire, recruit, collaborate'
    },
    {
      category: 'Platform Architecture',
      question: 'What databases and backend infrastructure power this platform?',
      answer: 'This platform utilizes native node:sqlite for relational data (FAQs, error codes, support tickets) and MongoDB for document-oriented chat logs and feedback telemetry, backed by an Express server with active request logging.',
      keywords: 'architecture, sqlite, mongodb, express, backend, database'
    }
  ];

  INITIAL_FAQS.forEach(faq => {
    insertFaq.run(faq.category, faq.question, faq.answer, faq.keywords);
  });
}

// Seed Error Codes (Minimum 8 error codes: 400, 401, 403, 404, 429, 500, 503, + 599 site-specific)
const errorCodeCount = sqlDb.prepare('SELECT COUNT(*) as count FROM error_codes').get().count;
if (errorCodeCount === 0) {
  const insertErrorCode = sqlDb.prepare(`
    INSERT INTO error_codes (code, name, description, cause, resolution, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const INITIAL_ERRORS = [
    {
      code: 400,
      name: 'Bad Request',
      description: 'The server could not understand or parse the request due to malformed payload or missing parameters.',
      cause: 'Invalid JSON body, missing required query field, or corrupted request headers.',
      resolution: 'Verify JSON structure, ensure required fields (e.g. messages array) are provided, and retry.',
      category: 'Client Error'
    },
    {
      code: 401,
      name: 'Unauthorized',
      description: 'Authentication is required and has failed or has not yet been provided.',
      cause: 'Missing or invalid Gemini API Key or authentication token.',
      resolution: 'Enter your valid Google AI Studio Gemini API Key in the Settings modal or .env file.',
      category: 'Client Error'
    },
    {
      code: 403,
      name: 'Forbidden',
      description: 'The server understands the request but refuses to authorize access.',
      cause: 'Insufficient permissions, restricted directory traversal attempt, or IP access block.',
      resolution: 'Check your access permissions or contact the system administrator.',
      category: 'Client Error'
    },
    {
      code: 404,
      name: 'Not Found',
      description: 'The requested resource, page, or API endpoint could not be found on the server.',
      cause: 'Typo in URL path, deprecated endpoint, or deleted document.',
      resolution: 'Check the URL spelling, navigate back to Home, or ask the AI Assistant for help.',
      category: 'Client Error'
    },
    {
      code: 429,
      name: 'Too Many Requests',
      description: 'Rate limit exceeded. The user has sent too many requests in a given amount of time.',
      cause: 'Burst API calls exceeding Google Gemini free-tier quota (15 RPM) or client spam.',
      resolution: 'Wait 30-60 seconds before sending your next request, or upgrade your API tier.',
      category: 'Client Error'
    },
    {
      code: 500,
      name: 'Internal Server Error',
      description: 'The server encountered an unexpected condition that prevented it from fulfilling the request.',
      cause: 'Unhandled backend exception, database query crash, or third-party upstream failure.',
      resolution: 'Check server terminal logs, verify database integrity, or submit a support ticket.',
      category: 'Server Error'
    },
    {
      code: 503,
      name: 'Service Unavailable',
      description: 'The server is currently unable to handle the request due to temporary maintenance or upstream outage.',
      cause: 'Gemini upstream API degradation, database lock contention, or server restart in progress.',
      resolution: 'Wait a few moments and refresh. The system will recover automatically.',
      category: 'Server Error'
    },
    {
      code: 599,
      name: 'Praveen Core Protocol Timeout (Site-Specific)',
      description: 'A site-specific timeout error triggered when the IoT telemetry bridge or microservice external sync exceeds the 2000ms safety window.',
      cause: 'Edge hardware offline, slow Wi-Fi signal on NodeMCU controller, or external third-party API timeout.',
      resolution: 'The server automatically activates local cached fallbacks. Check IoT network status on the Health page.',
      category: 'Site-Specific Error'
    }
  ];

  INITIAL_ERRORS.forEach(err => {
    insertErrorCode.run(err.code, err.name, err.description, err.cause, err.resolution, err.category);
  });
}

// SQL Helper Methods
export const sql = {
  getAllFaqs(search = '', category = '') {
    let query = 'SELECT * FROM faqs WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search && search.trim()) {
      query += ' AND (question LIKE ? OR answer LIKE ? OR keywords LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY id ASC';
    return sqlDb.prepare(query).all(...params);
  },

  getAllErrorCodes() {
    return sqlDb.prepare('SELECT * FROM error_codes ORDER BY code ASC').all();
  },

  getErrorCode(code) {
    return sqlDb.prepare('SELECT * FROM error_codes WHERE code = ?').get(parseInt(code));
  },

  createSupportTicket({ userName = 'Anonymous', email = '', subject, description, priority = 'Normal' }) {
    const ticketCode = `TICK-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const stmt = sqlDb.prepare(`
      INSERT INTO support_tickets (ticket_code, user_name, email, subject, description, priority, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Open')
    `);
    stmt.run(ticketCode, userName, email, subject, description, priority);
    return { ticketCode, status: 'Open', message: 'Support ticket successfully filed in SQL database.' };
  },

  getAllTickets() {
    return sqlDb.prepare('SELECT * FROM support_tickets ORDER BY id DESC').all();
  },

  getStats() {
    const faqs = sqlDb.prepare('SELECT COUNT(*) as c FROM faqs').get().c;
    const errors = sqlDb.prepare('SELECT COUNT(*) as c FROM error_codes').get().c;
    const tickets = sqlDb.prepare('SELECT COUNT(*) as c FROM support_tickets').get().c;
    return { faqs, errors, tickets };
  }
};

// ============================================================================
// 2. MONGODB CLIENT WITH RESILIENT LOCAL DOCUMENT STORE FALLBACK
// ============================================================================
let mongoClient = null;
let mongoDbInstance = null;
let mongoConnected = false;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/praveen_portfolio';

async function initMongo() {
  try {
    mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    await mongoClient.connect();
    mongoDbInstance = mongoClient.db();
    mongoConnected = true;
    console.log('🍃 MongoDB connected successfully:', MONGODB_URI);
  } catch (err) {
    mongoConnected = false;
    console.log('ℹ️  MongoDB daemon not reachable, using persistent local document store fallback.');
  }
}
initMongo();

// Fallback file helpers
const CHAT_LOGS_FILE = path.join(MONGO_FALLBACK_DIR, 'chat_logs.json');
const FEEDBACK_FILE = path.join(MONGO_FALLBACK_DIR, 'feedback.json');

function readFallback(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function appendFallback(file, item) {
  const list = readFallback(file);
  list.unshift({ ...item, _id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6) });
  // Keep last 1000 records
  if (list.length > 1000) list.pop();
  fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
}

export const mongo = {
  async logChat({ conversationId, userPrompt, assistantResponse, ip, userAgent, model }) {
    const doc = {
      conversationId,
      userPrompt,
      assistantResponse,
      ip: ip || '127.0.0.1',
      userAgent: userAgent || 'Unknown',
      model: model || 'gemini-2.0-flash',
      timestamp: new Date().toISOString()
    };

    if (mongoConnected && mongoDbInstance) {
      try {
        await mongoDbInstance.collection('chat_logs').insertOne(doc);
        return;
      } catch (e) {
        console.warn('MongoDB write error, writing to fallback:', e.message);
      }
    }
    appendFallback(CHAT_LOGS_FILE, doc);
  },

  async logFeedback({ conversationId, rating, comment, ip }) {
    const doc = {
      conversationId: conversationId || 'general',
      rating: parseInt(rating) || 5, // 1 to 5 or thumb rating
      comment: comment || '',
      ip: ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    };

    if (mongoConnected && mongoDbInstance) {
      try {
        await mongoDbInstance.collection('feedback').insertOne(doc);
        return;
      } catch (e) {
        console.warn('MongoDB feedback write error, writing to fallback:', e.message);
      }
    }
    appendFallback(FEEDBACK_FILE, doc);
  },

  async getRecentChatLogs(limit = 20) {
    if (mongoConnected && mongoDbInstance) {
      try {
        return await mongoDbInstance.collection('chat_logs').find().sort({ timestamp: -1 }).limit(limit).toArray();
      } catch (e) {}
    }
    return readFallback(CHAT_LOGS_FILE).slice(0, limit);
  },

  async getRecentFeedback(limit = 20) {
    if (mongoConnected && mongoDbInstance) {
      try {
        return await mongoDbInstance.collection('feedback').find().sort({ timestamp: -1 }).limit(limit).toArray();
      } catch (e) {}
    }
    return readFallback(FEEDBACK_FILE).slice(0, limit);
  },

  getStatus() {
    const fallbackLogs = readFallback(CHAT_LOGS_FILE).length;
    const fallbackFeedback = readFallback(FEEDBACK_FILE).length;
    return {
      connected: mongoConnected,
      mode: mongoConnected ? 'MongoDB Server' : 'Persistent Local Document Store Fallback',
      totalLogs: fallbackLogs,
      totalFeedback: fallbackFeedback
    };
  }
};
