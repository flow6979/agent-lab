// Run fail hua to kya dikhana hai. Kind handbook ke labapi.registry.classify_error se aata hai.
import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import { common } from '../i18n/common'
import type { LabError as LabErr } from '../lib/worker'
import { Icon } from './ui'

export function LabError({ error, onOffline }: { error: LabErr; onOffline?: () => void }) {
  const t = useT(common)
  const e = t.errors[error.kind] ?? t.errors.internal
  return (
    <div role="alert" style={{ padding: 16, borderRadius: 12, background: 'var(--red-soft)', border: '1px solid #f2c4bf', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row" style={{ gap: 8, color: 'var(--red)', fontWeight: 600 }}>
        <Icon name="warn" /> {e.title}
      </div>
      <div style={{ fontSize: 14 }}>{e.fix}</div>
      <code style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error.message}</code>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link className="btn btn-sm" to="/settings">
          {t.settings}
        </Link>
        {onOffline && (
          <button type="button" className="btn btn-sm" onClick={onOffline}>
            {t.offlineChip}
          </button>
        )}
        <Link className="btn btn-sm" to={`/errors#${error.kind}`}>
          {t.errors.help}
        </Link>
      </div>
    </div>
  )
}
