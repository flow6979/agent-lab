**Language:** Hinglish · [English](README.en.md)

> **Ye site ab move ho gayi hai:** Agent Lab ab [Viewinter](https://flow6979.github.io/viewinter/#/agents) ka **Agentic AI** section hai. Purana URL apne aap wahan redirect hota hai. Code ab [viewinter](https://github.com/flow6979/viewinter) repo ke `web/src/agents/` me maintain hota hai.

# Agent Lab

**Live:** https://flow6979.github.io/agent-lab/

AI agents ko **chala ke** samjho. Yeh website [agentic-ai-handbook](https://github.com/flow6979/agentic-ai-handbook) ka **asli Python code** tumhare browser ke andar chalati hai (Pyodide), tumhari chuni hui LLM (Gemini, Groq, OpenAI, Claude) ke saath. Har step live dikhta hai, har action ke baad "Kya hua?" card batata hai ki andar kya hua aur handbook ki kaunsi file ne kiya.

Call pe demo ke liye bhi bani hai: Presenter mode, Offline backup, keys mask.

## Ek nazar mein

```
 ┌──────────────────────── tumhara browser (GitHub Pages se aaya) ────────────────────────┐
 │                                                                                        │
 │   React UI  (Setup · Map · Labs · Docs · History · Presenter)                          │
 │      │  bridge.run({lab, params, llm:{spec, keys}})          ▲ events (har step)       │
 │      ▼  postMessage                                          │ + final result          │
 │   Web Worker = "BFF in the browser"                          │                         │
 │      Pyodide (Python 3.14, WebAssembly)                      │                         │
 │      + handbook.zip: agentkit + labapi + projects ───────────┘                         │
 │             │                                                                          │
 └─────────────┼──────────────────────────────────────────────────────────────────────────┘
               │ HTTPS (sync XHR, CORS)   key sirf browser -> provider
               ▼
     Groq · Gemini · OpenAI · Claude      (Wikipedia / Tavily: web lab ke liye)
```

- **Koi server nahi.** GitHub Pages sirf static files deta hai; "backend" (BFF) ek Web Worker hai jo browser mein hi chalta hai.
- **Key kahin save nahi hoti.** Tab ki session memory mein rehti hai aur seedha provider ko jaati hai.
- **Handbook = single source of truth.** Build ke waqt handbook repo ka code aur docs bundle hote hain; handbook badla to site apne aap update (roz ek baar, ya push pe).

## Kya kya hai

| Page | Kya karta hai | Handbook project |
|---|---|---|
| Setup | LLM chuno, key daalo, asli connection test | `lab-api/labapi/ping_lab.py` |
| Map / Section | Handbook ke saare sections aur projects, progress ke saath | `docs.json` (build time) |
| ReAct lab | Samjho · Chalao (text vs native) · Code · Tinker | `02-agentic-architectures/04-react` |
| RAG lab | PDF upload, chunking, embeddings, citations | `04-rag/02-pdf-chat` |
| Web lab | Deep research: plan, search, read, cited report | `03-web-agents/04-deep-research-agent` |
| Multi-agent lab | Supervisor, crew, group chat, swarm | `06-multi-agent-systems` |
| Communication lab | MCP aur A2A ke asli messages (recorded replay) | `05-agent-communication/07-mcp`, `08-a2a` |
| Production lab | Guardrails, human approval, observability | `01-production-agent/support-desk` |
| Docs | Handbook ki har md file, Hinglish ya English | saari `*.md` / `*.en.md` |
| History | Har run ka record, do runs compare, trace download | browser localStorage |
| Presenter | Call pe demo: agenda, speaker notes, timer, offline backup | |

## Local chalana

```bash
git clone git@github.com:flow6979/agent-lab.git
git clone git@github.com:flow6979/agentic-ai-handbook.git   # dono ek hi folder mein
cd agent-lab
npm ci
npm run sync      # ../agentic-ai-handbook se code + docs public/handbook/ mein
npm run dev       # http://localhost:5173/agent-lab/
```

Test:

```bash
npm run smoke                     # har lab offline, asli Pyodide mein (Node)
npm run build && node scripts/e2e-browser.mjs   # asli Chrome: UI run + worker ka network path
```

## Aur padho

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): poora in/out, flow diagrams ke saath (request ka safar, key ka safar, deploy)
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md): naya page ya lab kaise jodein
- Handbook ka [lab-api](https://github.com/flow6979/agentic-ai-handbook/tree/main/lab-api): Python side
