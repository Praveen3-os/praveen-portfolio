/**
 * Gemini Lumina — Main Application Logic
 * Full chat lifecycle, streaming renderer, local storage persistence,
 * multimodal image handling, voice dictation, speech synthesis & persona switching.
 */

(function () {
  'use strict';

  // System Persona Presets
  const PERSONA_PROMPTS = {
    general: 'You are Lumina, a brilliant, thoughtful, and articulate AI assistant powered by Google Gemini. Answer whatever questions the user asks with utmost precision, helpfulness, and clear explanations.',
    coding: 'You are an elite principal software engineer and systems architect. When answering technical or programming questions, provide robust, idiomatic, production-ready code with concise explanations, best practices, and edge case considerations.',
    concise: 'You are a high-signal executive assistant. Provide direct, succinct, and ultra-concise answers. Avoid unnecessary fluff or repetition.',
    creative: 'You are an imaginative creative writer and thought partner. Use vivid imagery, engaging narrative voice, and compelling storytelling in your answers.',
    academic: 'You are a distinguished scientist and educator. Break down concepts from first principles with rigorous scientific accuracy, structured arguments, and educational clarity.'
  };

  // State Management
  const state = {
    conversations: [],
    currentChatId: null,
    apiKey: localStorage.getItem('gemini_lumina_api_key') || '',
    hasServerKey: false,
    model: localStorage.getItem('gemini_lumina_model') || 'gemini-2.0-flash',
    temperature: parseFloat(localStorage.getItem('gemini_lumina_temp') || '0.7'),
    persona: localStorage.getItem('gemini_lumina_persona') || 'general',
    customSystemPrompt: localStorage.getItem('gemini_lumina_sys_prompt') || '',
    theme: localStorage.getItem('gemini_lumina_theme') || 'dark',
    autoTTS: localStorage.getItem('gemini_lumina_auto_tts') === 'true',
    attachedImage: null, // { data: base64WithoutPrefix, mimeType, name }
    isGenerating: false,
    abortController: null,
    isListening: false
  };

  // DOM Elements
  const els = {
    appLayout: document.getElementById('appLayout'),
    sidebar: document.getElementById('sidebar'),
    toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    historyList: document.getElementById('historyList'),
    conversationTitle: document.getElementById('conversationTitle'),
    renameTitleBtn: document.getElementById('renameTitleBtn'),
    modelSelectorPill: document.getElementById('modelSelectorPill'),
    activeModelName: document.getElementById('activeModelName'),
    keyStatusIndicator: document.getElementById('keyStatusIndicator'),
    keyStatusTitle: document.getElementById('keyStatusTitle'),
    keyStatusSub: document.getElementById('keyStatusSub'),
    keyStatusCard: document.getElementById('keyStatusCard'),
    settingsQuickBtn: document.getElementById('settingsQuickBtn'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    ttsToggleBtn: document.getElementById('ttsToggleBtn'),
    exportChatBtn: document.getElementById('exportChatBtn'),
    clearChatBtn: document.getElementById('clearChatBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeLabel: document.getElementById('themeLabel'),
    shortcutsBtn: document.getElementById('shortcutsBtn'),
    chatContainer: document.getElementById('chatContainer'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    messagesList: document.getElementById('messagesList'),
    scrollBottomBtn: document.getElementById('scrollBottomBtn'),
    apiNoticeBanner: document.getElementById('apiNoticeBanner'),
    bannerSetupKeyBtn: document.getElementById('bannerSetupKeyBtn'),
    personaChips: document.getElementById('personaChips'),
    imagePreviewBar: document.getElementById('imagePreviewBar'),
    previewImage: document.getElementById('previewImage'),
    previewFilename: document.getElementById('previewFilename'),
    removeImageBtn: document.getElementById('removeImageBtn'),
    attachBtn: document.getElementById('attachBtn'),
    fileInput: document.getElementById('fileInput'),
    messageInput: document.getElementById('messageInput'),
    voiceBtn: document.getElementById('voiceBtn'),
    stopBtn: document.getElementById('stopBtn'),
    sendBtn: document.getElementById('sendBtn'),
    charCount: document.getElementById('charCount'),
    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    toggleKeyVisibilityBtn: document.getElementById('toggleKeyVisibilityBtn'),
    testKeyBtn: document.getElementById('testKeyBtn'),
    clearKeyBtn: document.getElementById('clearKeyBtn'),
    verificationStatus: document.getElementById('verificationStatus'),
    modelSelect: document.getElementById('modelSelect'),
    temperatureSlider: document.getElementById('temperatureSlider'),
    tempValueBadge: document.getElementById('tempValueBadge'),
    systemPromptInput: document.getElementById('systemPromptInput'),
    // Shortcuts Modal
    shortcutsModal: document.getElementById('shortcutsModal'),
    closeShortcutsBtn: document.getElementById('closeShortcutsBtn'),
    toastContainer: document.getElementById('toastContainer')
  };

  // Configure Marked.js
  if (window.marked) {
    window.marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: false,
      mangle: false,
      highlight: function (code, lang) {
        if (window.hljs && lang && window.hljs.getLanguage(lang)) {
          try {
            return window.hljs.highlight(code, { language: lang }).value;
          } catch (e) {}
        }
        if (window.hljs) {
          try {
            return window.hljs.highlightAuto(code).value;
          } catch (e) {}
        }
        return code;
      }
    });
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================
  async function init() {
    applyTheme(state.theme);
    loadConversations();
    setupEventListeners();
    updateModelDisplay();
    updateTTSDisplay();

    // Check backend status
    try {
      const config = await window.API.checkBackend();
      state.hasServerKey = config.hasServerKey;
      if (config.availableModels) {
        populateModelDropdown(config.availableModels);
      }
    } catch (e) {
      console.warn('Backend not detected, running in standalone client mode.');
    }

    updateKeyStatusIndicator();

    // Start with last active conversation or new
    if (state.conversations.length > 0) {
      selectConversation(state.conversations[0].id);
    } else {
      createNewConversation();
    }
  }

  // ==========================================================================
  // Conversation Management
  // ==========================================================================
  function loadConversations() {
    try {
      const stored = localStorage.getItem('gemini_lumina_conversations');
      if (stored) {
        state.conversations = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
      state.conversations = [];
    }
  }

  function saveConversations() {
    try {
      localStorage.setItem('gemini_lumina_conversations', JSON.stringify(state.conversations));
    } catch (e) {
      console.error('Failed to save conversations:', e);
    }
  }

  function createNewConversation() {
    const newChat = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: 'New Conversation',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.conversations.unshift(newChat);
    saveConversations();
    renderHistoryList();
    selectConversation(newChat.id);
  }

  function selectConversation(id) {
    state.currentChatId = id;
    const chat = getCurrentChat();

    if (!chat) {
      if (state.conversations.length > 0) {
        selectConversation(state.conversations[0].id);
      } else {
        createNewConversation();
      }
      return;
    }

    els.conversationTitle.textContent = chat.title || 'New Conversation';
    renderHistoryList();
    renderMessages();
    clearAttachedImage();
    els.messageInput.focus();

    // Mobile sidebar auto close
    if (window.innerWidth <= 768) {
      els.sidebar.classList.remove('mobile-open');
    }
  }

  function getCurrentChat() {
    return state.conversations.find(c => c.id === state.currentChatId);
  }

  function deleteConversation(id, event) {
    if (event) event.stopPropagation();
    state.conversations = state.conversations.filter(c => c.id !== id);
    saveConversations();
    showToast('Conversation deleted', 'info');

    if (state.currentChatId === id) {
      if (state.conversations.length > 0) {
        selectConversation(state.conversations[0].id);
      } else {
        createNewConversation();
      }
    } else {
      renderHistoryList();
    }
  }

  function renameCurrentConversation() {
    const chat = getCurrentChat();
    if (!chat) return;

    const newTitle = prompt('Rename conversation:', chat.title);
    if (newTitle && newTitle.trim()) {
      chat.title = newTitle.trim();
      chat.updatedAt = new Date().toISOString();
      saveConversations();
      els.conversationTitle.textContent = chat.title;
      renderHistoryList();
      showToast('Conversation renamed', 'success');
    }
  }

  function renderHistoryList() {
    els.historyList.innerHTML = '';

    if (state.conversations.length === 0) {
      els.historyList.innerHTML = '<div style="padding: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">No conversations yet</div>';
      return;
    }

    state.conversations.forEach(chat => {
      const item = document.createElement('div');
      item.className = 'history-item' + (chat.id === state.currentChatId ? ' active' : '');
      item.innerHTML = `
        <span class="history-item-title" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</span>
        <div class="history-actions">
          <button class="history-action-btn delete" title="Delete chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      item.addEventListener('click', () => selectConversation(chat.id));
      const delBtn = item.querySelector('.delete');
      delBtn.addEventListener('click', (e) => deleteConversation(chat.id, e));

      els.historyList.appendChild(item);
    });
  }

  // ==========================================================================
  // Message Rendering & UI
  // ==========================================================================
  function renderMessages() {
    const chat = getCurrentChat();
    if (!chat || !chat.messages || chat.messages.length === 0) {
      els.welcomeScreen.style.display = 'flex';
      els.messagesList.style.display = 'none';
      els.messagesList.innerHTML = '';
      return;
    }

    els.welcomeScreen.style.display = 'none';
    els.messagesList.style.display = 'flex';
    els.messagesList.innerHTML = '';

    chat.messages.forEach((msg, index) => {
      appendMessageElement(msg, index);
    });

    scrollToBottom();
  }

  function appendMessageElement(msg, index) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${msg.role}`;
    wrapper.dataset.index = index;

    const avatarHtml = msg.role === 'assistant'
      ? `<div class="message-avatar" title="Gemini Lumina">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor"/></svg>
         </div>`
      : `<div class="message-avatar" title="You">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
         </div>`;

    let imageHtml = '';
    if (msg.image && msg.image.data) {
      const mime = msg.image.mimeType || 'image/png';
      imageHtml = `
        <div class="attached-image-view">
          <img src="data:${mime};base64,${msg.image.data}" alt="Attached multimodal image">
        </div>
      `;
    }

    let formattedText = '';
    if (msg.role === 'assistant') {
      formattedText = parseAndDecorateMarkdown(msg.content);
    } else {
      formattedText = escapeHtml(msg.content).replace(/\n/g, '<br>');
    }

    const timeStr = msg.timestamp ? formatTime(msg.timestamp) : '';

    wrapper.innerHTML = `
      ${avatarHtml}
      <div class="message-content-box">
        <div class="message-bubble">
          ${imageHtml}
          <div class="markdown-body">${formattedText}</div>
        </div>
        <div class="message-actions">
          <button class="msg-action-btn copy-msg-btn" title="Copy message text">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
          ${msg.role === 'assistant' ? `
            <button class="msg-action-btn speak-msg-btn" title="Read answer aloud">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              <span>Speak</span>
            </button>
            <button class="msg-action-btn retry-msg-btn" title="Regenerate this answer">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
              <span>Retry</span>
            </button>
          ` : ''}
          <span class="msg-timestamp">${timeStr}</span>
        </div>
      </div>
    `;

    // Copy event
    const copyBtn = wrapper.querySelector('.copy-msg-btn');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(msg.content);
      showToast('Copied to clipboard', 'success');
    });

    // Speak event
    const speakBtn = wrapper.querySelector('.speak-msg-btn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => toggleSpeakText(msg.content, speakBtn));
    }

    // Retry event
    const retryBtn = wrapper.querySelector('.retry-msg-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => regenerateResponse(index));
    }

    // Code copy buttons inside assistant bubble
    setupCodeBlockCopyButtons(wrapper);

    els.messagesList.appendChild(wrapper);
    return wrapper;
  }

  function parseAndDecorateMarkdown(content) {
    if (!window.marked) return escapeHtml(content);

    try {
      let rawHtml = window.marked.parse(content);

      // Wrap <pre><code class="language-xyz"> in a styled header with copy button
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = rawHtml;

      const preElements = tempDiv.querySelectorAll('pre');
      preElements.forEach(pre => {
        const code = pre.querySelector('code');
        let language = 'code';
        if (code) {
          const match = code.className.match(/language-(\w+)/);
          if (match) language = match[1];
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        wrapper.innerHTML = `
          <div class="code-header">
            <span class="code-lang">${language}</span>
            <button class="copy-code-btn" type="button">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copy code</span>
            </button>
          </div>
        `;
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
      });

      return tempDiv.innerHTML;
    } catch (e) {
      return escapeHtml(content);
    }
  }

  function setupCodeBlockCopyButtons(container) {
    const copyBtns = container.querySelectorAll('.copy-code-btn');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const pre = btn.closest('.code-block-wrapper').querySelector('pre');
        if (pre) {
          navigator.clipboard.writeText(pre.innerText);
          const span = btn.querySelector('span');
          const original = span.textContent;
          span.textContent = 'Copied!';
          btn.style.color = 'var(--status-success)';
          setTimeout(() => {
            span.textContent = original;
            btn.style.color = '';
          }, 2000);
        }
      });
    });
  }

  // ==========================================================================
  // Sending Messages & Streaming
  // ==========================================================================
  async function sendMessage(promptText) {
    const text = (promptText !== undefined ? promptText : els.messageInput.value).trim();
    if (!text && !state.attachedImage) return;
    if (state.isGenerating) return;

    // Check if key is configured
    const effectiveKey = getEffectiveApiKey();
    if (!effectiveKey && !state.hasServerKey) {
      openSettings();
      showToast('Please set your Gemini API key to proceed', 'error');
      return;
    }

    const chat = getCurrentChat();
    if (!chat) return;

    // Prepare User Message
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    if (state.attachedImage) {
      userMsg.image = { ...state.attachedImage };
    }

    chat.messages.push(userMsg);

    // Auto-update conversation title from first question
    if (chat.messages.filter(m => m.role === 'user').length === 1) {
      chat.title = text.slice(0, 32) + (text.length > 32 ? '...' : '');
      els.conversationTitle.textContent = chat.title;
    }

    chat.updatedAt = new Date().toISOString();
    saveConversations();
    renderHistoryList();

    // Clear input & image
    els.messageInput.value = '';
    autoResizeInput();
    clearAttachedImage();

    // Switch view to messages
    els.welcomeScreen.style.display = 'none';
    els.messagesList.style.display = 'flex';
    appendMessageElement(userMsg, chat.messages.length - 1);

    // Create Assistant Message Placeholder
    const assistantMsg = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    };
    chat.messages.push(assistantMsg);
    const assistantIndex = chat.messages.length - 1;

    // Create live stream bubble element
    const assistantWrapper = document.createElement('div');
    assistantWrapper.className = 'message-wrapper assistant';
    assistantWrapper.innerHTML = `
      <div class="message-avatar" title="Gemini Lumina">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor"/></svg>
      </div>
      <div class="message-content-box">
        <div class="message-bubble">
          <div class="markdown-body"><span class="typing-cursor"></span></div>
        </div>
      </div>
    `;
    els.messagesList.appendChild(assistantWrapper);
    scrollToBottom();

    const markdownBody = assistantWrapper.querySelector('.markdown-body');

    // Prepare system prompt based on persona or custom
    const systemPrompt = state.customSystemPrompt || PERSONA_PROMPTS[state.persona] || PERSONA_PROMPTS.general;

    setGeneratingState(true);
    state.abortController = new AbortController();

    let fullAnswer = '';

    await window.API.streamChat({
      messages: chat.messages.slice(0, -1), // Everything up to user's question
      model: state.model,
      systemPrompt,
      temperature: state.temperature,
      apiKey: effectiveKey,
      signal: state.abortController.signal,
      onChunk: (chunk) => {
        fullAnswer += chunk;
        assistantMsg.content = fullAnswer;
        markdownBody.innerHTML = parseAndDecorateMarkdown(fullAnswer) + '<span class="typing-cursor"></span>';
        setupCodeBlockCopyButtons(markdownBody);
        scrollToBottom();
      },
      onError: (err) => {
        setGeneratingState(false);
        const errorText = `⚠️ **Error:** ${err.message || 'Something went wrong.'}`;
        assistantMsg.content = errorText;
        markdownBody.innerHTML = parseAndDecorateMarkdown(errorText);
        showToast(err.message, 'error');
        saveConversations();
      },
      onFinish: () => {
        setGeneratingState(false);
        assistantMsg.content = fullAnswer;
        saveConversations();

        // Finalize rendering without cursor, add action bar
        markdownBody.innerHTML = parseAndDecorateMarkdown(fullAnswer);
        setupCodeBlockCopyButtons(assistantWrapper);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        actionsDiv.innerHTML = `
          <button class="msg-action-btn copy-msg-btn" title="Copy message text">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
          <button class="msg-action-btn speak-msg-btn" title="Read answer aloud">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            <span>Speak</span>
          </button>
          <button class="msg-action-btn retry-msg-btn" title="Regenerate this answer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
            <span>Retry</span>
          </button>
          <span class="msg-timestamp">${formatTime(assistantMsg.timestamp)}</span>
        `;
        assistantWrapper.querySelector('.message-content-box').appendChild(actionsDiv);

        actionsDiv.querySelector('.copy-msg-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(fullAnswer);
          showToast('Copied to clipboard', 'success');
        });

        const speakBtn = actionsDiv.querySelector('.speak-msg-btn');
        speakBtn.addEventListener('click', () => toggleSpeakText(fullAnswer, speakBtn));

        actionsDiv.querySelector('.retry-msg-btn').addEventListener('click', () => regenerateResponse(assistantIndex));

        // Auto read answer aloud if enabled
        if (state.autoTTS && fullAnswer) {
          toggleSpeakText(fullAnswer, speakBtn);
        }
      }
    });
  }

  function regenerateResponse(assistantIndex) {
    const chat = getCurrentChat();
    if (!chat || state.isGenerating) return;

    // Find the previous user prompt
    if (assistantIndex <= 0) return;
    const previousUserMsg = chat.messages[assistantIndex - 1];
    if (previousUserMsg.role !== 'user') return;

    // Remove the current assistant message and any subsequent messages
    chat.messages.splice(assistantIndex);
    saveConversations();
    renderMessages();

    // Re-trigger with previous prompt
    sendMessage(previousUserMsg.content);
  }

  function setGeneratingState(generating) {
    state.isGenerating = generating;
    if (generating) {
      els.sendBtn.style.display = 'none';
      els.stopBtn.style.display = 'flex';
      els.messageInput.disabled = true;
    } else {
      els.sendBtn.style.display = 'grid';
      els.stopBtn.style.display = 'none';
      els.messageInput.disabled = false;
      els.messageInput.focus();
    }
  }

  function stopGeneration() {
    if (state.abortController) {
      state.abortController.abort();
    }
    setGeneratingState(false);
    showToast('Generation stopped', 'info');
  }

  // ==========================================================================
  // Multimodal & Image Handling
  // ==========================================================================
  function handleFileSelect(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file (PNG, JPG, WEBP)', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showToast('Image size exceeds 15MB limit', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const base64Url = e.target.result;
      const base64Data = base64Url.split(',')[1];

      state.attachedImage = {
        data: base64Data,
        mimeType: file.type,
        name: file.name
      };

      els.previewImage.src = base64Url;
      els.previewFilename.textContent = file.name;
      els.imagePreviewBar.style.display = 'flex';
      els.messageInput.focus();
    };
    reader.readAsDataURL(file);
  }

  function clearAttachedImage() {
    state.attachedImage = null;
    els.imagePreviewBar.style.display = 'none';
    els.previewImage.src = '';
    els.fileInput.value = '';
  }

  // ==========================================================================
  // Voice Input (Speech Recognition)
  // ==========================================================================
  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      els.voiceBtn.style.display = 'none';
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      state.isListening = true;
      els.voiceBtn.classList.add('recording');
      els.messageInput.placeholder = 'Listening... Speak now.';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      els.messageInput.value = transcript;
      autoResizeInput();
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      state.isListening = false;
      els.voiceBtn.classList.remove('recording');
      els.messageInput.placeholder = 'Ask anything... (Press Enter to send)';
      if (event.error !== 'no-speech') {
        showToast('Voice error: ' + event.error, 'error');
      }
    };

    recognition.onend = () => {
      state.isListening = false;
      els.voiceBtn.classList.remove('recording');
      els.messageInput.placeholder = 'Ask anything... (Press Enter to send)';
    };

    return recognition;
  }

  const speechRecognizer = setupSpeechRecognition();

  function toggleVoiceInput() {
    if (!speechRecognizer) {
      showToast('Speech recognition not supported in this browser', 'error');
      return;
    }

    if (state.isListening) {
      speechRecognizer.stop();
    } else {
      speechRecognizer.start();
    }
  }

  // ==========================================================================
  // Text to Speech (Speech Synthesis)
  // ==========================================================================
  let activeUtterance = null;

  function toggleSpeakText(text, btnElement) {
    if (!('speechSynthesis' in window)) {
      showToast('Text-to-speech not supported in this browser', 'error');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (btnElement) btnElement.querySelector('span').textContent = 'Speak';
      return;
    }

    // Clean markdown before speaking
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_#]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      if (btnElement) btnElement.querySelector('span').textContent = 'Stop';
    };

    utterance.onend = () => {
      if (btnElement) btnElement.querySelector('span').textContent = 'Speak';
    };

    utterance.onerror = () => {
      if (btnElement) btnElement.querySelector('span').textContent = 'Speak';
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  // ==========================================================================
  // UI Helpers & Settings
  // ==========================================================================
  function getEffectiveApiKey() {
    return state.apiKey.trim();
  }

  function updateKeyStatusIndicator() {
    const hasKey = Boolean(getEffectiveApiKey() || state.hasServerKey);
    if (hasKey) {
      els.keyStatusIndicator.className = 'key-status-indicator connected';
      els.keyStatusTitle.textContent = state.hasServerKey ? 'Server Key Active' : 'API Key Ready';
      els.keyStatusSub.textContent = state.model;
      els.apiNoticeBanner.style.display = 'none';
    } else {
      els.keyStatusIndicator.className = 'key-status-indicator';
      els.keyStatusTitle.textContent = 'API Key Needed';
      els.keyStatusSub.textContent = 'Click to configure';
      els.apiNoticeBanner.style.display = 'flex';
    }
  }

  function updateModelDisplay() {
    const modelLabels = {
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
      'gemini-1.5-flash': 'Gemini 1.5 Flash',
      'gemini-1.5-pro': 'Gemini 1.5 Pro'
    };
    els.activeModelName.textContent = modelLabels[state.model] || state.model;
  }

  function updateTTSDisplay() {
    els.ttsToggleBtn.dataset.active = state.autoTTS ? 'true' : 'false';
    els.ttsToggleBtn.title = `Auto Read Answers Aloud (${state.autoTTS ? 'On' : 'Off'})`;
  }

  function populateModelDropdown(models) {
    els.modelSelect.innerHTML = '';
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.name} (${m.tag} — ${m.description})`;
      if (m.id === state.model) opt.selected = true;
      els.modelSelect.appendChild(opt);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    localStorage.setItem('gemini_lumina_theme', theme);
    els.themeLabel.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
  }

  function toggleTheme() {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  }

  function openSettings() {
    els.apiKeyInput.value = state.apiKey;
    els.modelSelect.value = state.model;
    els.temperatureSlider.value = state.temperature;
    els.tempValueBadge.textContent = state.temperature.toFixed(2);
    els.systemPromptInput.value = state.customSystemPrompt;
    els.verificationStatus.style.display = 'none';
    els.settingsModal.classList.add('open');
  }

  function closeSettings() {
    els.settingsModal.classList.remove('open');
  }

  function saveSettings() {
    state.apiKey = els.apiKeyInput.value.trim();
    localStorage.setItem('gemini_lumina_api_key', state.apiKey);

    state.model = els.modelSelect.value;
    localStorage.setItem('gemini_lumina_model', state.model);

    state.temperature = parseFloat(els.temperatureSlider.value);
    localStorage.setItem('gemini_lumina_temp', state.temperature.toString());

    state.customSystemPrompt = els.systemPromptInput.value.trim();
    localStorage.setItem('gemini_lumina_sys_prompt', state.customSystemPrompt);

    updateKeyStatusIndicator();
    updateModelDisplay();
    closeSettings();
    showToast('Settings saved successfully', 'success');
  }

  async function testCurrentKey() {
    const key = els.apiKeyInput.value.trim();
    if (!key) {
      showVerificationStatus('Please enter an API Key first', false);
      return;
    }

    const spinner = els.testKeyBtn.querySelector('.btn-spinner');
    spinner.style.display = 'inline-block';
    els.testKeyBtn.disabled = true;

    try {
      const res = await window.API.verifyKey(key);
      showVerificationStatus(res.message || 'Key verified successfully!', true);
    } catch (err) {
      showVerificationStatus(err.message, false);
    } finally {
      spinner.style.display = 'none';
      els.testKeyBtn.disabled = false;
    }
  }

  function showVerificationStatus(msg, isSuccess) {
    els.verificationStatus.textContent = msg;
    els.verificationStatus.className = 'verification-status ' + (isSuccess ? 'success' : 'error');
    els.verificationStatus.style.display = 'block';
  }

  function clearKey() {
    els.apiKeyInput.value = '';
    state.apiKey = '';
    localStorage.removeItem('gemini_lumina_api_key');
    updateKeyStatusIndicator();
    showVerificationStatus('API Key removed.', true);
  }

  function autoResizeInput() {
    const input = els.messageInput;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    els.charCount.textContent = `${input.value.length} characters`;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      els.chatContainer.scrollTop = els.chatContainer.scrollHeight;
    });
  }

  function exportConversation() {
    const chat = getCurrentChat();
    if (!chat || !chat.messages.length) {
      showToast('No messages to export', 'info');
      return;
    }

    let markdown = `# ${chat.title}\n*Exported from Gemini Lumina on ${new Date().toLocaleString()}*\n\n---\n\n`;
    chat.messages.forEach(m => {
      const sender = m.role === 'assistant' ? '🤖 **Gemini**' : '👤 **You**';
      markdown += `### ${sender} (${formatTime(m.timestamp)})\n\n${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a);
    showToast('Conversation exported', 'success');
  }

  function clearCurrentChat() {
    const chat = getCurrentChat();
    if (!chat) return;

    if (confirm('Are you sure you want to clear all messages in this conversation?')) {
      chat.messages = [];
      saveConversations();
      renderMessages();
      showToast('Conversation cleared', 'info');
    }
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  function setupEventListeners() {
    // Sidebar toggling
    els.toggleSidebarBtn.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        els.sidebar.classList.toggle('mobile-open');
      } else {
        els.sidebar.classList.toggle('collapsed');
      }
    });

    els.closeSidebarBtn.addEventListener('click', () => {
      els.sidebar.classList.remove('mobile-open');
    });

    // New Chat
    els.newChatBtn.addEventListener('click', createNewConversation);

    // Title rename
    els.renameTitleBtn.addEventListener('click', renameCurrentConversation);

    // Top action buttons
    els.exportChatBtn.addEventListener('click', exportConversation);
    els.clearChatBtn.addEventListener('click', clearCurrentChat);
    els.openSettingsBtn.addEventListener('click', openSettings);
    els.settingsQuickBtn.addEventListener('click', openSettings);
    els.bannerSetupKeyBtn.addEventListener('click', openSettings);
    els.modelSelectorPill.addEventListener('click', openSettings);

    // TTS Toggle
    els.ttsToggleBtn.addEventListener('click', () => {
      state.autoTTS = !state.autoTTS;
      localStorage.setItem('gemini_lumina_auto_tts', state.autoTTS.toString());
      updateTTSDisplay();
      showToast(`Auto Read Answers: ${state.autoTTS ? 'Enabled' : 'Disabled'}`, 'info');
    });

    // Theme Toggle
    els.themeToggleBtn.addEventListener('click', toggleTheme);

    // Shortcuts Modal
    els.shortcutsBtn.addEventListener('click', () => els.shortcutsModal.classList.add('open'));
    els.closeShortcutsBtn.addEventListener('click', () => els.shortcutsModal.classList.remove('open'));

    // Settings Modal
    els.closeSettingsBtn.addEventListener('click', closeSettings);
    els.cancelSettingsBtn.addEventListener('click', closeSettings);
    els.saveSettingsBtn.addEventListener('click', saveSettings);
    els.testKeyBtn.addEventListener('click', testCurrentKey);
    els.clearKeyBtn.addEventListener('click', clearKey);

    // Password visibility toggle
    els.toggleKeyVisibilityBtn.addEventListener('click', () => {
      const isPass = els.apiKeyInput.type === 'password';
      els.apiKeyInput.type = isPass ? 'text' : 'password';
      els.toggleKeyVisibilityBtn.querySelector('.eye-show').style.display = isPass ? 'none' : 'block';
      els.toggleKeyVisibilityBtn.querySelector('.eye-hide').style.display = isPass ? 'block' : 'none';
    });

    // Temperature slider badge
    els.temperatureSlider.addEventListener('input', (e) => {
      els.tempValueBadge.textContent = parseFloat(e.target.value).toFixed(2);
    });

    // Persona Pills on Welcome Screen
    const personaChips = els.personaChips.querySelectorAll('.persona-chip');
    personaChips.forEach(chip => {
      chip.addEventListener('click', () => {
        personaChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.persona = chip.dataset.persona;
        localStorage.setItem('gemini_lumina_persona', state.persona);
        showToast(`Persona set to: ${chip.textContent.trim()}`, 'info');
      });
    });

    // Prompt Starters Cards
    const starterCards = document.querySelectorAll('.starter-card');
    starterCards.forEach(card => {
      card.addEventListener('click', () => {
        const prompt = card.dataset.prompt;
        if (prompt) {
          sendMessage(prompt);
        }
      });
    });

    // Input handlers
    els.messageInput.addEventListener('input', autoResizeInput);
    els.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    els.sendBtn.addEventListener('click', () => sendMessage());
    els.stopBtn.addEventListener('click', stopGeneration);

    // Voice dictation
    els.voiceBtn.addEventListener('click', toggleVoiceInput);

    // Multimodal Image Attachment
    els.attachBtn.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });
    els.removeImageBtn.addEventListener('click', clearAttachedImage);

    // Clipboard image paste support (Cmd+V or Ctrl+V image screenshot)
    window.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          handleFileSelect(blob);
          showToast('Image pasted from clipboard!', 'info');
          break;
        }
      }
    });

    // Chat scroll bottom button display
    els.chatContainer.addEventListener('scroll', () => {
      const distFromBottom = els.chatContainer.scrollHeight - els.chatContainer.scrollTop - els.chatContainer.clientHeight;
      if (distFromBottom > 250) {
        els.scrollBottomBtn.style.display = 'grid';
      } else {
        els.scrollBottomBtn.style.display = 'none';
      }
    });
    els.scrollBottomBtn.addEventListener('click', scrollToBottom);

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + K: New Chat
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        createNewConversation();
      }
      // Cmd/Ctrl + , : Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        openSettings();
      }
      // Esc: Close Modals or Stop Streaming
      if (e.key === 'Escape') {
        if (els.settingsModal.classList.contains('open')) {
          closeSettings();
        } else if (els.shortcutsModal.classList.contains('open')) {
          els.shortcutsModal.classList.remove('open');
        } else if (state.isGenerating) {
          stopGeneration();
        }
      }
    });

    // Close modals on outside click
    [els.settingsModal, els.shortcutsModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
