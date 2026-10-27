/**
 * PRAVEEN.A // Engineering Command Center & Full-Stack Server
 * Features:
 * - Native SQL Database (node:sqlite) for FAQs, Error Codes, and Support Tickets
 * - MongoDB Client (with document fallback) for Chat Logs & User Feedback
 * - Request Logging Middleware & Comprehensive Health Check (/health)
 * - Third-Party API with 2000ms AbortController Timeout & Cached Fallback
 * - Google Gemini AI Assistant with FAQ/Error-Code RAG & Automated SQL Ticket Creation
 * - Custom 404 & 500 Error Handlers with "Ask the Assistant" options
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sql, mongo } from './database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_START_TIME = new Date();

// In-Memory Request Logs (Ring buffer of last 100 requests for Health Monitoring)
const RECENT_REQUESTS = [];
const MAX_LOGS = 100;

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      duration: `${duration}ms`
    };

    RECENT_REQUESTS.unshift(logEntry);
    if (RECENT_REQUESTS.length > MAX_LOGS) RECENT_REQUESTS.pop();

    originalEnd.apply(res, args);
  };

  next();
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(__dirname));

// ============================================================================
// 1. THIRD-PARTY API WITH TIMEOUT & CACHED FALLBACK
// ============================================================================
// Fetches daily engineering/tech quotes from external API with a strict 2000ms timeout
const CACHED_FALLBACK_QUOTE = {
  quote: "The engineer has been, and is, a maker of history.",
  author: "James Kip Finch",
  source: "Offline Engineering Vault (Cached Fallback)",
  fallback: true
};

app.get('/api/third-party-quote', async (req, res) => {
  const controller = new AbortController();
  const timeoutMs = 2000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const start = Date.now();
  try {
    const response = await fetch('https://dummyjson.com/quotes/random', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`External status ${response.status}`);
    const data = await response.json();

    return res.json({
      quote: data.quote,
      author: data.author,
      source: 'DummyJSON External Quotes API',
      latency: `${Date.now() - start}ms`,
      fallback: false
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    console.warn(`Third-party API ${isTimeout ? 'timed out (>2000ms)' : 'failed'}:`, err.message);

    return res.json({
      ...CACHED_FALLBACK_QUOTE,
      latency: `${Date.now() - start}ms`,
      reason: isTimeout ? 'Request timed out after 2000ms limit' : err.message
    });
  }
});

// ============================================================================
// 2. FAQS & ERROR CODES (SQL DATABASE APIS)
// ============================================================================
app.get('/api/faqs', (req, res) => {
  try {
    const { search = '', category = '' } = req.query;
    const faqs = sql.getAllFaqs(search, category);
    res.json({ success: true, count: faqs.length, data: faqs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/error-codes', (req, res) => {
  try {
    const errors = sql.getAllErrorCodes();
    res.json({ success: true, count: errors.length, data: errors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/error-codes/:code', (req, res) => {
  try {
    const error = sql.getErrorCode(req.params.code);
    if (!error) return res.status(404).json({ success: false, error: 'Error code not found' });
    res.json({ success: true, data: error });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 3. SUPPORT TICKETS (SQL DATABASE API)
// ============================================================================
app.post('/api/tickets', (req, res) => {
  try {
    const { userName, email, subject, description, priority } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ success: false, error: 'Subject and description are required.' });
    }

    const result = sql.createSupportTicket({ userName, email, subject, description, priority });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/tickets', (req, res) => {
  try {
    const tickets = sql.getAllTickets();
    res.json({ success: true, count: tickets.length, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 4. USER FEEDBACK & CHAT LOGS (MONGODB APIS)
// ============================================================================
app.post('/api/feedback', async (req, res) => {
  try {
    const { conversationId, rating, comment } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    await mongo.logFeedback({
      conversationId,
      rating,
      comment,
      ip: clientIp
    });

    res.json({ success: true, message: 'Feedback stored in MongoDB.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/feedback', async (req, res) => {
  try {
    const feedbackList = await mongo.getRecentFeedback(25);
    res.json({ success: true, count: feedbackList.length, data: feedbackList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/chat-logs', async (req, res) => {
  try {
    const logs = await mongo.getRecentChatLogs(25);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 5. AI ASSISTANT API WITH FAQ/ERROR-CODE RAG & AUTO TICKET CREATION
// ============================================================================
function getEffectiveKey(req) {
  const headerKey = req.headers['x-gemini-key'];
  if (headerKey && typeof headerKey === 'string' && headerKey.trim()) return headerKey.trim();
  if (req.body && req.body.apiKey && typeof req.body.apiKey === 'string' && req.body.apiKey.trim()) return req.body.apiKey.trim();
  return process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
}

app.post('/api/chat', async (req, res) => {
  const apiKey = getEffectiveKey(req);
  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing Gemini API Key. Configure your key in Settings or .env.'
    });
  }

  const {
    messages = [],
    model = 'gemini-2.0-flash',
    temperature = 0.7,
    conversationId = 'conv_' + Date.now()
  } = req.body;

  if (!messages.length) {
    return res.status(400).json({ error: 'Messages array is empty.' });
  }

  const lastMessage = messages[messages.length - 1];
  const userPrompt = lastMessage.content || '';

  // 1. Check if user explicitly requests support ticket creation
  const isTicketRequest = /create.*ticket|support.*ticket|file.*ticket|contact.*support|human.*help/i.test(userPrompt);

  // 2. Query SQL Database for relevant FAQs & Error Codes (RAG grounding)
  const allFaqs = sql.getAllFaqs();
  const allErrors = sql.getAllErrorCodes();

  // Keyword matching
  const relevantFaqs = allFaqs.filter(faq => {
    const qLower = faq.question.toLowerCase();
    const kLower = (faq.keywords || '').toLowerCase();
    const pLower = userPrompt.toLowerCase();
    const words = pLower.split(/\s+/).filter(w => w.length > 3);
    return words.some(w => qLower.includes(w) || kLower.includes(w));
  }).slice(0, 4);

  // Check if prompt refers to an error code (e.g. 404, 500, 599)
  const errorMatch = userPrompt.match(/\b(400|401|403|404|429|500|503|599)\b/);
  let relevantError = null;
  if (errorMatch) {
    relevantError = sql.getErrorCode(errorMatch[1]);
  }

  // Construct Context-Rich System Instruction
  let systemInstruction = `You are Lumina, the AI Command Assistant for PRAVEEN. A's Engineering Command Center.
Answer whatever question the user asks with technical depth, precision, and clarity.

GROUNDED KNOWLEDGE FROM SQL DATABASE:
`;

  if (relevantFaqs.length > 0) {
    systemInstruction += "\n--- RELEVANT SQL FAQs ---\n";
    relevantFaqs.forEach(f => {
      systemInstruction += `Q: ${f.question}\nA: ${f.answer}\n`;
    });
  }

  if (relevantError) {
    systemInstruction += `\n--- SQL ERROR CODE KNOWLEDGE ---\nError Code ${relevantError.code}: ${relevantError.name}\nDescription: ${relevantError.description}\nProbable Cause: ${relevantError.cause}\nResolution: ${relevantError.resolution}\nCategory: ${relevantError.category}\n`;
  }

  systemInstruction += `\nRULES:
1. If the user asks about Praveen A, his Mechatronics background, ProtoSem, or IoT tasks, answer using the FAQ knowledge above.
2. If the user asks about error codes, explain the code, cause, and resolution using the SQL error knowledge.
3. If you CANNOT answer the user's question, or if the user requests human/support assistance, state clearly that you have filed a Support Ticket, provide the ticket code format, and explain that Praveen will follow up.
4. If an automatic ticket is needed, output the exact token: [CREATE_TICKET: <Subject>] in your response.
`;

  // Auto-generate ticket if user explicitly asked or if marked
  let autoTicket = null;
  if (isTicketRequest) {
    autoTicket = sql.createSupportTicket({
      userName: 'Site Visitor',
      subject: `Inquiry: ${userPrompt.slice(0, 50)}...`,
      description: userPrompt,
      priority: 'Normal'
    });
  }

  // Format contents for Gemini API
  const formattedContents = messages.map(msg => {
    const parts = [];
    if (msg.image && msg.image.data && msg.image.mimeType) {
      parts.push({
        inlineData: {
          mimeType: msg.image.mimeType,
          data: msg.image.data
        }
      });
    }
    if (msg.content) parts.push({ text: msg.content });
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts
    };
  });

  const payload = {
    contents: formattedContents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: parseFloat(temperature) || 0.7,
      maxOutputTokens: 4096,
      topP: 0.95
    }
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  try {
    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}));
      return res.status(geminiRes.status).json({
        error: errData.error?.message || `Gemini API returned status ${geminiRes.status}`
      });
    }

    // Set SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // If auto ticket was created, prepend ticket notice
    if (autoTicket) {
      res.write(`data: ${JSON.stringify({ text: `🎫 **Support Ticket Generated:** \`${autoTicket.ticketCode}\` (Filed in SQL Database)\n\n` })}\n\n`);
    }

    const reader = geminiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = autoTicket ? `🎫 Support Ticket: ${autoTicket.ticketCode}\n\n` : '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textChunk) {
              accumulatedText += textChunk;
              res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
            }
          } catch (e) {}
        }
      }
    }

    // Check if the AI indicated it couldn't answer and wants a ticket
    if (!autoTicket && /cannot answer|unable to answer|unanswered|support ticket|\[CREATE_TICKET/i.test(accumulatedText)) {
      const fallbackTicket = sql.createSupportTicket({
        userName: 'Site Visitor',
        subject: `Unanswered Query: ${userPrompt.slice(0, 40)}`,
        description: `User asked: "${userPrompt}". Assistant could not fully resolve and filed ticket.`,
        priority: 'Normal'
      });
      res.write(`data: ${JSON.stringify({ text: `\n\n*(Automatically filed SQL Support Ticket: **\`${fallbackTicket.ticketCode}\`**)*` })}\n\n`);
      accumulatedText += `\n*(Filed SQL Support Ticket: ${fallbackTicket.ticketCode})*`;
    }

    res.write('data: [DONE]\n\n');
    res.end();

    // Asynchronously log conversation to MongoDB
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    mongo.logChat({
      conversationId,
      userPrompt,
      assistantResponse: accumulatedText,
      ip: clientIp,
      userAgent,
      model
    });

  } catch (err) {
    console.error('Chat error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ============================================================================
// 6. HEALTH CHECK API & DASHBOARD
// ============================================================================
app.get('/api/health', (req, res) => {
  const sqlStats = sql.getStats();
  const mongoStatus = mongo.getStatus();
  const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME.getTime()) / 1000);

  res.json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    memory: process.memoryUsage(),
    databases: {
      sql: {
        engine: 'node:sqlite (Embedded Relational SQL)',
        status: 'CONNECTED',
        counts: sqlStats
      },
      mongodb: {
        engine: 'MongoDB Driver',
        status: mongoStatus.connected ? 'CONNECTED' : 'LOCAL_FALLBACK_ACTIVE',
        mode: mongoStatus.mode,
        totalChatLogs: mongoStatus.totalLogs,
        totalFeedback: mongoStatus.totalFeedback
      }
    },
    apis: {
      gemini: {
        configured: Boolean(process.env.GEMINI_API_KEY),
        defaultModel: 'gemini-2.0-flash'
      },
      thirdParty: {
        endpoint: 'https://dummyjson.com/quotes/random',
        timeoutLimit: '2000ms',
        fallbackAvailable: true
      }
    },
    recentRequestsCount: RECENT_REQUESTS.length,
    recentRequests: RECENT_REQUESTS.slice(0, 15)
  });
});

// Route to manually test / verify 500 error handling
app.get('/trigger-500', (req, res, next) => {
  const err = new Error('Manual test error to trigger custom 500 handler.');
  err.status = 500;
  next(err);
});

// Serve custom 404 page for any unmatched route
app.use((req, res) => {
  res.status(404);
  if (req.accepts('html')) {
    try {
      const html404 = fs.readFileSync(path.join(__dirname, '404.html'), 'utf8');
      return res.type('html').send(html404);
    } catch (e) {}
  }
  res.json({ error: '404 Not Found', path: req.url });
});

// Custom 500 error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(500);
  if (req.accepts('html')) {
    try {
      const html500 = fs.readFileSync(path.join(__dirname, '500.html'), 'utf8');
      return res.type('html').send(html500);
    } catch (e) {}
  }
  res.json({ error: '500 Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`
================================================================
🚀 PRAVEEN.A COMMAND CENTER FULL-STACK PLATFORM RUNNING!
   URL: http://localhost:${PORT}
   Health Check: http://localhost:${PORT}/health.html
   FAQs Page: http://localhost:${PORT}/faqs.html
   Error Codes: http://localhost:${PORT}/errors.html
================================================================
  `);
});
