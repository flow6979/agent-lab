# Agent Lab code conventions (for anyone adding a page or a lab)

## Architecture in one picture

```
React page ──useLabRun('lab_id')──► bridge (src/lib/worker.ts) ──postMessage──► public/pyworker.js
                                                                                   Pyodide + handbook.zip
                                                                                   labapi.run(request, emit)
           ◄──── events (type: step | llm_call | trace | error) + final result ◄────┘
```

- The Python side lives in the **handbook repo** under `lab-api/labapi/<name>_lab.py`. Each file defines `LAB = Lab(id=..., project=..., run=..., defaults=..., pip=[...], smoke_cases=[...])` and is auto-discovered. Look at `react_lab.py` as the reference.
- `run(ctx)` gets a `LabContext`: `ctx.params`, `ctx.offline`, `ctx.llm(role=None)` (metered real LLM), `ctx.embedder()`, `ctx.step(kind, text, **data)` (UI event), `ctx.tracer(name)`, `use_project("<handbook folder>")` to import a project's modules. Return a JSON-safe dict (include `answer` and `**llm.stats()` when there is an LLM).
- **Offline mode is mandatory** for every lab: when `ctx.offline` is true, use a `ScriptedLLM` script so the flow runs with no key. The CI smoke test (`scripts/smoke-pyodide.mjs`) runs every `smoke_cases` entry offline inside Pyodide and fails the deploy if one breaks.
- Pyodide has no threads, no sockets, no subprocess. HTTP must go through `agentkit.llm.http` (sync XHR in the worker). Only CORS-enabled hosts work from a browser (LLM providers, Wikipedia, open-meteo, Tavily do; DuckDuckGo does not).
- Browser-only data: `ctx.params` can carry user text/files (e.g. base64 PDF bytes).

## Frontend rules

- **Design**: copy the look of the matching board on the Design canvas (colors via CSS variables in `src/styles/global.css`, fonts `--font-display/--font-body/--font-mono`). Reuse `.panel`, `.btn`, `.seg`, `.chip`, `.badge-*`, `.input`, `.lab-grid`, and components in `src/components/` (`Seg`, `Stat`, `StepBadge`, `Icon`, `CodeBlock`, `TraceList`, `Markdown`, `LabError`, `WorkerStatus`). No new hex colors in components; add a variable if needed. No emoji; icons come from `Icon`.
- **Language**: every string goes in a dictionary `src/i18n/pages/<page>.ts` exported as `{ hi: {...}, en: {...} }` and read with `useT(dict)`. Hinglish = Roman-script Hindi + English mix; English = plain, fluent. No em-dashes in either. Code, file paths and model names stay literal.
- **Guide rule (the user's requirement)**: every page has tips that disappear when the user does the action, then a "Kya hua? / What happened?" card:
  ```tsx
  const g = useGuide('page-id', ['step1', 'step2'])
  <Tip show={g.is('step1')}>...</Tip>
  <button className={g.pulse('step1')} onClick={() => { doIt(); g.done('step1', { title, flow, lines, file }) }} />
  ```
  The card must explain what just happened in terms of real handbook files/functions.
- **Running labs**: `const lab = useLabRun('rag', 'RAG PDF chat', { pip: ['pypdf'] })`, then `await lab.run(params)`. It streams `lab.events`, stores history, and gives `lab.result` / `lab.error`. Show `<LabError error={lab.error} />` on failure. Show `common.offlineNote` when `app.offline`.
- **Honesty**: if something is a recorded replay or simulated, label it in the UI (`badge` "Replay").
- **Accessibility**: real `<button>`/`<a>`/`<label>`, `aria-pressed` on toggles, `aria-live` on streaming areas, contrast >= 4.5:1, works at 390px width (use the grid/wrap patterns, no fixed widths over 360px without a media query).
- **Routing**: HashRouter. Routes are fixed in `src/App.tsx`; do not edit it, own only your page files and your dict files.
- Only touch the files you own. Run `npx tsc -b` and `npm run build` before you finish.
