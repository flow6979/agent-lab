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

const PORT = 4173
const MOCK = 11434 // agentkit's default OLLAMA_BASE_URL is http://localhost:11434/v1
const base = `http://localhost:${PORT}/agent-lab/`
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

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

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
} catch (e) {
  fail(e.message)
  console.error(logs.slice(-20).join('\n'))
} finally {
  await browser.close()
  preview.kill()
  mock.close()
}
