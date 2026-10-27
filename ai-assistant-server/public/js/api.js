/**
 * Gemini Lumina — API Client
 * Supports both Express backend proxy (with SSE) and direct browser-to-Gemini REST API.
 */

const API = {
  // Check if backend server is available
  async checkBackend() {
    try {
      const res = await fetch('/api/config', { method: 'GET' });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Backend not running, client-side fallback
    }
    return { hasServerKey: false, defaultModel: 'gemini-2.0-flash' };
  },

  // Verify Gemini API Key
  async verifyKey(apiKey) {
    if (!apiKey) throw new Error('Please enter an API Key.');

    // Try backend first
    try {
      const res = await fetch('/api/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Backend failed, test directly with Google AI Studio endpoint
    }

    // Direct Google Gemini validation
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const directRes = await fetch(googleUrl);
    const data = await directRes.json();

    if (!directRes.ok) {
      throw new Error(data.error?.message || 'Invalid Gemini API key or quota exceeded.');
    }

    return { valid: true, message: 'Google Gemini API key verified successfully!' };
  },

  // Stream Chat Completion
  async streamChat({
    messages,
    model = 'gemini-2.0-flash',
    systemPrompt = '',
    temperature = 0.7,
    apiKey = '',
    onChunk,
    onError,
    onFinish,
    signal
  }) {
    // Determine whether to use backend proxy or direct Google REST
    let usedBackend = false;

    try {
      const backendHeaders = { 'Content-Type': 'application/json' };
      if (apiKey) backendHeaders['x-gemini-key'] = apiKey;

      const backendRes = await fetch('/api/chat', {
        method: 'POST',
        headers: backendHeaders,
        body: JSON.stringify({
          messages,
          model,
          systemPrompt,
          temperature,
          apiKey
        }),
        signal
      });

      if (backendRes.ok && backendRes.headers.get('content-type')?.includes('text/event-stream')) {
        usedBackend = true;
        const reader = backendRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataPayload = trimmed.slice(6);
              if (dataPayload === '[DONE]') {
                onFinish && onFinish();
                return;
              }
              try {
                const parsed = JSON.parse(dataPayload);
                if (parsed.text) {
                  onChunk && onChunk(parsed.text);
                }
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                // Ignore chunk parse error
              }
            }
          }
        }
        onFinish && onFinish();
        return;
      } else if (backendRes.status === 401) {
        const errJson = await backendRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Gemini API key is required. Please set it in Settings.');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        onFinish && onFinish();
        return;
      }
      if (usedBackend) {
        onError && onError(err);
        return;
      }
      // If backend failed (e.g. 404 or offline), fallback to direct Google Gemini REST below
    }

    // Direct Google Gemini REST API Fallback
    if (!apiKey) {
      const err = new Error('No API key provided. Please click Settings (⚙️) to enter your Gemini API key.');
      onError && onError(err);
      return;
    }

    try {
      const directEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

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
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts
        };
      });

      const bodyPayload = {
        contents: formattedContents,
        generationConfig: {
          temperature: parseFloat(temperature) || 0.7,
          topP: 0.95,
          maxOutputTokens: 4096
        }
      };

      if (systemPrompt && systemPrompt.trim()) {
        bodyPayload.systemInstruction = {
          parts: [{ text: systemPrompt.trim() }]
        };
      }

      const response = await fetch(directEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Google API returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataPayload = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataPayload);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                onChunk && onChunk(text);
              }
            } catch (e) {
              // Ignore stream chunk parse error
            }
          }
        }
      }
      onFinish && onFinish();
    } catch (err) {
      if (err.name === 'AbortError') {
        onFinish && onFinish();
        return;
      }
      onError && onError(err);
    }
  }
};

window.API = API;
