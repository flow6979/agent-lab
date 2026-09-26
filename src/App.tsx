// Routes. GitHub Pages pe server-side routing nahi hoti, isliye HashRouter (/#/map, /#/lab/react).
import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { ExplainCard, GuideProvider } from './guide/guide'
import { useT } from './i18n'
import { common } from './i18n/common'
import { bridge } from './lib/worker'
import Setup from './pages/Setup'
import { AppProvider } from './state/app'

const Home = lazy(() => import('./pages/Home'))
const Section = lazy(() => import('./pages/Section'))
const Docs = lazy(() => import('./pages/Docs'))
const Settings = lazy(() => import('./pages/Settings'))
const SetupErrors = lazy(() => import('./pages/SetupErrors'))
const History = lazy(() => import('./pages/History'))
const Presenter = lazy(() => import('./pages/Presenter'))
const ReactLab = lazy(() => import('./pages/react/ReactLab'))
const RagLab = lazy(() => import('./pages/labs/RagLab'))
const WebLab = lazy(() => import('./pages/labs/WebLab'))
const MultiAgentLab = lazy(() => import('./pages/labs/MultiAgentLab'))
const CommLab = lazy(() => import('./pages/labs/CommLab'))
const ProdLab = lazy(() => import('./pages/labs/ProdLab'))
const Runner = lazy(() => import('./pages/Runner'))

function Shell() {
  const t = useT(common)
  useEffect(() => {
    // Python (Pyodide) ko background mein pehle se load karna shuru kar do, taaki pehla Run jaldi ho.
    const start = () => bridge.init().catch(() => undefined)
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(start)
    else setTimeout(start, 1500)
  }, [])
  return (
    <>
      <Header />
      <Suspense fallback={<main id="main" className="page muted">...</main>}>
        <Routes>
          <Route path="/" element={<Setup />} />
          <Route path="/errors" element={<SetupErrors />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/map" element={<Home />} />
          <Route path="/section/:sectionId" element={<Section />} />
          <Route path="/docs/*" element={<Docs />} />
          <Route path="/lab/react/:tab?" element={<ReactLab />} />
          <Route path="/labs/rag" element={<RagLab />} />
          <Route path="/labs/web" element={<WebLab />} />
          <Route path="/labs/multi" element={<MultiAgentLab />} />
          <Route path="/labs/comm" element={<CommLab />} />
          <Route path="/labs/prod" element={<ProdLab />} />
          <Route path="/run/*" element={<Runner />} />
          <Route path="/history" element={<History />} />
          <Route path="/presenter" element={<Presenter />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ExplainCard labels={{ whatHappened: t.whatHappened, gotIt: t.gotIt }} />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <GuideProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </GuideProvider>
    </AppProvider>
  )
}
