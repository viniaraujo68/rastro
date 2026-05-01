import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react'
import { ApiKeyDisplay } from '../components/Devices/ApiKeyDisplay'
import { PermissionList } from '../components/Permissions/PermissionList'
import { PermissionForm } from '../components/Permissions/PermissionForm'
import { Ico } from '../components/icons/Ico'
import {
  getDevices, createDevice, updateDevice, deleteDevice, rotateKey,
  getPermissions, grantPermission, revokePermission, getLatestLocation,
  getShareLinks, createShareLink, revokeShareLink,
} from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import type { Device, DeviceWithKey, Location, Permission, ShareLink } from '../types'

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `${d} dias atrás`
}

function Badge({ children, color = 'green' }: { children: React.ReactNode; color?: 'green' | 'gray' }) {
  return (
    <span style={{
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 99,
      fontWeight: 600,
      background: color === 'green' ? 'var(--green-dim)' : 'var(--surface2)',
      color: color === 'green' ? 'var(--green)' : 'var(--text3)',
    }}>
      {children}
    </span>
  )
}

export default function DevicesPage() {
  const { user } = useAuth()
  const [devices, setDevices] = useState<Device[]>([])
  const [latestLocations, setLatestLocations] = useState<Record<string, Location | null>>({})
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({})
  const [permissionsLoading, setPermissionsLoading] = useState<Record<string, boolean>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDeviceKey, setNewDeviceKey] = useState<DeviceWithKey | null>(null)
  const [loading, setLoading] = useState(true)
  const [shareLinks, setShareLinks] = useState<Record<string, ShareLink[]>>({})
  const [shareLinksLoading, setShareLinksLoading] = useState<Record<string, boolean>>({})
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const createInputRef = useRef<HTMLInputElement>(null)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getDevices()
      setDevices(list)
      const entries = await Promise.all(
        list.map(async d => {
          try {
            const r = await getLatestLocation(d.id)
            return [d.id, r.location] as const
          } catch {
            return [d.id, null] as const
          }
        })
      )
      setLatestLocations(Object.fromEntries(entries))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDevices() }, [loadDevices])

  useEffect(() => {
    if (showCreate) {
      setTimeout(() => createInputRef.current?.focus(), 50)
    }
  }, [showCreate])

  async function loadPermissions(deviceId: string) {
    setPermissionsLoading(p => ({ ...p, [deviceId]: true }))
    try {
      const list = await getPermissions(deviceId)
      setPermissions(p => ({ ...p, [deviceId]: list }))
    } finally {
      setPermissionsLoading(p => ({ ...p, [deviceId]: false }))
    }
  }

  async function loadShareLinks(deviceId: string) {
    setShareLinksLoading(s => ({ ...s, [deviceId]: true }))
    try {
      const list = await getShareLinks(deviceId)
      setShareLinks(s => ({ ...s, [deviceId]: list }))
    } finally {
      setShareLinksLoading(s => ({ ...s, [deviceId]: false }))
    }
  }

  function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!permissions[id]) loadPermissions(id)
    if (!shareLinks[id]) loadShareLinks(id)
  }

  async function handleCreateShareLink(deviceId: string, hours: number) {
    await createShareLink(deviceId, hours)
    await loadShareLinks(deviceId)
  }

  async function handleRevokeShareLink(deviceId: string, token: string) {
    await revokeShareLink(token)
    await loadShareLinks(deviceId)
  }

  async function handleCopyLink(token: string) {
    const url = `${window.location.origin}/share/${token}`
    await navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    const device = await createDevice(name)
    setNewDeviceKey(device)
    setShowCreate(false)
    setNewName('')
    await loadDevices()
    setExpandedId(device.id)
  }

  function handleCreateKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleCreate()
  }

  async function handleToggleActive(device: Device) {
    await updateDevice(device.id, device.name, !device.is_active)
    await loadDevices()
  }

  async function handleDelete(device: Device) {
    if (!window.confirm(`Tem certeza que quer deletar "${device.name}"?`)) return
    if (!window.confirm('ATENÇÃO: isso apagará TODO o histórico de localização. Confirmar?')) return
    await deleteDevice(device.id)
    if (expandedId === device.id) setExpandedId(null)
    await loadDevices()
  }

  async function handleRotateKey(device: Device) {
    if (!window.confirm('Isso vai invalidar a API key atual. Continuar?')) return
    const result = await rotateKey(device.id)
    setNewDeviceKey({ ...device, api_key: result.api_key })
  }

  async function handleGrant(deviceId: string, email: string, permission: 'view' | 'admin') {
    await grantPermission(deviceId, email, permission)
    await loadPermissions(deviceId)
  }

  async function handleRevoke(deviceId: string, userId: string) {
    if (!window.confirm('Revogar acesso deste usuário?')) return
    await revokePermission(deviceId, userId)
    await loadPermissions(deviceId)
  }

  return (
    <div style={styles.root}>
      <div style={styles.content}>
        {/* Page header */}
        <div style={styles.pageHeader}>
          <div>
            <h2 style={styles.pageTitle}>Devices</h2>
            <p style={styles.pageSubtitle}>{devices.length} device{devices.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowCreate(s => !s)}
            style={styles.addBtn}
          >
            <Ico name="plus" size={15} color="var(--bg)" />
            Novo
          </button>
        </div>

        {/* Inline create form */}
        {showCreate && (
          <div style={styles.createForm}>
            <input
              ref={createInputRef}
              type="text"
              placeholder="Nome do device"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={handleCreateKeyDown}
              style={styles.createInput}
            />
            <div style={styles.createBtns}>
              <button onClick={handleCreate} style={styles.createPrimaryBtn}>Criar</button>
              <button onClick={() => { setShowCreate(false); setNewName('') }} style={styles.createGhostBtn}>Cancelar</button>
            </div>
          </div>
        )}

        {loading && <p style={styles.hint}>Carregando...</p>}

        {!loading && devices.length === 0 && !showCreate && (
          <p style={styles.hint}>Nenhum device ainda. Crie um para começar.</p>
        )}

        {/* New device key banner */}
        {newDeviceKey && (
          <div style={styles.keyBanner}>
            <div style={styles.keyBannerHeader}>
              <strong>API Key de "{newDeviceKey.name}" — guarde agora!</strong>
              <button onClick={() => setNewDeviceKey(null)} style={styles.closeBtn}>
                <Ico name="x" size={14} />
              </button>
            </div>
            <ApiKeyDisplay apiKey={newDeviceKey.api_key} />
          </div>
        )}

        {/* Device list */}
        <div style={styles.list}>
          {devices.map(device => {
            const loc = latestLocations[device.id]
            const isExpanded = expandedId === device.id
            const isOwner = device.owner_id === user?.id

            return (
              <div key={device.id} style={{
                ...styles.card,
                borderColor: isExpanded ? 'var(--border2)' : 'var(--border)',
              }}>
                {/* Card header */}
                <button
                  onClick={() => handleExpand(device.id)}
                  style={styles.cardHeader}
                  className="tap-none"
                >
                  {/* Device icon */}
                  <div style={{
                    ...styles.deviceIcon,
                    background: device.is_active ? 'var(--accent-dim)' : 'var(--surface2)',
                  }}>
                    <Ico name="devices" size={18} color={device.is_active ? 'var(--accent)' : 'var(--text3)'} />
                  </div>

                  {/* Info */}
                  <div style={styles.cardInfo}>
                    <div style={styles.cardNameRow}>
                      <span style={styles.deviceName}>{device.name}</span>
                      <Badge color={device.is_active ? 'green' : 'gray'}>
                        {device.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div style={styles.cardMeta}>
                      {loc ? (
                        <>
                          <span style={styles.metaText}>{formatRelative(loc.timestamp)}</span>
                          {loc.battery_level != null && (
                            <span style={styles.metaText}>{loc.battery_level}%</span>
                          )}
                        </>
                      ) : (
                        <span style={styles.metaText}>Sem dados</span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <span style={{
                    ...styles.chevron,
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>
                    <Ico name="chevronDown" size={16} color="var(--text3)" />
                  </span>
                </button>

                {/* Card body */}
                {isExpanded && (
                  <div style={styles.cardBody}>
                    {isOwner && (
                      <section style={styles.section}>
                        <p style={styles.sectionTitle}>API Key</p>
                        <p style={styles.sectionHint}>
                          A key não é exibida após a criação por segurança. Use "Rotacionar" para gerar uma nova.
                        </p>
                        <button onClick={() => handleRotateKey(device)} style={styles.actionBtn}>
                          <Ico name="refresh" size={13} />
                          Rotacionar API key
                        </button>
                      </section>
                    )}

                    {isOwner && (
                      <section style={styles.section}>
                        <p style={styles.sectionTitle}>Links de compartilhamento</p>
                        {shareLinksLoading[device.id] && <p style={styles.sectionHint}>Carregando...</p>}
                        {!shareLinksLoading[device.id] && (shareLinks[device.id] ?? []).map(link => (
                          <div key={link.id} style={styles.shareRow}>
                            <span style={styles.shareExpiry}>
                              expira {new Date(link.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button onClick={() => handleCopyLink(link.id)} style={styles.actionBtn}>
                              {copiedToken === link.id
                                ? <><Ico name="check" size={13} color="var(--green)" /> Copiado</>
                                : <><Ico name="copy" size={13} /> Copiar link</>
                              }
                            </button>
                            <button onClick={() => handleRevokeShareLink(device.id, link.id)} style={styles.revokeShareBtn}>
                              Revogar
                            </button>
                          </div>
                        ))}
                        {!shareLinksLoading[device.id] && (shareLinks[device.id] ?? []).length === 0 && (
                          <p style={styles.sectionHint}>Nenhum link ativo.</p>
                        )}
                        <div style={styles.shareCreate}>
                          {([1, 24, 168] as const).map(h => (
                            <button key={h} onClick={() => handleCreateShareLink(device.id, h)} style={styles.actionBtn}>
                              <Ico name="link" size={13} />
                              {h === 1 ? '1h' : h === 24 ? '24h' : '7d'}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {isOwner && (
                      <section style={styles.section}>
                        <p style={styles.sectionTitle}>Acessos</p>
                        <PermissionList
                          permissions={permissions[device.id] ?? []}
                          loading={permissionsLoading[device.id]}
                          onRevoke={uid => handleRevoke(device.id, uid)}
                        />
                        <div style={{ marginTop: 10 }}>
                          <PermissionForm
                            onGrant={(email, perm) => handleGrant(device.id, email, perm)}
                          />
                        </div>
                      </section>
                    )}

                    {isOwner && (
                      <section style={{ ...styles.section, ...styles.actionsRow }}>
                        <button onClick={() => handleToggleActive(device)} style={styles.secondaryBtn}>
                          {device.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button onClick={() => handleDelete(device)} style={styles.deleteBtn}>
                          <Ico name="trash" size={13} color="var(--red)" />
                          Deletar device
                        </button>
                      </section>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { flex: 1, overflowY: 'auto', background: 'var(--bg)' },
  content: { padding: '20px 16px', maxWidth: 720, width: '100%', margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  pageTitle: { fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' },
  pageSubtitle: { fontSize: 13, color: 'var(--text3)', marginTop: 2 },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', background: 'var(--text)', color: 'var(--bg)',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    flexShrink: 0,
  },
  createForm: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    animation: 'slideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  createInput: {
    padding: '8px 12px',
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: 8,
    color: 'var(--text)',
    outline: 'none',
    fontSize: 14,
  },
  createBtns: { display: 'flex', gap: 8 },
  createPrimaryBtn: {
    padding: '7px 16px', background: 'var(--text)', color: 'var(--bg)',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  createGhostBtn: {
    padding: '7px 16px', background: 'transparent', color: 'var(--text2)',
    border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  hint: { fontSize: 13, color: 'var(--text3)' },
  keyBanner: {
    background: 'var(--yellow-dim)', border: '1px solid rgba(251,191,36,0.2)',
    borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10,
  },
  keyBannerHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--yellow)',
  },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex' },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
    overflow: 'hidden', transition: 'border-color 0.15s',
  },
  cardHeader: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  },
  deviceIcon: {
    width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
  cardInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 },
  cardNameRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const },
  deviceName: { fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  cardMeta: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const },
  metaText: { fontSize: 12, color: 'var(--text3)' },
  chevron: { flexShrink: 0, marginLeft: 4, transition: 'transform 0.2s', display: 'flex' },
  cardBody: { borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' },
  section: {
    padding: 16, borderBottom: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
    letterSpacing: '0.05em', color: 'var(--text3)',
  },
  sectionHint: { fontSize: 12, color: 'var(--text3)' },
  actionsRow: { flexDirection: 'row' as const, justifyContent: 'space-between', borderBottom: 'none' },
  actionBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--text2)', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  secondaryBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--text2)', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  deleteBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', background: 'var(--red-dim)',
    border: '1px solid rgba(248,113,113,0.2)', color: 'var(--red)',
    borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  shareRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    flexWrap: 'wrap' as const, marginBottom: 6,
  },
  shareExpiry: { fontSize: 12, color: 'var(--text3)', flex: 1 },
  shareCreate: { display: 'flex', gap: 6, marginTop: 4 },
  revokeShareBtn: {
    padding: '6px 12px', background: 'var(--red-dim)',
    border: '1px solid rgba(248,113,113,0.2)', color: 'var(--red)',
    borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  },
}
