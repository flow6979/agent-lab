**Language:** [Hinglish](ARCHITECTURE.md) · English

# Agent Lab: what runs inside (in and out)

This doc explains the whole system: from clicking a button in the UI to the LLM's answer, and from pushing code to GitHub to the live site.

## 1. Three parts

```
┌──────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│ 1. UI (React)        │    │ 2. "BFF" (Web Worker)    │    │ 3. Handbook (Python)     │
│ src/pages/*          │───►│ public/pyworker.js       │───►│ agentkit  (LLM, tools)   │
│ src/lib/worker.ts    │◄───│ Pyodide = Python in WASM │◄───│ labapi    (lab adapters) │
│ (screens, tips,      │    │ (only inside the browser)│    │ projects  (real code)    │
│  explain cards)      │    │                          │    │                          │
└──────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
      agent-lab repo              agent-lab repo              agentic-ai-handbook repo
```

**Why is the BFF in the browser?** GitHub Pages cannot run a server. A BFF (Backend For Frontend) is normally a server that exposes APIs for the UI. Here a Web Worker does the same job:
- it gives the UI one clean API (`bridge.run`),
- it runs Python,
- it calls the LLM.

Benefits: zero hosting cost, and the key never reaches a third-party server.

## 2. The journey of one Run (ReAct example)

```
 User clicks "Run"
   │
   ▼
 ReactLab.tsx ── useLabRun('react').run({mode:'native', question})
   │
   ▼
 src/lib/useLabRun.ts
   │  request = { lab:'react', params, llm:{spec:'groq:llama-3.3-70b-versatile', keys:{groq:'gsk_...'}}, lang }
   ▼
 src/lib/worker.ts  (bridge)  ── queue (one run at a time) ── postMessage({type:'run', request})
   │
   ▼
 public/pyworker.js  (Web Worker)
   │  first time: load Pyodide + pydantic, unzip handbook.zip into /handbook
   │  labapi.run(request, emit)          emit = postMessage every event
   ▼
 lab-api/labapi/registry.py  ── lab = labs()['react']   (react_lab.py)
   │  ctx = LabContext(params, llm spec, keys, offline, emit)
   ▼
 lab-api/labapi/react_lab.py
   │  ctx.llm()  ──► get_llm(spec, api_keys=keys)  (agentkit factory)  ──► MeteredLLM
   │  Agent(llm, tools, ...).run(question)          (common/agentkit/agent.py, the real loop)
   ▼
 common/agentkit/llm/openai_compat.py ── http.post_json()
   │
   ▼
 common/agentkit/llm/http.py
   │  in the browser (sys.platform == 'emscripten'): synchronous XMLHttpRequest
   ▼
 https://api.groq.com/openai/v1/chat/completions   (CORS allowed)
```

On the way back:

```
 LLM response ─► agent loop runs a tool ─► tracer event ─► ctx.step('tool_call', ...)
      ─► emit(json) ─► postMessage({type:'event'}) ─► bridge ─► useLabRun.events ─► TraceList (live)
 loop ends ─► {ok:true, result:{answer, llm_calls, tokens, ms}} ─► saved to History ─► "What happened?" card
```

**Why synchronous XHR?** The handbook code is synchronous (`llm.chat()` returns the answer directly). Synchronous networking is not allowed on the browser's main thread, but it **is allowed inside a Web Worker**. So all the Python runs in the worker, and the handbook code runs in the browser unchanged.

## 3. The journey of a key (security)

```
 Setup/Settings input
   │ app.setKey('groq', key)
   ▼
 sessionStorage  (gone when the tab closes; NEVER in localStorage)
   │ llmRequest() adds it to each run's request
   ▼
 Web Worker memory ── get_llm(api_keys=...) ── Authorization: Bearer <key>
   │
   ▼
 Provider (Groq/Gemini/OpenAI/Claude)       <- the only party that sees the key
```

- No analytics and no logging server.
- History stores only the provider/model name, never the key.
- Presenter mode masks keys.
- For Claude, the handbook adds the `anthropic-dangerous-direct-browser-access: true` header (Anthropic's opt-in for direct browser calls).

## 4. How errors reach the UI

```
 provider 401/429/404/5xx  ─► agentkit LLMError(status, retryable)
 network/CORS failure      ─► http.TransportError ─► LLMError(retryable)
        │
        ▼  RetryingLLM: retries 429/5xx/network with backoff (not 401)
        ▼  FallbackLLM: next provider (the fallback chain from Settings)
        ▼
 labapi.registry.classify_error ─► {kind:'auth'|'rate_limit'|..., status, message}
        ▼
 UI: <LabError> card ─► fix buttons (Settings / Offline demo / /errors page)
```

## 5. The guide system (tips + "What happened?")

```
 page: const g = useGuide('react-lab', ['run','mode','rerun','code'])

   step 'run' active ──► <Tip> shows + the button pulses
        │ user clicks Run
        ▼
   g.done('run', explain) ──► tip disappears, step++ (localStorage), "What happened?" card opens
        │ user clicks "Got it, next"
        ▼
   the next tip ('mode') shows
```

"Show tips again" in the header resets the current page's guide (handy for repeating a demo on a call).

## 6. Offline mode

Every lab uses a `ScriptedLLM` (pre-written answers) when `ctx.offline` is set:
- the full flow runs without a key,
- it is a backup if the internet drops during a call,
- the CI smoke test checks every lab this way.

## 7. Build and deploy

```
 git push (agent-lab)  /  daily 03:30 UTC  /  "Run workflow"
   │
   ▼
 GitHub Actions (.github/workflows/deploy.yml)
   ├─ checkout agent-lab
   ├─ checkout agentic-ai-handbook ──► handbook/
   ├─ npm ci
   ├─ scripts/sync-handbook.mjs
   │     handbook.zip  (Python code + data, for the worker)
   │     raw/          (docs .md + source, for the UI)
   │     docs.json     (sections -> projects -> docs tree)
   ├─ scripts/smoke-pyodide.mjs   every smoke case of every lab OFFLINE, in real Pyodide
   │                              (a broken lab stops the deploy)
   ├─ vite build ──► dist/
   └─ deploy-pages ──► https://flow6979.github.io/agent-lab/
```

Add a new project or doc to the handbook and the next build shows it in Map, Section and Docs automatically. For a new **live lab**, add `lab-api/labapi/<name>_lab.py` in the handbook and a page here (see [CONVENTIONS.md](CONVENTIONS.md)).

## 8. Browser limits (honestly)

| Thing | In the browser? | How it is handled |
|---|---|---|
| LLM providers (Groq, Gemini, OpenAI, Claude) | Yes, CORS allowed | direct calls |
| Wikipedia, open-meteo, Tavily | Yes | used by the web lab |
| DuckDuckGo, arbitrary websites | No (CORS) | the web lab uses Wikipedia/Tavily; the CLI version can do everything |
| MCP stdio server, FastAPI/uvicorn (A2A) | No (no subprocess/sockets) | messages recorded from a real local run and replayed, with a "Replay" badge |
| Threads (ThreadPoolExecutor) | No | labs run sequentially |
| Stopping a running run | Python cannot be interrupted midway | "Stop" = restart the worker (Pyodide reloads) |

## 9. Folder map

```
agent-lab/
├─ public/pyworker.js          BFF in the browser (Pyodide worker)
├─ scripts/
│   ├─ sync-handbook.mjs       handbook -> public/handbook (zip + raw + docs.json)
│   ├─ smoke-pyodide.mjs       CI: every lab offline in Pyodide
│   └─ e2e-browser.mjs         local: UI + network path in real Chrome
├─ src/
│   ├─ lib/worker.ts           bridge (postMessage <-> promises/events)
│   ├─ lib/useLabRun.ts        hook to run any lab (+ history)
│   ├─ lib/handbook.ts         docs.json / raw files
│   ├─ state/app.tsx           language, provider, keys, fallback, connection
│   ├─ guide/guide.tsx         tips + "What happened?" card
│   ├─ i18n/                   {hi, en} dictionary per page
│   ├─ components/             Header, Trace, Markdown, LabError, ui
│   └─ pages/                  Setup, Home, Section, Docs, Settings, History, Presenter, labs/*
└─ .github/workflows/deploy.yml
```
