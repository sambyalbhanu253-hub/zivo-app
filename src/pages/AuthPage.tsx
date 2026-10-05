import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { useAuth } from '../auth/AuthProvider'

export default function AuthPage({ initialMode }: { initialMode: 'sign-in' | 'sign-up' }) {
  const { user, ready, error: storageError, signIn, signUp, sendVerificationLink, verifyLink } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [verificationLink, setVerificationLink] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const handledToken = useRef<string | null>(null)
  const token = new URLSearchParams(location.search).get('local_token')

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    if (!token || handledToken.current === token) return
    handledToken.current = token
    try {
      verifyLink(token)
      setMessage('Email verified. You’re signed in on this device.')
      navigate('/profile', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to verify this link.')
    }
  }, [token, verifyLink, navigate])

  if (!ready) return <main className="auth-page"><p>Loading your account…</p></main>
  if (user && !token) return <Navigate to="/profile" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'sign-up') await signUp(email, password, displayName)
      else await signIn(email, password)
      navigate('/profile', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to complete authentication.')
    } finally {
      setBusy(false)
    }
  }

  function requestLink() {
    setError('')
    setMessage('')
    setVerificationLink('')
    try {
      setVerificationLink(sendVerificationLink(email))
      setMessage('Demo verification link created. It works on this device and expires in 15 minutes.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create a verification link.')
    }
  }

  return (
    <main className="auth-page">
      <Link aria-label="ZIVO home" className="brand auth-brand" to="/">
        <span className="brand-mark"><Icon name="play" size={16} /></span>
        <span>ZIVO</span>
      </Link>
      <section aria-labelledby="auth-title" className="auth-card">
        <p className="eyebrow">{mode === 'sign-up' ? 'JOIN THE COMMUNITY' : 'WELCOME BACK'}</p>
        <h1 id="auth-title">{mode === 'sign-up' ? 'Create your account' : 'Sign in to ZIVO'}</h1>
        <p className="auth-description">Your ZIVO account is saved on this device.</p>

        <div aria-label="Account options" className="auth-mode-switch">
          <Link aria-current={mode === 'sign-in' ? 'page' : undefined} to="/sign-in">Sign in</Link>
          <Link aria-current={mode === 'sign-up' ? 'page' : undefined} to="/sign-up">Create account</Link>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'sign-up' && (
            <label>
              Name
              <input
                autoComplete="name"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
                type="text"
                value={displayName}
              />
            </label>
          )}
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              minLength={mode === 'sign-up' ? 8 : undefined}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === 'sign-up' ? 'At least 8 characters' : 'Your password'}
              required
              type="password"
              value={password}
            />
          </label>
          <button className="primary-button auth-submit" disabled={busy} type="submit">
            {busy ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
            {!busy && <Icon name="arrow" size={17} />}
          </button>
        </form>

        <div className="auth-divider"><span>OR</span></div>
        <button className="auth-link-button" onClick={requestLink} type="button">
          Send a sign-in / verification link
        </button>
        <p className="auth-demo-note">Local demo mode: no email is sent. The generated link verifies this device.</p>

        {(storageError || error) && <p aria-live="polite" className="auth-feedback is-error">{storageError || error}</p>}
        {message && <p aria-live="polite" className="auth-feedback">{message}</p>}
        {verificationLink && (
          <div className="auth-verification">
            <span>Verification link</span>
            <a href={verificationLink}>{verificationLink}</a>
          </div>
        )}
      </section>
    </main>
  )
}
