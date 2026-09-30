// Real-browser end-to-end check (local): vite preview + system Chrome via playwright-core.
//
//   npm run build && node scripts/e2e-browser.mjs
//
// 1. UI flow: Setup -> "offline" -> ReAct lab -> Run -> final answer appears (Pyodide in a real Web Worker).
// 2. Network path: the worker calls a local fake OpenAI-compatible server cross-origin (CORS preflight +
//    synchronous XHR), exactly how real Groq/Gemini/OpenAI calls work, and gets a tool-using answer back.
import { spawn } from 'node:child_process'
import http from 'node:http'
import { chromium } from 'playwright-core'

const PORT = Number(process.env.PORT || 4173)
const SITE = process.env.SITE // e.g. https://flow6979.github.io/agent-lab/ to test the live deploy
const MOCK = 11434 // agentkit's default OLLAMA_BASE_URL is http://localhost:11434/v1
const base = SITE || `http://localhost:${PORT}/agent-lab/`
const fail = (m) => {
  console.error(`FAIL ${m}`)
  process.exitCode = 1
}

// ---- fake OpenAI-compatible LLM (with CORS, like the real providers) ---------------------
let calls = 0
const seenAuth = []
const mock = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    calls++
    seenAuth.push(req.headers.authorization || '')
    const msgs = JSON.parse(body).messages
    const hasTool = msgs.some((m) => m.role === 'tool')
    const message = hasTool
      ? { role: 'assistant', content: 'Mount Everest is about 26.8 times taller.' }
      : { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'calculator', arguments: '{"expression": "8849 / 330"}' } }] }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ model: 'mock-1', choices: [{ message, finish_reason: 'stop' }], usage: { prompt_tokens: 50, completion_tokens: 10 } }))
  })
})
await new Promise((r) => mock.listen(MOCK, r))

const preview = SITE ? null : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
if (preview) await new Promise((r) => setTimeout(r, 2500))

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`))

try {
  // ---- 1. UI flow, offline ----------------------------------------------------------------
  await page.goto(base)
  await page.getByRole('button', { name: /Skip/i }).click()
  await page.waitForURL(/#\/map/)
  await page.goto(`${base}#/lab/react/run`)
  await page.getByRole('button', { name: /^Run$/ }).click()
  await page.getByText('26.8 times taller', { exact: false }).first().waitFor({ timeout: 120000 })
  const traceCount = await page.locator('ol[aria-live] li').count()
  console.log(`ok   UI offline ReAct run, trace items=${traceCount}`)
  if (traceCount < 5) fail('expected at least 5 trace items')

  // ---- 1b. "Kya hua?" card closes on outside click and on page/tab change -------------------
  const card = page.locator('.explain-card')
  await card.waitFor({ timeout: 10000 }) // the ReAct run above opened it
  await page.locator('main h1').first().click()
  await card.waitFor({ state: 'detached', timeout: 3000 })
  console.log('ok   explain card closes on outside click')
  await page.getByRole('button', { name: /^(Run again|Phir se chalao)$/ }).click()
  await card.waitFor({ timeout: 60000 })
  await page.getByRole('button', { name: /^(Code)$/ }).click() // tab change = route change
  await card.waitFor({ state: 'detached', timeout: 3000 })
  console.log('ok   explain card closes on tab change')
  // a click that opens a card AND navigates keeps the card (it describes the new page)
  await page.goto(`${base}#/map`)
  await page.evaluate(() => localStorage.removeItem('agentlab:guide'))
  await page.reload()
  const reactRow = page.locator('button.map-row', { hasText: 'ReAct' }).first()
  await reactRow.click()
  await page.waitForURL(/#\/lab\/react/)
  await card.waitFor({ timeout: 3000 })
  console.log('ok   explain card opened by a navigating click stays on the new page')
  await page.keyboard.press('Escape')

  // ---- 2. real network path from the worker ----------------------------------------------
  const out = await page.evaluate(async (workerUrl) => {
    const w = new Worker(workerUrl, { type: 'module' })
    const send = (msg) =>
      new Promise((resolve, reject) => {
        const events = []
        w.onmessage = (e) => {
          if (e.data.type === 'event') events.push(e.data.event)
          else if (e.data.type === 'fatal') reject(new Error(e.data.message))
          else if (e.data.type === 'result' || e.data.type === 'ready') resolve({ data: e.data, events })
        }
        w.postMessage(msg)
      })
    await send({ id: 1, type: 'init' })
    return send({ id: 2, type: 'run', request: { lab: 'react', params: { mode: 'native' }, llm: { spec: 'ollama:mock-1', keys: { ollama: 'test-key' } } } })
  }, `${base}pyworker.js`)
  const res = out.data.result
  if (!res.ok) fail(`network run failed: ${JSON.stringify(res.error)}`)
  else if (!String(res.result.answer).includes('26.8')) fail(`unexpected answer ${res.result.answer}`)
  else console.log(`ok   worker -> sync XHR -> CORS server: answer="${res.result.answer}", llm_calls=${res.result.llm_calls}, mock saw ${calls} calls`)
  if (!seenAuth.every((a) => a === 'Bearer test-key')) fail(`auth header not forwarded: ${seenAuth}`)

  // ---- 3. every page renders without errors -------------------------------------------------
  const routes = ['/', '/map', '/section/02-agentic-architectures', '/docs/02-agentic-architectures/04-react', '/docs', '/lab/react/learn', '/lab/react/code', '/lab/react/tinker', '/labs/rag', '/labs/web', '/labs/multi', '/labs/comm', '/labs/prod', '/settings', '/history', '/presenter', '/errors', '/run/02-agentic-architectures/01-prompt-chaining', '/run/05-agent-communication/08-a2a/01-a2a-server']
  for (const r of routes) {
    const before = logs.filter((l) => l.startsWith('pageerror')).length
    await page.goto(`${base}#${r}`)
    await page.locator('main h1, main h2').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(800)
    const errs = logs.filter((l) => l.startsWith('pageerror')).slice(before)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    if (errs.length) fail(`${r}: ${errs.join(' | ')}`)
    else console.log(`ok   page ${r}${overflow ? '  (horizontal overflow!)' : ''}`)
  }

  // ---- 3b. phone width: no page may scroll sideways -----------------------------------------
  await page.setViewportSize({ width: 390, height: 844 })
  for (const r of routes) {
    await page.goto(`${base}#${r}`)
    await page.locator('main h1, main h2').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(500)
    const w = await page.evaluate(() => document.documentElement.scrollWidth)
    if (w > 391) fail(`390px ${r}: page is ${w}px wide`)
  }
  console.log('ok   390px: checked every page for sideways scroll')
  await page.setViewportSize({ width: 1280, height: 800 })

  // ---- 3c. every handbook project via the generic runner UI (click Run, wait for exit code) ---
  const man = await (await fetch(`${base}handbook/projects.json`)).json()
  for (const pid of Object.keys(man)) {
    await page.goto(`${base}#/run/${pid}`)
    await page.getByRole('button', { name: /^(Run|Phir se chalao|Run again)$/ }).first().click()
    const done = page.locator('text=/exit code 0/').first()
    const err = page.locator('[role=alert]').first()
    const which = await Promise.race([done.waitFor({ timeout: 90000 }).then(() => 'ok'), err.waitFor({ timeout: 90000 }).then(() => 'err')]).catch(() => 'timeout')
    if (which === 'ok') console.log(`ok   runner UI ${pid}`)
    else fail(`runner UI ${pid}: ${which} ${which === 'err' ? (await err.innerText()).slice(0, 300) : ''}`)
  }

  // ---- 4. every lab's smoke cases inside the browser worker (offline) ----------------------
  const smoke = await page.evaluate(async (workerUrl) => {
    const w = new Worker(workerUrl, { type: 'module' })
    let id = 0
    const send = (msg) =>
      new Promise((resolve, reject) => {
        const my = ++id
        w.onmessage = (e) => {
          if (e.data.id !== my) return
          if (e.data.type === 'fatal') reject(new Error(e.data.message))
          else if (e.data.type === 'result' || e.data.type === 'ready') resolve(e.data)
        }
        w.postMessage({ id: my, ...msg })
      })
    await send({ type: 'init' })
    // catalog: labapi.catalog() via a tiny python run is not exposed, so list the known labs + their smoke cases here
    const cases = [
      ['ping', {}], ['react', { mode: 'text' }], ['react', { mode: 'native' }],
      ['rag', { action: 'ingest' }, ['pypdf']], ['rag', { action: 'ask' }, ['pypdf']], ['rag', { action: 'ask', no_rag: true }, ['pypdf']],
      ['web', {}], ['multi', { topology: 'supervisor' }], ['multi', { topology: 'crew' }], ['multi', { topology: 'groupchat' }], ['multi', { topology: 'swarm' }],
      ['comm', { protocol: 'mcp' }], ['comm', { protocol: 'a2a' }], ['support', { message: 'Where is my order #1042?' }],
    ]
    const out = []
    for (const [lab, params, pip] of cases) {
      const r = await send({ type: 'run', request: { lab, params, offline: true, pip } })
      out.push({ lab, params, ok: r.result.ok, err: r.result.ok ? null : r.result.error.message })
    }
    return out
  }, `${base}pyworker.js`)
  for (const s of smoke) {
    if (s.ok) console.log(`ok   worker ${s.lab} ${JSON.stringify(s.params)}`)
    else fail(`worker ${s.lab} ${JSON.stringify(s.params)}: ${s.err}`)
  }
} catch (e) {
  fail(e.message)
  console.error(logs.slice(-20).join('\n'))
} finally {
  await browser.close()
  preview?.kill()
  mock.close()
}
