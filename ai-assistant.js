/**
 * PRAVEEN.A // AI Command Assistant Script
 * Direct streaming via Google Gemini API (Gemini 2.0 Flash / 1.5 Pro)
 * Preloaded with Praveen's Mechatronics Portfolio context & capable of answering ANY question.
 */

(function () {
  'use strict';

  // Knowledge base about Praveen A baked into the system prompt
  const PRAVEEN_SYSTEM_PROMPT = `You are "Lumina — Praveen's AI Command Assistant", an intelligent cybernetic AI embedded inside the Personal Command Center & Portfolio of PRAVEEN. A.

Your mission:
1. Answer ANY question the user asks with deep intelligence, technical accuracy, and clarity (including software engineering, mechatronics, robotics, physics, algorithms, and general questions).
2. You also possess comprehensive knowledge of Praveen A and his portfolio, and can answer detailed questions about him:
   - Profile: Praveen A is a Mechatronics Engineering student, Full Stack Developer, AI Prompt Engineer, and Robotics/Industrial Automation enthusiast.
   - Personality: INFJ-T (Advocate) on the 16 Personalities scale — combining analytical rigor with purposeful innovation.
   - Core Domains: Mechatronics, Robotics, Industrial Automation, PLC (Programmable Logic Controllers), Embedded Systems (NodeMCU, ESP32, Arduino), Full Stack Web Development (JavaScript, React, Node.js, HTML5/CSS3), and Intelligent Cyber-Physical Systems.
   - ProtoSem Fellowship: A rigorous fellowship at KCT Forge focused on prototyping, real-world engineering problem solving, and technological innovation.
   - IoT Session & Practical Tasks:
     * Task 1: Microcontroller telemetry & firmware foundations (NodeMCU/ESP8266 setup).
     * Task 2: Environmental sensor interfacing & data acquisition (DHT temperature/humidity).
     * Task 3: Actuator control, relays, and motor driving systems.
     * Task 4: Cloud MQTT protocol communication & live IoT dashboard visualization.
     * Task 5: Autonomous cyber-physical IoT closed-loop control system.
   - Industrial Research: Failure mode analysis, material selection improvements (marine-grade alloys), and automated manufacturing setups.
   - Contact & Collaboration: Visitors can reach out via the Contact page or email him for engineering projects and technical collaborations.

Tone & Style:
- Professional, futuristic, articulate, and engineering-focused (command center HUD aesthetic).
- Use clean Markdown with code blocks, bullet points, and bold terms where helpful.
- If asked about Praveen, speak enthusiastically and accurately about his work. If asked any other question (science, code, life, history, math), answer thoroughly and accurately.`;

  // Application State
  const state = {
    apiKey: localStorage.getItem('praveen_gemini_api_key') || '',
    model: localStorage.getItem('praveen_gemini_model') || 'gemini-2.0-flash',
    temperature: 0.7,
    messages: [],
    attachedImage: null, // { data: base64, mimeType: string, name: string }
    isGenerating: false,
    abortController: null,
    isListening: false
  };

  // DOM Elements
  const els = {
    stream: document.getElementById('ai-messages-stream'),
    textarea: document.getElementById('ai-textarea'),
    sendBtn: document.getElementById('ai-send-btn'),
    voiceBtn: document.getElementById('ai-voice-btn'),
    attachBtn: document.getElementById('ai-attach-btn'),
    fileInput: document.getElementById('ai-file-input'),
    attachmentBar: document.getElementById('ai-attachment-bar'),
    attachmentName: document.getElementById('ai-attachment-name'),
    removeAttachmentBtn: document.getElementById('ai-remove-attachment'),
    modelSelect: document.getElementById('ai-model-select'),
    telemetryModel: document.getElementById('ai-telemetry-model'),
    openSettingsBtn: document.getElementById('ai-open-settings'),
    settingsModal: document.getElementById('ai-settings-modal'),
    closeSettingsBtn: document.getElementById('ai-close-settings'),
    apiKeyInput: document.getElementById('ai-api-key-input'),
    saveKeyBtn: document.getElementById('ai-save-key-btn'),
    testKeyBtn: document.getElementById('ai-test-key-btn'),
    keyFeedback: document.getElementById('ai-key-feedback')
  };

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    initPresetChips();
    initChatHandlers();
    initSettingsModal();
    initVoiceRecognition();
    updateTelemetry();

    // Welcome greeting if empty
    if (state.messages.length === 0) {
      appendAssistantMessage(
        "**[SYSTEM ONLINE]** Greetings, Commander! I am **Lumina**, Praveen's AI Command Assistant powered by Google Gemini.\n\nAsk me **anything** — whether you're curious about Praveen's Mechatronics background, his ProtoSem & IoT projects, or need help with complex coding, robotics algorithms, and engineering queries!"
      );
    }
  });

  // ==========================================================================
  // Preset Chips
  // ==========================================================================
  function initPresetChips() {
    const chips = document.querySelectorAll('.ai-preset-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
          els.textarea.value = prompt;
          autoResizeTextarea();
          submitUserMessage();
        }
      });
    });
  }

  // ==========================================================================
  // Chat Handlers & Streaming
  // ==========================================================================
  function initChatHandlers() {
    // Send click
    els.sendBtn.addEventListener('click', () => submitUserMessage());

    // Enter key (Shift+Enter for new line)
    els.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitUserMessage();
      }
    });

    // Auto-resize
    els.textarea.addEventListener('input', autoResizeTextarea);

    // Multimodal Image Attachment
    els.attachBtn.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processSelectedImage(e.target.files[0]);
      }
    });

    els.removeAttachmentBtn.addEventListener('click', clearAttachment);

    // Clipboard paste support for screenshots
    window.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          processSelectedImage(items[i].getAsFile());
          break;
        }
      }
    });

    // Model selection
    if (els.modelSelect) {
      els.modelSelect.value = state.model;
      els.modelSelect.addEventListener('change', (e) => {
        state.model = e.target.value;
        localStorage.setItem('praveen_gemini_model', state.model);
        updateTelemetry();
      });
    }
  }

  function processSelectedImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target.result;
      const base64Data = base64Url.split(',')[1];
      state.attachedImage = {
        data: base64Data,
        mimeType: file.type,
        name: file.name
      };
      els.attachmentName.textContent = `Attached: ${file.name} (${Math.round(file.size / 1024)} KB)`;
      els.attachmentBar.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }

  function clearAttachment() {
    state.attachedImage = null;
    els.attachmentBar.style.display = 'none';
    els.fileInput.value = '';
  }

  function autoResizeTextarea() {
    const el = els.textarea;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  async function submitUserMessage() {
    const text = els.textarea.value.trim();
    if (!text && !state.attachedImage) return;
    if (state.isGenerating) return;

    if (!state.apiKey) {
      openSettings();
      showKeyFeedback('Please enter your Google Gemini API key to begin chatting.', false);
      return;
    }

    // Append User Message to UI
    appendUserMessage(text, state.attachedImage);

    // Store in history
    const userMsgObj = { role: 'user', content: text };
    if (state.attachedImage) {
      userMsgObj.image = { ...state.attachedImage };
    }
    state.messages.push(userMsgObj);

    // Reset input
    els.textarea.value = '';
    autoResizeTextarea();
    clearAttachment();

    // Stream Gemini response
    await streamGeminiResponse();
  }

  function appendUserMessage(text, imageObj) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-message user';

    let imageHtml = '';
    if (imageObj && imageObj.data) {
      imageHtml = `<div class="ai-attached-preview"><img src="data:${imageObj.mimeType};base64,${imageObj.data}" alt="Attachment"></div>`;
    }

    wrapper.innerHTML = `
      <div class="ai-msg-avatar">YOU</div>
      <div class="ai-msg-body">
        <div class="ai-msg-content">
          ${imageHtml}
          <div>${escapeHtml(text).replace(/\n/g, '<br>')}</div>
        </div>
      </div>
    `;

    els.stream.appendChild(wrapper);
    scrollToBottom();
  }

  function appendAssistantMessage(initialText = '') {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-message assistant';
    wrapper.innerHTML = `
      <div class="ai-msg-avatar">AI</div>
      <div class="ai-msg-body">
        <div class="ai-msg-content">${formatMarkdown(initialText)}</div>
        <div class="ai-msg-actions">
          <button class="ai-action-btn copy-btn" title="Copy response">
            <span>Copy</span>
          </button>
          <button class="ai-action-btn speak-btn" title="Read aloud">
            <span>Speak</span>
          </button>
        </div>
      </div>
    `;

    setupMessageActions(wrapper, initialText);
    els.stream.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  }

  async function streamGeminiResponse() {
    state.isGenerating = true;
    state.abortController = new AbortController();
    els.sendBtn.style.opacity = '0.5';

    // Create assistant placeholder
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-message assistant';
    wrapper.innerHTML = `
      <div class="ai-msg-avatar">AI</div>
      <div class="ai-msg-body">
        <div class="ai-msg-content"><span class="ai-typing-cursor"></span></div>
      </div>
    `;
    els.stream.appendChild(wrapper);
    scrollToBottom();

    const contentDiv = wrapper.querySelector('.ai-msg-content');
    let fullText = '';

    // Format Gemini payload
    const contents = state.messages.map(m => {
      const parts = [];
      if (m.image && m.image.data) {
        parts.push({
          inlineData: {
            mimeType: m.image.mimeType,
            data: m.image.data
          }
        });
      }
      if (m.content) parts.push({ text: m.content });
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${state.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(state.apiKey)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: PRAVEEN_SYSTEM_PROMPT }]
          },
          generationConfig: {
            temperature: state.temperature,
            topP: 0.95,
            maxOutputTokens: 4096
          }
        }),
        signal: state.abortController.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `API error ${response.status}`);
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
            const dataStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataStr);
              const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (chunk) {
                fullText += chunk;
                contentDiv.innerHTML = formatMarkdown(fullText) + '<span class="ai-typing-cursor"></span>';
                scrollToBottom();
              }
            } catch (e) {}
          }
        }
      }

      // Finalize
      contentDiv.innerHTML = formatMarkdown(fullText);
      state.messages.push({ role: 'assistant', content: fullText });

      // Add actions
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'ai-msg-actions';
      actionsDiv.innerHTML = `
        <button class="ai-action-btn copy-btn" title="Copy response"><span>Copy</span></button>
        <button class="ai-action-btn speak-btn" title="Read aloud"><span>Speak</span></button>
      `;
      wrapper.querySelector('.ai-msg-body').appendChild(actionsDiv);
      setupMessageActions(wrapper, fullText);

    } catch (err) {
      if (err.name !== 'AbortError') {
        const errText = `⚠️ **Error communicating with Gemini:** ${err.message}`;
        contentDiv.innerHTML = formatMarkdown(errText);
      }
    } finally {
      state.isGenerating = false;
      els.sendBtn.style.opacity = '1';
      scrollToBottom();
    }
  }

  function setupMessageActions(wrapper, text) {
    const copyBtn = wrapper.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text);
        const span = copyBtn.querySelector('span');
        span.textContent = 'Copied!';
        setTimeout(() => { span.textContent = 'Copy'; }, 1800);
      });
    }

    const speakBtn = wrapper.querySelector('.speak-btn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        toggleSpeech(text, speakBtn);
      });
    }

    // Code copy buttons inside this message
    const codeWrappers = wrapper.querySelectorAll('.ai-code-block');
    codeWrappers.forEach(block => {
      const btn = block.querySelector('.ai-code-copy');
      const pre = block.querySelector('pre');
      if (btn && pre) {
        btn.addEventListener('click', () => {
          navigator.clipboard.writeText(pre.innerText);
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy Code'; }, 1800);
        });
      }
    });
  }

  // ==========================================================================
  // Text to Speech & Speech Recognition
  // ==========================================================================
  function toggleSpeech(text, btn) {
    if (!('speechSynthesis' in window)) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (btn) btn.querySelector('span').textContent = 'Speak';
      return;
    }

    const clean = text.replace(/```[\s\S]*?```/g, '').replace(/[*_#]/g, '');
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;

    utterance.onstart = () => { if (btn) btn.querySelector('span').textContent = 'Stop'; };
    utterance.onend = () => { if (btn) btn.querySelector('span').textContent = 'Speak'; };
    utterance.onerror = () => { if (btn) btn.querySelector('span').textContent = 'Speak'; };

    window.speechSynthesis.speak(utterance);
  }

  function initVoiceRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      if (els.voiceBtn) els.voiceBtn.style.display = 'none';
      return;
    }

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      state.isListening = true;
      els.voiceBtn.classList.add('recording');
      els.textarea.placeholder = 'Listening... Speak your question.';
    };

    rec.onresult = (e) => {
      let phrase = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        phrase += e.results[i][0].transcript;
      }
      els.textarea.value = phrase;
      autoResizeTextarea();
    };

    rec.onend = () => {
      state.isListening = false;
      els.voiceBtn.classList.remove('recording');
      els.textarea.placeholder = 'Ask anything (Enter to send, Shift+Enter for new line)...';
    };

    rec.onerror = () => {
      state.isListening = false;
      els.voiceBtn.classList.remove('recording');
    };

    els.voiceBtn.addEventListener('click', () => {
      if (state.isListening) rec.stop();
      else rec.start();
    });
  }

  // ==========================================================================
  // Settings & API Key
  // ==========================================================================
  function initSettingsModal() {
    if (els.openSettingsBtn) els.openSettingsBtn.addEventListener('click', openSettings);
    if (els.closeSettingsBtn) els.closeSettingsBtn.addEventListener('click', closeSettings);

    if (els.saveKeyBtn) {
      els.saveKeyBtn.addEventListener('click', () => {
        const key = els.apiKeyInput.value.trim();
        state.apiKey = key;
        localStorage.setItem('praveen_gemini_api_key', key);
        updateTelemetry();
        showKeyFeedback('Gemini API Key saved locally.', true);
        setTimeout(closeSettings, 1200);
      });
    }

    if (els.testKeyBtn) {
      els.testKeyBtn.addEventListener('click', async () => {
        const key = els.apiKeyInput.value.trim();
        if (!key) {
          showKeyFeedback('Enter a key first', false);
          return;
        }
        els.testKeyBtn.textContent = 'Verifying...';
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
          if (res.ok) {
            showKeyFeedback('API Key verified with Google AI Studio!', true);
          } else {
            const data = await res.json().catch(() => ({}));
            showKeyFeedback(data.error?.message || 'Invalid API key', false);
          }
        } catch (e) {
          showKeyFeedback(`Connection error: ${e.message}`, false);
        } finally {
          els.testKeyBtn.textContent = 'Test Connection';
        }
      });
    }

    // Close on outside click
    els.settingsModal.addEventListener('click', (e) => {
      if (e.target === els.settingsModal) closeSettings();
    });
  }

  function openSettings() {
    els.apiKeyInput.value = state.apiKey;
    els.keyFeedback.style.display = 'none';
    els.settingsModal.classList.add('open');
  }

  function closeSettings() {
    els.settingsModal.classList.remove('open');
  }

  function showKeyFeedback(msg, isSuccess) {
    els.keyFeedback.textContent = msg;
    els.keyFeedback.style.color = isSuccess ? 'var(--hud-green)' : 'var(--accent-red)';
    els.keyFeedback.style.display = 'block';
  }

  function updateTelemetry() {
    if (els.telemetryModel) {
      els.telemetryModel.textContent = state.model.toUpperCase();
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      els.stream.scrollTop = els.stream.scrollHeight;
    });
  }

  // ==========================================================================
  // Simple Lightweight Markdown Parser
  // ==========================================================================
  function formatMarkdown(md) {
    if (!md) return '';

    // Code blocks ```lang ... ```
    let formatted = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || 'code';
      return `
        <div class="ai-code-block">
          <div class="ai-code-header">
            <span>${language}</span>
            <button class="ai-action-btn ai-code-copy" type="button">Copy Code</button>
          </div>
          <pre><code>${escapeHtml(code.trim())}</code></pre>
        </div>
      `;
    });

    // Inline code `...`
    formatted = formatted.replace(/`([^`]+)`/g, '<code style="background: rgba(255,34,78,0.12); padding: 2px 5px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.88em; color: var(--accent-red-bright);">$1</code>');

    // Bold **...**
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic *...*
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Lists (- or *)
    formatted = formatted.replace(/^\s*[-*]\s+(.+)$/gm, '<li style="margin-left: 20px; margin-bottom: 4px;">$1</li>');

    // Headers (###, ##, #)
    formatted = formatted.replace(/^### (.*$)/gim, '<h3 style="color:#fff; margin-top:14px; margin-bottom:6px; font-size:1.1rem;">$1</h3>');
    formatted = formatted.replace(/^## (.*$)/gim, '<h2 style="color:#fff; margin-top:16px; margin-bottom:8px; font-size:1.25rem;">$1</h2>');
    formatted = formatted.replace(/^# (.*$)/gim, '<h1 style="color:#fff; margin-top:18px; margin-bottom:10px; font-size:1.4rem;">$1</h1>');

    // Paragraph breaks
    formatted = formatted.replace(/\n\n/g, '<br><br>');

    return formatted;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

})();
