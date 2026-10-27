/**
 * PRAVEEN.A // Universal Global AI Chat Widget
 * Embedded across every page of the portfolio.
 * Features:
 * - Direct Gemini 2.0 streaming via /api/chat
 * - SQL-grounded FAQs & Error Codes (400, 401, 403, 404, 429, 500, 503, 599)
 * - Automated Support Ticket filing in SQL database
 * - User Feedback logging directly to MongoDB
 */

(function () {
  'use strict';

  // Inject Chat Widget CSS
  if (!document.getElementById('chat-widget-styles')) {
    const link = document.createElement('link');
    link.id = 'chat-widget-styles';
    link.rel = 'stylesheet';
    link.href = 'chat-widget.css';
    document.head.appendChild(link);
  }

  // Generate or retrieve conversation ID
  let conversationId = sessionStorage.getItem('praveen_chat_conv_id');
  if (!conversationId) {
    conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    sessionStorage.setItem('praveen_chat_conv_id', conversationId);
  }

  // Conversation history array
  const conversationMessages = [];

  // Build and insert widget DOM
  function createWidgetDom() {
    if (document.getElementById('praveen-chat-widget')) return;

    const widgetDiv = document.createElement('div');
    widgetDiv.id = 'praveen-chat-widget';
    widgetDiv.className = 'chat-widget-window';
    widgetDiv.innerHTML = `
      <div class="chat-widget-header">
        <div class="chat-widget-title-group">
          <div class="chat-widget-avatar">✨</div>
          <div>
            <div class="chat-widget-title">AI Assistant</div>
            <div class="chat-widget-subtitle">// SQL &bull; MONGO &bull; GEMINI</div>
          </div>
        </div>
        <div class="chat-widget-actions">
          <a href="ai-assistant.html" class="chat-widget-btn" title="Expand to Full Page" style="text-decoration:none;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>
          </a>
          <button class="chat-widget-btn" id="close-chat-widget" title="Close Widget">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <div class="chat-widget-messages" id="widget-messages">
        <div class="widget-msg assistant">
          <div class="widget-bubble">
            <strong>Greetings!</strong> I am Praveen's AI Assistant. Ask me anything from our <strong>SQL FAQs</strong>, query any <strong>error codes</strong>, or request a <strong>support ticket</strong>!
          </div>
        </div>
      </div>

      <div class="chat-widget-chips">
        <button class="chat-chip" data-prompt="What are Praveen's core technical skills & mechatronics background?">⚡ Skills</button>
        <button class="chat-chip" data-prompt="Explain Praveen's ProtoSem fellowship and IoT tasks 1 to 5.">🔬 IoT &amp; ProtoSem</button>
        <button class="chat-chip" data-prompt="Explain site-specific Error Code 599 and how to resolve it.">⚠️ Error 599</button>
        <button class="chat-chip" data-prompt="Please create a support ticket for technical inquiry.">🎫 Create Ticket</button>
      </div>

      <div class="chat-widget-input-area">
        <textarea id="widget-input-box" class="widget-input" placeholder="Ask anything..." rows="1"></textarea>
        <button id="widget-send-btn" class="widget-send-btn" title="Send Question">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    `;

    document.body.appendChild(widgetDiv);
    bindWidgetEvents(widgetDiv);
  }

  function bindWidgetEvents(widgetDiv) {
    const closeBtn = document.getElementById('close-chat-widget');
    const input = document.getElementById('widget-input-box');
    const sendBtn = document.getElementById('widget-send-btn');
    const messagesContainer = document.getElementById('widget-messages');

    closeBtn.addEventListener('click', () => {
      widgetDiv.classList.remove('open');
    });

    // Intercept floating HUD click to toggle widget on this page!
    const floatingHud = document.getElementById('floating-ai-hud');
    if (floatingHud) {
      floatingHud.addEventListener('click', (e) => {
        // If not already on ai-assistant.html, open popup widget
        if (!window.location.pathname.endsWith('ai-assistant.html')) {
          e.preventDefault();
          widgetDiv.classList.toggle('open');
          if (widgetDiv.classList.contains('open')) {
            input.focus();
          }
        }
      });
    }

    sendBtn.addEventListener('click', () => sendWidgetMessage());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendWidgetMessage();
      }
    });

    // Preset chip clicks
    widgetDiv.querySelectorAll('.chat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        input.value = chip.getAttribute('data-prompt');
        sendWidgetMessage();
      });
    });
  }

  async function sendWidgetMessage() {
    const input = document.getElementById('widget-input-box');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    const messagesContainer = document.getElementById('widget-messages');

    // Append User Message
    const userMsg = document.createElement('div');
    userMsg.className = 'widget-msg user';
    userMsg.innerHTML = `<div class="widget-bubble">${escapeHtml(text)}</div>`;
    messagesContainer.appendChild(userMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    conversationMessages.push({ role: 'user', content: text });

    // Assistant Placeholder
    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'widget-msg assistant';
    assistantMsg.innerHTML = `
      <div class="widget-bubble"><span style="color:var(--accent-red,#ff224e);">Thinking...</span></div>
    `;
    messagesContainer.appendChild(assistantMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const bubble = assistantMsg.querySelector('.widget-bubble');

    try {
      // Check for user-saved key in localStorage
      const userApiKey = localStorage.getItem('praveen_gemini_api_key') || localStorage.getItem('gemini_lumina_api_key') || '';
      const headers = { 'Content-Type': 'application/json' };
      if (userApiKey) headers['x-gemini-key'] = userApiKey;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: conversationMessages,
          conversationId
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

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
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulated += parsed.text;
                bubble.innerHTML = formatSimpleMarkdown(accumulated);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
              }
            } catch (e) {}
          }
        }
      }

      conversationMessages.push({ role: 'assistant', content: accumulated });

      // Append Feedback Buttons (stored in MongoDB)
      const feedbackRow = document.createElement('div');
      feedbackRow.className = 'widget-feedback-row';
      feedbackRow.innerHTML = `
        <span>Was this helpful?</span>
        <button class="widget-feedback-btn thumb-up" title="Helpful (Logs to MongoDB)">👍</button>
        <button class="widget-feedback-btn thumb-down" title="Not helpful (Logs to MongoDB)">👎</button>
        <span class="fb-status" style="margin-left: 4px; color: var(--hud-green,#10b981);"></span>
      `;
      assistantMsg.appendChild(feedbackRow);

      const btnUp = feedbackRow.querySelector('.thumb-up');
      const btnDown = feedbackRow.querySelector('.thumb-down');
      const fbStatus = feedbackRow.querySelector('.fb-status');

      btnUp.addEventListener('click', () => sendFeedback(5, 'User clicked thumbs up', fbStatus, [btnUp, btnDown]));
      btnDown.addEventListener('click', () => sendFeedback(1, 'User clicked thumbs down', fbStatus, [btnUp, btnDown]));

    } catch (err) {
      bubble.innerHTML = `<span style="color:var(--accent-red,#ff224e);">⚠️ ${err.message}</span>`;
      if (err.message.includes('API Key') || err.message.includes('401')) {
        bubble.innerHTML += `<div style="margin-top:6px;"><a href="ai-assistant.html" style="color:#fff; text-decoration:underline;">Configure Gemini API Key &rarr;</a></div>`;
      }
    }
  }

  // Submit Feedback to MongoDB
  async function sendFeedback(rating, comment, statusEl, buttons) {
    buttons.forEach(b => b.disabled = true);
    statusEl.textContent = 'Saving...';
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          rating,
          comment
        })
      });
      if (res.ok) {
        statusEl.textContent = 'Feedback saved in MongoDB!';
      }
    } catch (e) {
      statusEl.textContent = 'Logged locally.';
    }
  }

  function formatSimpleMarkdown(str) {
    if (!str) return '';
    return str
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(255,34,78,0.15); padding:1px 4px; border-radius:3px;">$1</code>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidgetDom);
  } else {
    createWidgetDom();
  }

})();
