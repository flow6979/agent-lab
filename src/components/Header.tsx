import { NavLink, Link } from 'react-router-dom'
import { useGuideCtx } from '../guide/guide'
import { useT } from '../i18n'
import { common } from '../i18n/common'
import { providerById } from '../lib/providers'
import { useApp } from '../state/app'
import { Icon, Logo, Seg } from './ui'

export function Header() {
  const app = useApp()
  const t = useT(common)
  const { activePage, progress, setStep, showExplain } = useGuideCtx()
  const prov = providerById(app.provider)
  const dot = app.connection === 'ok' || app.provider === 'offline' ? 'var(--green)' : app.connection === 'error' ? 'var(--red)' : 'var(--yellow)'
  const navItems = [
    { to: '/', label: t.nav.setup, end: true },
    { to: '/map', label: t.nav.map },
    { to: '/docs', label: t.nav.docs },
    { to: '/history', label: t.nav.history },
    { to: '/presenter', label: t.nav.presenter },
  ]
  return (
    <header className="site-header">
      <a href="#main" className="visually-hidden">
        {t.skipToContent}
      </a>
      <Link to="/" className="row" style={{ gap: 10, textDecoration: 'none', color: 'var(--ink)' }}>
        <Logo />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>Agent Lab</span>
      </Link>
      <nav aria-label="Main" className="site-nav">
        {navItems.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div style={{ flexGrow: 1 }} />
      <Link to="/settings" className="provider-chip" title={t.settings}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: dot }} />
        <span style={{ fontWeight: 600 }}>{prov ? prov.name : t.notConnected}</span>
        {prov && prov.id !== 'offline' && <span className="mono hide-sm" style={{ color: 'var(--muted)' }}>{prov.model}</span>}
      </Link>
      <Seg label="Language" value={app.lang} onChange={app.setLang} options={[{ value: 'hi', label: 'Hinglish' }, { value: 'en', label: 'English' }]} />
      {activePage && (
        <>
          <span className="hide-sm" style={{ fontSize: 13, color: 'var(--muted)' }}>
            {t.guide} {Math.min(progress[activePage.id] ?? 0, activePage.total)}/{activePage.total}
          </span>
          <button
            type="button"
            className="btn btn-sm hide-sm"
            onClick={() => {
              setStep(activePage.id, 0)
              showExplain(null)
            }}
          >
            {t.resetTips}
          </button>
        </>
      )}
      <Link to="/settings" className="btn btn-sm" aria-label={t.settings} style={{ width: 36, padding: 0 }}>
        <Icon name="settings" />
      </Link>
    </header>
  )
}
