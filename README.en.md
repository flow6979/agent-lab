**Language:** [Hinglish](README.md) · English

> **This site has moved:** Agent Lab is now the **Agentic AI** section of [HLD Prep](https://flow6979.github.io/system-design-prep/#/agents). The old URL redirects there automatically. The code is now maintained in `web/src/agents/` of the [system-design-prep](https://github.com/flow6979/system-design-prep) repo.

# Agent Lab

**Live:** https://flow6979.github.io/agent-lab/

Learn AI agents by **running** them. This website runs the **real Python code** of the [agentic-ai-handbook](https://github.com/flow6979/agentic-ai-handbook) inside your browser (Pyodide), on the LLM you choose (Gemini, Groq, OpenAI, Claude). Every step shows up live, and after each action a "What happened?" card explains what happened inside and which handbook file did it.

It is also built for demoing on a call: Presenter mode, an Offline backup, and masked keys.

## At a glance

```
 ┌──────────────────────── your browser (served by GitHub Pages) ─────────────────────────┐
 │                                                                                        │
 │   React UI  (Setup · Map · Labs · Docs · History · Presenter)                          │
 │      │  bridge.run({lab, params, llm:{spec, keys}})          ▲ events (every step)     │
 │      ▼  postMessage                                          │ + final result          │
 │   Web Worker = "BFF in the browser"                          │                         │
 │      Pyodide (Python 3.14, WebAssembly)                      │                         │
 │      + handbook.zip: agentkit + labapi + projects ───────────┘                         │
 │             │                                                                          │
 └─────────────┼──────────────────────────────────────────────────────────────────────────┘
               │ HTTPS (sync XHR, CORS)   the key only goes browser -> provider
               ▼
     Groq · Gemini · OpenAI · Claude      (Wikipedia / Tavily for the web lab)
```

- **No server.** GitHub Pages only serves static files; the "backend" (BFF) is a Web Worker running in the browser itself.
- **Keys are never stored.** They live in the tab's session memory and go straight to the provider.
- **The handbook is the single source of truth.** Its code and docs are bundled at build time; when the handbook changes, the site updates (daily, or on push).

## What is inside

| Page | What it does | Handbook project |
|---|---|---|
| Setup | Pick an LLM, add a key, real connection test | `lab-api/labapi/ping_lab.py` |
| Map / Section | Every handbook section and project, with progress | `docs.json` (build time) |
| ReAct lab | Learn · Run (text vs native) · Code · Tinker | `02-agentic-architectures/04-react` |
| RAG lab | PDF upload, chunking, embeddings, citations | `04-rag/02-pdf-chat` |
| Web lab | Deep research: plan, search, read, cited report | `03-web-agents/04-deep-research-agent` |
| Multi-agent lab | Supervisor, crew, group chat, swarm | `06-multi-agent-systems` |
| Communication lab | Real MCP and A2A messages (recorded replay) | `05-agent-communication/07-mcp`, `08-a2a` |
| Production lab | Guardrails, human approval, observability | `01-production-agent/support-desk` |
| Docs | Every handbook markdown file, in Hinglish or English | all `*.md` / `*.en.md` |
| History | A record of every run, compare two runs, download traces | browser localStorage |
| Presenter | Demo on a call: agenda, speaker notes, timer, offline backup | |

## Run locally

```bash
git clone git@github.com:flow6979/agent-lab.git
git clone git@github.com:flow6979/agentic-ai-handbook.git   # side by side
cd agent-lab
npm ci
npm run sync      # copies code + docs from ../agentic-ai-handbook into public/handbook/
npm run dev       # http://localhost:5173/agent-lab/
```

Tests:

```bash
npm run smoke                     # every lab offline, inside real Pyodide (Node)
npm run build && node scripts/e2e-browser.mjs   # real Chrome: UI run + the worker's network path
```

## Read more

- [docs/ARCHITECTURE.en.md](docs/ARCHITECTURE.en.md): the full in/out with flow diagrams (a request's journey, a key's journey, deploy)
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md): how to add a page or a lab
- The handbook's [lab-api](https://github.com/flow6979/agentic-ai-handbook/tree/main/lab-api): the Python side
