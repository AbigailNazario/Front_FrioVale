import { useState } from 'react'
import { Activity, RefreshCw, Zap } from 'lucide-react'
import { api } from '../api'
import { useAsyncData } from '../hooks/useAsyncData'
import { fmt, formatDateTime } from '../data'

export default function IoTLogs() {
  const { data, loading, error, reload } = useAsyncData(() => api.iotLogs())
  const { data: impacts, reload: reloadImpacts } = useAsyncData(() => api.recentImpacts())
  const [view, setView] = useState<'readings' | 'impacts'>('readings')
  const [syncing, setSyncing] = useState(false)
  const [feedback, setFeedback] = useState<string>()
  const [syncError, setSyncError] = useState<string>()

  const logs = data ?? []
  const impactList = impacts ?? []

  const sync = async () => {
    if (syncing) return
    setSyncing(true)
    setFeedback(undefined)
    setSyncError(undefined)
    try {
      const result = await api.syncIoTLogs()
      setFeedback(result.saved > 0
        ? `${result.saved} novo(s) log(s) importado(s) do ThingSpeak.`
        : 'Nenhum log novo encontrado nos canais cadastrados.')
      reload()
      reloadImpacts()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Não foi possível sincronizar com o ThingSpeak.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="page wide">
      <span className="eyebrow">Integração IoT</span>
      <h1 className="title">Logs do ThingSpeak</h1>
      <p className="muted">Histórico bruto das leituras e impactos recebidos dos canais do sistema IoT.</p>

      {feedback && <p className="muted" style={{ marginTop: 12 }}>{feedback}</p>}
      {syncError && <p className="muted" style={{ marginTop: 12 }}>{syncError}</p>}

      <div className="card">
        <div className="card-head row">
          <div>
            <h3>{view === 'readings' ? 'Últimas leituras recebidas' : 'Últimos impactos recebidos'}</h3>
            <p>Valores gravados a partir dos canais ThingSpeak dos contêineres.</p>
          </div>
          <button className="btn ghost" onClick={sync} disabled={syncing}>
            <RefreshCw size={13} />{syncing ? 'Sincronizando...' : 'Sincronizar ThingSpeak'}
          </button>
        </div>

        <div className="tabs seg" style={{ margin: '0 20px 16px' }}>
          <button className={view === 'readings' ? 'on' : ''} onClick={() => setView('readings')}>
            <Activity size={14} /> Leituras
          </button>
          <button className={view === 'impacts' ? 'on' : ''} onClick={() => setView('impacts')}>
            <Zap size={14} /> Impactos
          </button>
        </div>

        {view === 'readings' ? (
          <>
            {loading && <p className="muted" style={{ padding: '0 20px 20px' }}>Carregando logs...</p>}
            {error && <p className="muted" style={{ padding: '0 20px 20px' }}>{error}</p>}
            <table>
              <thead>
                <tr>
                  <th>Contêiner</th><th>Canal</th><th>Entrada</th><th>Temperatura</th>
                  <th>Umidade</th><th>Registrado em</th>
                </tr>
              </thead>
              <tbody>
                {!loading && logs.length === 0 && (
                  <tr><td colSpan={6} className="muted">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Activity size={14} /> Nenhum log recebido. Cadastre um contêiner com canal ThingSpeak e sincronize.
                    </span>
                  </td></tr>
                )}
                {logs.map(log => (
                  <tr key={log.id}>
                    <td><b>{log.containerCode ?? '—'}</b></td>
                    <td>{log.channelId}</td>
                    <td>{log.entryId ?? '—'}</td>
                    <td>{log.temperature == null ? '—' : `${fmt(log.temperature)} °C`}</td>
                    <td>{log.humidity == null ? '—' : `${fmt(log.humidity)} %`}</td>
                    <td>{formatDateTime(log.recordedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            {/* Eventos individuais (canal de eventos 3551998) */}
            <h4 className="section-heading">Eventos de impacto</h4>
            <table>
              <thead>
                <tr><th>Contêiner</th><th>Dispositivo / Placa</th><th>Pico (g)</th><th>Data e horário</th></tr>
              </thead>
              <tbody>
                {impactList.length === 0 && (
                  <tr><td colSpan={4} className="muted">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Zap size={14} /> Nenhum impacto registrado nos canais cadastrados.
                    </span>
                  </td></tr>
                )}
                {impactList.map(i => (
                  <tr key={i.id}>
                    <td><b>{i.containerCode ?? '—'}</b></td>
                    <td>{i.plate ?? '—'}</td>
                    <td className={i.peakG >= 2 ? 'hot' : ''}><b>{i.peakG.toFixed(1).replace('.', ',')} g</b></td>
                    <td>{formatDateTime(i.originalTimestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Leituras do acelerômetro (field3/field4/field5 do canal de telemetria) */}
            <h4 className="section-heading">Leituras do acelerômetro</h4>
            <table>
              <thead>
                <tr><th>Contêiner</th><th>Data e horário</th><th>Pico do intervalo</th><th>Inclinação</th><th>Impactos na sessão</th></tr>
              </thead>
              <tbody>
                {logs.filter(l => l.peakG != null || l.tiltDeg != null || l.sessionImpactCount != null).length === 0 && (
                  <tr><td colSpan={5} className="muted">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Activity size={14} /> Nenhuma leitura do acelerômetro disponível.
                    </span>
                  </td></tr>
                )}
                {logs.filter(l => l.peakG != null || l.tiltDeg != null || l.sessionImpactCount != null).map(log => (
                  <tr key={`accel-${log.id}`}>
                    <td><b>{log.containerCode ?? '—'}</b></td>
                    <td>{formatDateTime(log.recordedAt)}</td>
                    <td>{log.peakG == null ? '—' : `${fmt(log.peakG)} g`}</td>
                    <td>{log.tiltDeg == null ? '—' : `${fmt(log.tiltDeg)}°`}</td>
                    <td>{log.sessionImpactCount == null ? '—' : String(log.sessionImpactCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
