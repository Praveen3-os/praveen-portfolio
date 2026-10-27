# ✨ Gemini Lumina — Intelligent AI Assistant

An elegant, high-performance AI assistant built to answer whatever questions you have, powered by Google's latest **Gemini 2.0 & 1.5 APIs**.

![Screenshot Preview](public/preview.png)

## 🚀 Key Features

- **Ask Whatever Question You Have**: Real-time streaming responses with fast inference from Google's Gemini models.
- **Multimodal Image Support**: Attach screenshots or photos (file upload, drag-and-drop, or `Cmd+V` / `Ctrl+V` clipboard paste) to ask questions about diagrams, code screenshots, or math equations.
- **Modern Glassmorphic UI**: Sleek dark & light modes, smooth gradients, responsive layout, and polished micro-animations.
- **Multiple Gemini Models**:
  - `Gemini 2.0 Flash` (Recommended — Lightning fast, intelligent, multimodal)
  - `Gemini 1.5 Flash` (High speed & lightweight)
  - `Gemini 1.5 Pro` (Deep complex reasoning & analysis)
- **Built-in Personas**: Switch between *General Assistant*, *Code Architect*, *Quick & Concise*, *Creative Writer*, and *Science & Logic* — or set your own custom system instructions.
- **Rich Markdown & Code**: Syntax-highlighted code blocks with language tags and one-click copy buttons, tables, bullet points, and quotes.
- **Voice Input & Text-to-Speech**:
  - 🎙️ Speak your question with live speech-to-text dictation.
  - 🔊 Listen to answers read aloud with one click or auto-read mode.
- **Chat Management**: Create multiple conversations, rename them, export to Markdown, and keep all history automatically saved locally.
- **Dual Connection Architecture**: Run locally with a Node/Express backend (and optional `.env` key), or enter your API key directly in the web UI.

---

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Your Gemini API Key (Optional in `.env` or in UI)
You can get a free API key in 10 seconds from [Google AI Studio](https://aistudio.google.com/app/apikey).

You can either:
- Create a `.env` file from the example:
  ```bash
  cp .env.example .env
  ```
  And add your key: `GEMINI_API_KEY=your_actual_key_here`
- **OR** simply launch the app and paste your API key in the web interface (⚙️ Settings modal)!

### 3. Start the Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Enter` | Send question |
| `Shift + Enter` | New line in input |
| `⌘ / Ctrl + K` | New conversation |
| `⌘ / Ctrl + ,` | Open Settings & API key modal |
| `Esc` | Stop streaming / Close modal |
