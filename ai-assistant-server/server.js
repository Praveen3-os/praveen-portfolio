import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Available Gemini models
const AVAILABLE_MODELS = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    tag: 'Fastest & Next-Gen',
    description: 'Ultra-fast multimodal reasoning, coding, and general tasks',
    recommended: true
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    tag: 'High Speed & Lightweight',
    description: 'Optimized for speed and efficiency with high context window',
    recommended: false
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    tag: 'Deep Reasoning',
    description: 'Complex multi-step reasoning, mathematical queries, and deep analysis',
    recommended: false
  }
];

// Helper to get active API key
function getEffectiveKey(req) {
  const headerKey = req.headers['x-gemini-key'];
  if (headerKey && typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }
  if (req.body && req.body.apiKey && typeof req.body.apiKey === 'string' && req.body.apiKey.trim()) {
    return req.body.apiKey.trim();
  }
  return process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
}

// Check configuration status
app.get('/api/config', (req, res) => {
  const hasServerKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  res.json({
    hasServerKey,
    defaultModel: 'gemini-2.0-flash',
    availableModels: AVAILABLE_MODELS
  });
});

// Verify API Key
app.post('/api/verify-key', async (req, res) => {
  const apiKey = getEffectiveKey(req);
  if (!apiKey) {
    return res.status(400).json({ valid: false, error: 'No API key provided' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        valid: false,
        error: data.error?.message || 'Invalid Gemini API Key'
      });
    }

    return res.json({
      valid: true,
      message: 'API Key successfully verified with Google AI Studio!'
    });
  } catch (error) {
    return res.status(500).json({
      valid: false,
      error: `Connection error: ${error.message}`
    });
  }
});

// Stream chat completion via SSE
app.post('/api/chat', async (req, res) => {
  const apiKey = getEffectiveKey(req);
  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing Gemini API Key. Please provide a key in settings or set GEMINI_API_KEY in .env.'
    });
  }

  const {
    messages = [],
    model = 'gemini-2.0-flash',
    systemPrompt = '',
    temperature = 0.7,
    maxOutputTokens = 4096
  } = req.body;

  if (!messages.length) {
    return res.status(400).json({ error: 'Messages array cannot be empty.' });
  }

  // Format contents for Gemini REST API
  // Gemini expects: { role: 'user' | 'model', parts: [{ text: '...' }, { inlineData: ... }] }
  const formattedContents = messages.map(msg => {
    const parts = [];

    // If there is an image attached
    if (msg.image && msg.image.data && msg.image.mimeType) {
      parts.push({
        inlineData: {
          mimeType: msg.image.mimeType,
          data: msg.image.data // Base64 without header
        }
      });
    }

    if (msg.content) {
      parts.push({ text: msg.content });
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts
    };
  });

  const requestPayload = {
    contents: formattedContents,
    generationConfig: {
      temperature: parseFloat(temperature) || 0.7,
      maxOutputTokens: parseInt(maxOutputTokens) || 4096,
      topP: 0.95
    }
  };

  if (systemPrompt && systemPrompt.trim()) {
    requestPayload.systemInstruction = {
      parts: [{ text: systemPrompt.trim() }]
    };
  }

  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  try {
    const geminiRes = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!geminiRes.ok) {
      const errorData = await geminiRes.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Gemini API returned status ${geminiRes.status}`;
      return res.status(geminiRes.status).json({ error: errorMessage });
    }

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const reader = geminiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const candidate = parsed.candidates?.[0];
            const textPart = candidate?.content?.parts?.[0]?.text;

            if (textPart) {
              res.write(`data: ${JSON.stringify({ text: textPart })}\n\n`);
            }

            if (candidate?.finishReason) {
              res.write(`data: ${JSON.stringify({ finishReason: candidate.finishReason })}\n\n`);
            }
          } catch (e) {
            // Ignore parse errors on partial chunks
          }
        }
      }
    }

    // End of stream
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Streaming error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: `Internal error: ${error.message}` });
    }
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`✨ Gemini AI Assistant server running on http://localhost:${PORT}`);
});
