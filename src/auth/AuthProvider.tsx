import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type LocalUser = {
  id: string
  email: string
  displayName: string
}

type StoredAccount = LocalUser & {
  passwordSalt: string
  passwordHash: string
}

type PendingLink = {
  email: string
  expiresAt: number
}

type AuthContextValue = {
  user: LocalUser | null
  ready: boolean
  error: string | null
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  sendVerificationLink: (email: string) => string
  verifyLink: (token: string) => void
  signOut: () => void
}

const ACCOUNTS_KEY = 'pulse.local-auth.accounts.v1'
const SESSION_KEY = 'pulse.local-auth.session.v1'
const LINKS_KEY = 'pulse.local-auth.links.v1'
const LINK_LIFETIME = 15 * 60 * 1000

const AuthContext = createContext<AuthContextValue | null>(null)

function readJson<T>(key: string, fallback: T): T {
  const value = window.localStorage.getItem(key)
  return value === null ? fallback : JSON.parse(value) as T
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function createId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function toBase64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
}

async function hashPassword(password: string, salt: string) {
  if (!crypto.subtle) {
    throw new Error('Secure password storage is unavailable on this connection. Open PULSE over HTTPS and try again.')
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(atob(salt), (char) => char.charCodeAt(0)), iterations: 120000 },
    key,
    256,
  )
  return toBase64(new Uint8Array(bits))
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function accountName(email: string) {
  return email.split('@')[0]?.replace(/[._+-]+/g, ' ').trim() || 'PULSE creator'
}

function makeUser(account: StoredAccount): LocalUser {
  return { id: account.id, email: account.email, displayName: account.displayName }
}

function getAccounts() {
  return readJson<StoredAccount[]>(ACCOUNTS_KEY, [])
}

function persistUser(user: LocalUser | null) {
  if (user) writeJson(SESSION_KEY, user)
  else window.localStorage.removeItem(SESSION_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setUser(readJson<LocalUser | null>(SESSION_KEY, null))
    } catch {
      setError('PULSE could not read saved sign-in data. Clear this app’s site storage and try again.')
    } finally {
      setReady(true)
    }
  }, [])

  async function signUp(emailInput: string, password: string, displayName: string) {
    const email = normalizeEmail(emailInput)
    if (!validateEmail(email)) throw new Error('Enter a valid email address.')
    if (password.length < 8) throw new Error('Use a password with at least 8 characters.')
    if (!crypto.subtle) throw new Error('Secure password storage is unavailable. Open PULSE over HTTPS and try again.')
    const accounts = getAccounts()
    const existingAccount = accounts.find((account) => account.email === email)
    if (existingAccount?.passwordHash) {
      throw new Error('An account with this email already exists. Sign in instead.')
    }
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const account: StoredAccount = {
      ...existingAccount,
      id: createId(),
      email,
      displayName: displayName.trim() || existingAccount?.displayName || accountName(email),
      passwordSalt: toBase64(salt),
      passwordHash: await hashPassword(password, toBase64(salt)),
    }
    writeJson(
      ACCOUNTS_KEY,
      existingAccount
        ? accounts.map((candidate) => candidate.email === email ? account : candidate)
        : [...accounts, account],
    )
    const nextUser = makeUser(account)
    persistUser(nextUser)
    setUser(nextUser)
    setError(null)
  }

  async function signIn(emailInput: string, password: string) {
    const email = normalizeEmail(emailInput)
    if (!validateEmail(email)) throw new Error('Enter a valid email address.')
    const account = getAccounts().find((candidate) => candidate.email === email)
    if (!account || await hashPassword(password, account.passwordSalt) !== account.passwordHash) {
      throw new Error('That email and password combination was not found.')
    }
    const nextUser = makeUser(account)
    persistUser(nextUser)
    setUser(nextUser)
    setError(null)
  }

  function sendVerificationLink(emailInput: string) {
    const email = normalizeEmail(emailInput)
    if (!validateEmail(email)) throw new Error('Enter a valid email address.')
    const token = createId()
    const pending = readJson<Record<string, PendingLink>>(LINKS_KEY, {})
    pending[token] = { email, expiresAt: Date.now() + LINK_LIFETIME }
    writeJson(LINKS_KEY, pending)
    setError(null)
    return `${window.location.origin}/sign-in?local_token=${encodeURIComponent(token)}`
  }

  function verifyLink(token: string) {
    const pending = readJson<Record<string, PendingLink>>(LINKS_KEY, {})
    const link = pending[token]
    if (!link || link.expiresAt < Date.now()) {
      if (link) {
        delete pending[token]
        writeJson(LINKS_KEY, pending)
      }
      throw new Error('This verification link is invalid or expired. Request a new link.')
    }
    delete pending[token]
    writeJson(LINKS_KEY, pending)
    const email = normalizeEmail(link.email)
    const accounts = getAccounts()
    let account = accounts.find((candidate) => candidate.email === email)
    if (!account) {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const passwordSalt = toBase64(salt)
      account = {
        id: createId(),
        email,
        displayName: accountName(email),
        passwordSalt,
        passwordHash: '',
      }
      writeJson(ACCOUNTS_KEY, [...accounts, account])
    }
    const nextUser = makeUser(account)
    persistUser(nextUser)
    setUser(nextUser)
    setError(null)
  }

  function signOut() {
    try {
      persistUser(null)
      setUser(null)
      setError(null)
    } catch {
      setError('Unable to clear the saved session. Please try again.')
    }
  }

  const value = useMemo(
    () => ({ user, ready, error, signUp, signIn, sendVerificationLink, verifyLink, signOut }),
    [user, ready, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider.')
  return context
}
