import type { CSSProperties } from 'react'
import { modelLogo } from '@/features/model-logo'
import { useWorkspace } from '@/workspace'
import { modelCatalogRows } from '../../local-catalog'
import { accent, formatBytes, infoOf } from '../../local-model-info'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'

export type Kind = 'whisper' | 'llm'

// The catalog and the downloaded models of one kind.
export function ModelList({
  kind,
  downloading,
  onDownload,
}: {
  kind: Kind
  downloading: string | null
  onDownload: (id: string) => void
}) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const state = ws.state!
  const local = state.localModels
  const operation = local.operations.find((item) => item.kind === kind)
  // Lists the catalog, then any other model once it is on disk (catalog ids, then file hashes).
  const entries = modelCatalogRows(state.modelCatalog, local.models, kind)
  return (
    <div className={kind === 'whisper' ? 'local-model-manager' : 'llm-model-manager'}>
      <div className="models-list">
        {entries.map(({ entry, downloaded }) => {
          const info = infoOf(entry)
          const active = Boolean(operation) && downloading === entry.id
          return (
            <div
              className={`model-list-item glass-panel-medium ${downloaded ? 'downloaded' : ''} ${active ? 'downloading' : ''}`}
              style={{ '--model-accent': accent(kind === 'whisper' ? 'whisper' : entry.id) } as CSSProperties}
              key={entry.id}
            >
              <div className="model-list-icon">
                <SettingsIcon name={modelLogo(kind, info.name, info.type === 'vision')} />
              </div>
              <div className="model-list-text">
                <div className="model-list-title">
                  <span className="model-list-title-text">{info.name}</span>
                  {info.recommended ? (
                    <span className="recommended-badge">
                      {st('settings.api.localModels.badgeRecommended', 'Recommended')}
                    </span>
                  ) : null}
                  {info.type === 'text' ? (
                    <span className="text-only-badge">{st('settings.api.localModels.badgeTextOnly')}</span>
                  ) : null}
                  {info.type === 'vision' ? (
                    <span className="vision-badge">{st('settings.api.localModels.badgeVision')}</span>
                  ) : null}
                </div>
                {info.description ? <div className="model-list-description">{info.description}</div> : null}
                {info.meta.length ? (
                  <div className="model-list-meta">
                    {info.meta.map((item, index) => (
                      <span key={index} style={{ display: 'contents' }}>
                        {index ? <span>•</span> : null}
                        <span>{item}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                {active && operation ? (
                  <div className="model-list-progress">
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${operation.total ? Math.round((100 * operation.bytes) / operation.total) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="progress-info">
                      <span>{operation.total ? Math.round((100 * operation.bytes) / operation.total) : 0}%</span>
                      <span>
                        {formatBytes(operation.bytes)} / {formatBytes(operation.total || 0)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="model-list-actions">
                {active ? (
                  <button
                    className="action-btn cancel glass-button-small"
                    onClick={(event) => {
                      event.stopPropagation()
                      void ws.act(() => ws.api.cancelLocal(kind).then(() => undefined))
                    }}
                  >
                    <SettingsIcon name="close" />
                    <span>{st('settings.api.localModels.cancel', 'Cancel')}</span>
                  </button>
                ) : downloaded ? (
                  <SettingsIcon name="check_circle" className="check-icon" />
                ) : (
                  <button
                    className="action-btn download glass-button-small"
                    disabled={Boolean(operation) || !state.modelCatalog.some((item) => item.id === entry.id)}
                    onClick={(event) => {
                      event.stopPropagation()
                      onDownload(entry.id)
                    }}
                  >
                    <SettingsIcon name="download" />
                    <span>{st('settings.api.localModels.download', 'Download')}</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
