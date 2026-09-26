// LLM providers jo browser se seedha call ho sakte hain (CORS allowed, 26-Sep-2026 ko check kiya).
export type ProviderId = 'gemini' | 'groq' | 'openai' | 'anthropic' | 'offline'

export type Provider = {
  id: ProviderId
  name: string
  model: string
  spec: string
  embed?: string // RAG ke liye embeddings model (nahi hai to local hashing embedder)
  keyUrl?: string
  keyPrefix?: string
  primary: boolean // Setup screen pe bade card ke roop mein
}

export const PROVIDERS: Provider[] = [
  { id: 'gemini', name: 'Gemini', model: 'gemini-2.5-flash', spec: 'gemini:gemini-2.5-flash', embed: 'gemini:text-embedding-004', keyUrl: 'https://aistudio.google.com/apikey', keyPrefix: 'AIza', primary: true },
  { id: 'groq', name: 'Groq', model: 'llama-3.3-70b-versatile', spec: 'groq:llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys', keyPrefix: 'gsk_', primary: true },
  { id: 'offline', name: 'Offline demo', model: 'scripted', spec: 'offline', primary: true },
  { id: 'openai', name: 'OpenAI', model: 'gpt-4o-mini', spec: 'openai:gpt-4o-mini', embed: 'openai:text-embedding-3-small', keyUrl: 'https://platform.openai.com/api-keys', keyPrefix: 'sk-', primary: false },
  { id: 'anthropic', name: 'Claude', model: 'claude-sonnet-5', spec: 'anthropic:claude-sonnet-5', keyUrl: 'https://console.anthropic.com/settings/keys', keyPrefix: 'sk-ant-', primary: false },
]

export const providerById = (id: string | null | undefined) => PROVIDERS.find((p) => p.id === id)

export function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}
