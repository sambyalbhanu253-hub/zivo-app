import { useEffect, useRef, useState } from 'react'
import {
  connectGoogleAccount,
  loadAccountConnections,
  loadGoogleIdentityServices,
  promptGoogleOneTap,
  requestGoogleProfile,
  selectConnectedAccount,
  type ConnectedAccount,
} from '../lib/connectedAccounts'

type AccountsModalProps = {
  onClose: () => void
  onAccountChange: (account: ConnectedAccount) => void
}

export default function AccountsModal({ onClose, onAccountChange }: AccountsModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onAccountChangeRef = useRef(onAccountChange)
  onAccountChangeRef.current = onAccountChange
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [activeGoogleId, setActiveGoogleId] = useState('')
  const [googleReady, setGoogleReady] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const connections = loadAccountConnections()
      setAccounts(connections.accounts)
      setActiveGoogleId(connections.activeGoogleId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Connected Google accounts could not be loaded.')
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
    if (!clientId) {
      setError('Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID and reload the app.')
      return
    }

    void loadGoogleIdentityServices()
      .then(() => {
        setGoogleReady(true)
        promptGoogleOneTap(clientId, applyGoogleProfile, (reason) => setError(reason.message))
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Google sign-in could not be loaded.')
      })
  }, [])

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = document.querySelectorAll<HTMLElement>(
        '#accounts-dialog button:not([disabled])',
      )
      const first = focusable.item(0)
      const last = focusable.item(focusable.length - 1)

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [onClose])

  function applyGoogleProfile(profile: Awaited<ReturnType<typeof requestGoogleProfile>>) {
    try {
      const result = connectGoogleAccount(profile)
      setAccounts(result.connections.accounts)
      setActiveGoogleId(result.connections.activeGoogleId)
      const account = result.connections.accounts.find((candidate) => candidate.googleId === profile.sub)
      if (!account) throw new Error('The connected Google account could not be found.')
      onAccountChangeRef.current(account)
      setError('')
      setMessage(result.alreadyConnected
        ? `${account.name} is already connected and is now active.`
        : 'Google account connected and set as active.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Google account could not be connected.')
    }
  }

  function handleConnectAccount() {
    setError('')
    setMessage('')

    let signIn: Promise<Awaited<ReturnType<typeof requestGoogleProfile>>>
    try {
      signIn = requestGoogleProfile(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Google sign-in could not be started.')
      return
    }

    setIsConnecting(true)
    void signIn
      .then(applyGoogleProfile)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Google account could not be connected.')
      })
      .finally(() => setIsConnecting(false))
  }

  return (
    <div className="accounts-modal">
      <button aria-label="Close accounts dialog" className="accounts-overlay" onClick={onClose} type="button" />
      <section
        aria-labelledby="accounts-dialog-title"
        aria-modal="true"
        className="accounts-content"
        id="accounts-dialog"
        role="dialog"
      >
        <header className="accounts-header">
          <h2 id="accounts-dialog-title">Accounts</h2>
          <button
            aria-label="Close accounts dialog"
            className="accounts-close-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        <div aria-label="Connected Google accounts" className="accounts-list">
          {accounts.length === 0 && (
            <p className="accounts-empty">Connect a Google account to see your profile here.</p>
          )}
          {accounts.map((account) => (
            <button
              aria-pressed={activeGoogleId === account.googleId}
              className={`account-item${activeGoogleId === account.googleId ? ' is-active' : ''}`}
              key={account.googleId}
              onClick={() => {
                try {
                  const connections = selectConnectedAccount(account.googleId)
                  setActiveGoogleId(connections.activeGoogleId)
                  onAccountChangeRef.current(account)
                  setError('')
                  setMessage(`${account.name} is the active account.`)
                } catch (reason) {
                  setError(reason instanceof Error ? reason.message : 'The active account could not be changed.')
                }
              }}
              type="button"
            >
              <span aria-hidden="true" className="account-avatar">
                {account.initials}
                {account.pictureUrl && (
                  <img
                    alt=""
                    onError={(event) => { event.currentTarget.hidden = true }}
                    referrerPolicy="no-referrer"
                    src={account.pictureUrl}
                  />
                )}
              </span>
              <span className="account-info">
                <span className="account-name">{account.name}</span>
                <span className="account-handle">@{account.handle}</span>
                <span className="account-email">{account.email}</span>
              </span>
              {activeGoogleId === account.googleId && <span aria-label="Active account" className="account-checkmark">✓</span>}
            </button>
          ))}
        </div>

        <button
          className="add-account-button"
          disabled={!googleReady || isConnecting}
          onClick={handleConnectAccount}
          type="button"
        >
          <span aria-hidden="true" className="accounts-plus-icon">+</span>
          {isConnecting ? 'Connecting to Google…' : 'Connect another account'}
        </button>
        {error && <p className="accounts-status is-error" role="alert">{error}</p>}
        {message && <p className="accounts-status" role="status">{message}</p>}
      </section>
    </div>
  )
}
