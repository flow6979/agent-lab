**Language:** Hinglish · [English](ARCHITECTURE.en.md)

# Agent Lab: andar kya chalta hai (in aur out)

Yeh doc poora system samjhata hai: UI se button dabane se leke LLM ke jawab tak, aur code GitHub pe push karne se leke live site tak.

## 1. Teen hisse

```
┌──────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│ 1. UI (React)        │    │ 2. "BFF" (Web Worker)    │    │ 3. Handbook (Python)     │
│ src/pages/*          │───►│ public/pyworker.js       │───►│ agentkit  (LLM, tools)   │
│ src/lib/worker.ts    │◄───│ Pyodide = Python in WASM │◄───│ labapi    (lab adapters) │
│ (screens, tips,      │    │ (sirf browser ke andar)  │    │ projects  (asli code)    │
│  explain cards)      │    │                          │    │                          │
└──────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
      agent-lab repo              agent-lab repo              agentic-ai-handbook repo
```

**BFF kyun browser mein?** GitHub Pages pe server nahi chal sakta. Aam taur pe BFF (Backend For Frontend) ek server hota hai jo UI ke liye APIs deta hai. Yahan wahi kaam ek Web Worker karta hai:
- UI ko ek saaf API deta hai (`bridge.run`),
- Python chalata hai,
- LLM ko call karta hai.

Faayda: koi hosting kharcha nahi, aur key kisi tisre server tak jaati hi nahi.

## 2. Ek Run ka safar (ReAct example)

```
 User "Run" dabata hai
   │
   ▼
 ReactLab.tsx ── useLabRun('react').run({mode:'native', question})
   │
   ▼
 src/lib/useLabRun.ts
   │  request = { lab:'react', params, llm:{spec:'groq:llama-3.3-70b-versatile', keys:{groq:'gsk_...'}}, lang }
   ▼
 src/lib/worker.ts  (bridge)  ── queue (ek waqt pe ek run) ── postMessage({type:'run', request})
   │
   ▼
 public/pyworker.js  (Web Worker)
   │  pehli baar: Pyodide + pydantic load, handbook.zip ko /handbook mein unzip
   │  labapi.run(request, emit)          emit = har event ko postMessage karo
   ▼
 lab-api/labapi/registry.py  ── lab = labs()['react']   (react_lab.py)
   │  ctx = LabContext(params, llm spec, keys, offline, emit)
   ▼
 lab-api/labapi/react_lab.py
   │  ctx.llm()  ──► get_llm(spec, api_keys=keys)  (agentkit factory)  ──► MeteredLLM
   │  Agent(llm, tools, ...).run(question)          (common/agentkit/agent.py, asli loop)
   ▼
 common/agentkit/llm/openai_compat.py ── http.post_json()
   │
   ▼
 common/agentkit/llm/http.py
   │  browser mein (sys.platform == 'emscripten'): synchronous XMLHttpRequest
   ▼
 https://api.groq.com/openai/v1/chat/completions   (CORS allowed)
```

Wapas aate waqt:

```
 LLM response ─► agent loop tool chalata hai ─► tracer event ─► ctx.step('tool_call', ...)
      ─► emit(json) ─► postMessage({type:'event'}) ─► bridge ─► useLabRun.events ─► TraceList (live)
 loop khatam ─► {ok:true, result:{answer, llm_calls, tokens, ms}} ─► History mein save ─► "Kya hua?" card
```

**Sync XHR kyun?** Handbook ka code sync hai (`llm.chat()` seedha jawab lautaata hai). Browser ke main thread pe sync network allowed nahi, lekin **Web Worker ke andar allowed hai**. Isliye poora Python worker mein chalta hai, aur handbook ka code bina badle browser mein chal jata hai.

## 3. Key ka safar (security)

```
 Setup/Settings input
   │ app.setKey('groq', key)
   ▼
 sessionStorage  (tab band = gayab; localStorage mein KABHI nahi)
   │ har run pe llmRequest() request mein daalta hai
   ▼
 Web Worker memory ── get_llm(api_keys=...) ── Authorization: Bearer <key>
   │
   ▼
 Provider (Groq/Gemini/OpenAI/Claude)       <- sirf yahi key dekhta hai
```

- Koi analytics nahi, koi logging server nahi.
- History mein key save nahi hoti, sirf provider/model ka naam.
- Presenter mode mein keys mask hoti hain.
- Claude ke liye handbook `anthropic-dangerous-direct-browser-access: true` header lagata hai (browser se seedha call ke liye Anthropic ka opt-in).

## 4. Errors kaise UI tak aate hain

```
 provider 401/429/404/5xx  ─► agentkit LLMError(status, retryable)
 network/CORS fail         ─► http.TransportError ─► LLMError(retryable)
        │
        ▼  RetryingLLM: 429/5xx/network pe backoff ke saath retry (401 pe nahi)
        ▼  FallbackLLM: agla provider (Settings ka fallback chain)
        ▼
 labapi.registry.classify_error ─► {kind:'auth'|'rate_limit'|..., status, message}
        ▼
 UI: <LabError> card ─► fix buttons (Settings / Offline demo / /errors page)
```

## 5. Guide system (tips + "Kya hua?")

```
 page: const g = useGuide('react-lab', ['run','mode','rerun','code'])

   step 'run' active ──► <Tip> dikhta hai + button pe pulse
        │ user Run dabata hai
        ▼
   g.done('run', explain) ──► tip gayab, step++ (localStorage), "Kya hua?" card khulta hai
        │ user "Samjha, aage badho"
        ▼
   agla tip ('mode') dikhta hai
```

Header ka "Tips dobara dikhao" current page ka guide reset karta hai (call pe demo dobara dikhane ke liye).

## 6. Offline mode

Har lab `ctx.offline` pe `ScriptedLLM` (pehle se likhe jawab) use karta hai:
- bina key ke poora flow chalta hai,
- call pe internet gaya to backup,
- CI smoke test isi se har lab check karta hai.

## 7. Build aur deploy

```
 git push (agent-lab)  /  roz 03:30 UTC  /  "Run workflow"
   │
   ▼
 GitHub Actions (.github/workflows/deploy.yml)
   ├─ checkout agent-lab
   ├─ checkout agentic-ai-handbook ──► handbook/
   ├─ npm ci
   ├─ scripts/sync-handbook.mjs
   │     handbook.zip  (Python code + data, worker ke liye)
   │     raw/          (docs .md + source, UI ke liye)
   │     docs.json     (sections -> projects -> docs tree)
   ├─ scripts/smoke-pyodide.mjs   har lab ka har smoke case OFFLINE, asli Pyodide mein
   │                              (koi lab toota to deploy ruk jata hai)
   ├─ vite build ──► dist/
   └─ deploy-pages ──► https://flow6979.github.io/agent-lab/
```

Handbook mein naya project ya doc add karo: agle build mein Map, Section aur Docs mein apne aap aa jayega. Naya **live lab** chahiye to handbook mein `lab-api/labapi/<name>_lab.py` aur yahan ek page (dekho [CONVENTIONS.md](CONVENTIONS.md)).

## 8. Browser ki limits (imaandari se)

| Cheez | Browser mein? | Kaise handle kiya |
|---|---|---|
| LLM providers (Groq, Gemini, OpenAI, Claude) | Haan, CORS allowed | seedha call |
| Wikipedia, open-meteo, Tavily | Haan | web lab inhe use karta hai |
| DuckDuckGo, koi bhi random website | Nahi (CORS) | web lab mein Wikipedia/Tavily; CLI version sab kar sakta hai |
| MCP stdio server, FastAPI/uvicorn (A2A) | Nahi (no subprocess/sockets) | asli local run ke messages record karke replay, "Replay" badge ke saath |
| Threads (ThreadPoolExecutor) | Nahi | labs sequential chalte hain |
| Chalte run ko rokna | Python beech mein nahi rukta | "Roko" = worker restart (Pyodide dobara load hota hai) |

## 9. Folder map

```
agent-lab/
├─ public/pyworker.js          BFF-in-browser (Pyodide worker)
├─ scripts/
│   ├─ sync-handbook.mjs       handbook -> public/handbook (zip + raw + docs.json)
│   ├─ smoke-pyodide.mjs       CI: har lab offline Pyodide mein
│   └─ e2e-browser.mjs         local: asli Chrome mein UI + network path
├─ src/
│   ├─ lib/worker.ts           bridge (postMessage <-> promises/events)
│   ├─ lib/useLabRun.ts        kisi bhi lab ko chalane ka hook (+ history)
│   ├─ lib/handbook.ts         docs.json / raw files
│   ├─ state/app.tsx           language, provider, keys, fallback, connection
│   ├─ guide/guide.tsx         tips + "Kya hua?" card
│   ├─ i18n/                   har page ki {hi, en} dictionary
│   ├─ components/             Header, Trace, Markdown, LabError, ui
│   └─ pages/                  Setup, Home, Section, Docs, Settings, History, Presenter, labs/*
└─ .github/workflows/deploy.yml
```
