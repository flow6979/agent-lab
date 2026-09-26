// App state: language, LLM connection, keys. Poori app isi context se padhti hai.
//
// Keys: sessionStorage mein (tab band = gayab). Baaki (language, provider choice, fallback order): localStorage.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Lang } from '../i18n'
import { providerById, type ProviderId } from '../lib/providers'
import { local, session } from '../lib/storage'
import type { LabRequest } from '../lib/worker'

export type Connection = 'none' | 'testing' | 'ok' | 'error'

export type AppState = {
  lang: Lang
  setLang: (l: Lang) => void
  provider: ProviderId | null
  setProvider: (p: ProviderId | null) => void
  keys: Partial<Record<string, string>>
  setKey: (provider: string, key: string) => void
  clearKeys: () => void
  fallback: ProviderId[] // extra providers after primary, e.g. ['gemini']
  setFallback: (f: ProviderId[]) => void
  roleModels: Record<string, string> // multi-agent: role -> spec
  setRoleModel: (role: string, spec: string) => void
  connection: Connection
  setConnection: (c: Connection) => void
  offline: boolean
  /** Lab request ka `llm` + `offline` hissa, current settings se. */
  llmRequest: () => Pick<LabRequest, 'llm' | 'offline' | 'lang'>
  presenterMask: boolean
  setPresenterMask: (v: boolean) => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangS] = useState<Lang>(() => local.get<Lang>('lang', 'hi'))
  const [provider, setProviderS] = useState<ProviderId | null>(() => local.get<ProviderId | null>('provider', null))
  const [keys, setKeys] = useState<Partial<Record<string, string>>>(() => session.get('keys', {}))
  const [fallback, setFallbackS] = useState<ProviderId[]>(() => local.get<ProviderId[]>('fallback', []))
  const [roleModels, setRoleModels] = useState<Record<string, string>>(() => local.get('roleModels', {}))
  const [connection, setConnection] = useState<Connection>(() => (session.get('connected', false) ? 'ok' : 'none'))
  const [presenterMask, setPresenterMask] = useState(true)

  const setLang = useCallback((l: Lang) => {
    setLangS(l)
    local.set('lang', l)
    document.documentElement.lang = l === 'hi' ? 'hi-Latn' : 'en'
  }, [])
  const setProvider = useCallback((p: ProviderId | null) => {
    setProviderS(p)
    local.set('provider', p)
    setConnection('none')
    session.set('connected', false)
  }, [])
  const setKey = useCallback((p: string, k: string) => {
    setKeys((prev) => {
      const next = { ...prev, [p]: k.trim() }
      session.set('keys', next)
      return next
    })
  }, [])
  const clearKeys = useCallback(() => {
    setKeys({})
    session.remove('keys')
    setConnection('none')
    session.set('connected', false)
  }, [])
  const setFallback = useCallback((f: ProviderId[]) => {
    setFallbackS(f)
    local.set('fallback', f)
  }, [])
  const setRoleModel = useCallback((role: string, spec: string) => {
    setRoleModels((prev) => {
      const next = { ...prev, [role]: spec }
      if (!spec) delete next[role]
      local.set('roleModels', next)
      return next
    })
  }, [])
  const setConn = useCallback((c: Connection) => {
    setConnection(c)
    session.set('connected', c === 'ok')
  }, [])

  const offline = provider === 'offline' || provider === null
  const llmRequest = useCallback((): Pick<LabRequest, 'llm' | 'offline' | 'lang'> => {
    if (offline) return { offline: true, lang }
    const chain = [provider!, ...fallback.filter((f) => f !== provider && f !== 'offline')]
    const specs = chain.map((id) => providerById(id)?.spec).filter(Boolean) as string[]
    const primary = providerById(provider)
    const embedProvider = chain.map((id) => providerById(id)).find((p) => p?.embed && keys[p.id])
    const k: Record<string, string> = {}
    for (const id of chain) if (keys[id]) k[id] = keys[id]!
    return { offline: false, lang, llm: { spec: specs.join(','), keys: k, embed: embedProvider?.embed ?? (primary?.embed && keys[primary.id] ? primary.embed : 'local') } }
  }, [offline, provider, fallback, keys, lang])

  const value = useMemo<AppState>(
    () => ({ lang, setLang, provider, setProvider, keys, setKey, clearKeys, fallback, setFallback, roleModels, setRoleModel, connection, setConnection: setConn, offline, llmRequest, presenterMask, setPresenterMask }),
    [lang, setLang, provider, setProvider, keys, setKey, clearKeys, fallback, setFallback, roleModels, setRoleModel, connection, setConn, offline, llmRequest, presenterMask],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside AppProvider')
  return v
}
