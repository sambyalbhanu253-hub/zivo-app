export type GoogleProfile = {
  sub: string
  name: string
  email: string
  email_verified: boolean
  picture?: string
}

export type ConnectedAccount = {
  googleId: string
  name: string
  email: string
  pictureUrl: string
  handle: string
  initials: string
}

export type AccountConnections = {
  accounts: ConnectedAccount[]
  activeGoogleId: string
}

const STORAGE_KEY = 'pulse.connected-accounts.v2'
const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client'

function isConnectedAccount(value: unknown): value is ConnectedAccount {
  if (typeof value !== 'object' || value === null) return false
  const account = value as Record<string, unknown>
  return typeof account.googleId === 'string'
    && typeof account.name === 'string'
    && typeof account.email === 'string'
    && typeof account.pictureUrl === 'string'
    && typeof account.handle === 'string'
    && typeof account.initials === 'string'
}

function isAccountConnections(value: unknown): value is AccountConnections {
  if (typeof value !== 'object' || value === null) return false
  const connections = value as Record<string, unknown>
  return Array.isArray(connections.accounts)
    && connections.accounts.every(isConnectedAccount)
    && typeof connections.activeGoogleId === 'string'
}

function readConnections(): AccountConnections {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return { accounts: [], activeGoogleId: '' }

  let value: unknown
  try {
    value = JSON.parse(stored)
  } catch (reason) {
    throw new Error(`Saved Google accounts could not be read: ${reason instanceof Error ? reason.message : String(reason)}`)
  }

  if (!isAccountConnections(value)) {
    throw new Error('Saved Google accounts have an invalid format. Clear this app’s connected-account data and try again.')
  }

  if (value.accounts.length > 0 && !value.accounts.some((account) => account.googleId === value.activeGoogleId)) {
    throw new Error('The selected Google account is missing from the saved account list.')
  }
  return value
}

function saveConnections(connections: AccountConnections) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
}

function accountFromGoogleProfile(profile: GoogleProfile): ConnectedAccount {
  if (!profile.sub || !profile.name.trim() || !profile.email_verified || !profile.email.trim()) {
    throw new Error('Google did not return a verified email address and full name for this account.')
  }

  let pictureUrl = ''
  if (profile.picture) {
    try {
      const picture = new URL(profile.picture)
      if (picture.protocol === 'https:') pictureUrl = picture.toString()
    } catch {
      pictureUrl = ''
    }
  }

  const email = profile.email.trim().toLowerCase()
  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const emailHandle = email.slice(0, email.lastIndexOf('@')).replace(/[^a-z0-9._-]/g, '').toLowerCase()

  return {
    googleId: profile.sub,
    name: profile.name.trim(),
    email,
    pictureUrl,
    handle: emailHandle || 'creator',
    initials: initials || profile.name.trim().slice(0, 2).toUpperCase(),
  }
}

let googleScriptPromise: Promise<void> | null = null

export function loadGoogleIdentityServices() {
  if (window.google?.accounts.id && window.google.accounts.oauth2) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GOOGLE_IDENTITY_SCRIPT
    script.async = true
    script.onload = () => {
      if (window.google?.accounts.id && window.google.accounts.oauth2) resolve()
      else reject(new Error('Google Identity Services loaded without its Sign-In APIs.'))
    }
    script.onerror = () => reject(new Error('Google sign-in could not be loaded. Check your connection and try again.'))
    document.head.append(script)
  }).catch((reason: unknown) => {
    googleScriptPromise = null
    throw reason
  })

  return googleScriptPromise
}

export function requestGoogleProfile(clientId: string): Promise<GoogleProfile> {
  if (!clientId) throw new Error('Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID and reload the app.')
  const googleOAuth = window.google?.accounts.oauth2
  if (!googleOAuth) throw new Error('Google sign-in is still loading. Please try again.')

  return new Promise<GoogleProfile>((resolve, reject) => {
    try {
      const client = googleOAuth.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (tokenResponse) => {
          if (tokenResponse.error || !tokenResponse.access_token) {
            reject(new Error(tokenResponse.error_description || 'Google sign-in was canceled or could not be completed.'))
            return
          }

          try {
            const responseFromGoogle = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            })
            if (!responseFromGoogle.ok) {
              throw new Error(`Google profile could not be retrieved (HTTP ${responseFromGoogle.status}).`)
            }

            const profile: unknown = await responseFromGoogle.json()
            if (!isGoogleProfile(profile)) throw new Error('Google returned incomplete profile information.')
            if (!profile.email_verified) throw new Error('This Google account does not have a verified email address.')
            resolve(profile)
          } catch (reason) {
            reject(reason instanceof Error ? reason : new Error('Google profile could not be retrieved.'))
          }
        },
      })
      client.requestAccessToken({ prompt: 'select_account' })
    } catch (reason) {
      reject(reason instanceof Error ? reason : new Error('Google sign-in could not be started.'))
    }
  })
}

function isGoogleProfile(value: unknown): value is GoogleProfile {
  if (typeof value !== 'object' || value === null) return false
  const profile = value as Record<string, unknown>
  return typeof profile.sub === 'string'
    && typeof profile.name === 'string'
    && typeof profile.email === 'string'
    && typeof profile.email_verified === 'boolean'
    && (profile.picture === undefined || typeof profile.picture === 'string')
}

function profileFromOneTapCredential(credential: string, clientId: string): GoogleProfile {
  const encodedPayload = credential.split('.')[1]
  if (!encodedPayload) throw new Error('Google returned an invalid Sign-In credential.')

  let claims: unknown
  try {
    const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const binaryPayload = atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='))
    const bytes = Uint8Array.from(binaryPayload, (character) => character.charCodeAt(0))
    claims = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error('Google returned an unreadable Sign-In credential.')
  }

  if (typeof claims !== 'object' || claims === null) {
    throw new Error('Google returned incomplete profile information.')
  }
  const profileClaims = claims as Record<string, unknown>
  const validIssuer = profileClaims.iss === 'https://accounts.google.com' || profileClaims.iss === 'accounts.google.com'
  if (!validIssuer || profileClaims.aud !== clientId || typeof profileClaims.exp !== 'number' || profileClaims.exp * 1000 <= Date.now()) {
    throw new Error('Google returned an invalid or expired Sign-In credential.')
  }

  const profile: unknown = {
    sub: profileClaims.sub,
    name: profileClaims.name,
    email: profileClaims.email,
    email_verified: profileClaims.email_verified,
    picture: profileClaims.picture,
  }
  if (!isGoogleProfile(profile) || !profile.email_verified) {
    throw new Error('Google did not return a verified email and complete profile information.')
  }
  return profile
}

export function promptGoogleOneTap(
  clientId: string,
  onProfile: (profile: GoogleProfile) => void,
  onError: (error: Error) => void,
) {
  if (!clientId) throw new Error('Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID and reload the app.')
  const googleIdentity = window.google?.accounts.id
  if (!googleIdentity) throw new Error('Google Sign-In is still loading. Please try again.')

  googleIdentity.initialize({
    client_id: clientId,
    auto_select: false,
    cancel_on_tap_outside: true,
    context: 'signin',
    callback: (response) => {
      try {
        if (!response.credential) throw new Error('Google Sign-In did not return a credential.')
        onProfile(profileFromOneTapCredential(response.credential, clientId))
      } catch (reason) {
        onError(reason instanceof Error ? reason : new Error('Google profile could not be read.'))
      }
    },
  })
  googleIdentity.prompt()
}

export function loadAccountConnections() {
  return readConnections()
}

export function connectGoogleAccount(profile: GoogleProfile) {
  const account = accountFromGoogleProfile(profile)
  const connections = readConnections()
  const existing = connections.accounts.find((candidate) => candidate.googleId === account.googleId)
  const nextConnections: AccountConnections = {
    accounts: existing
      ? connections.accounts.map((candidate) => candidate.googleId === account.googleId ? account : candidate)
      : [...connections.accounts, account],
    activeGoogleId: account.googleId,
  }
  saveConnections(nextConnections)
  return { connections: nextConnections, alreadyConnected: Boolean(existing) }
}

export function selectConnectedAccount(googleId: string) {
  const connections = readConnections()
  if (!connections.accounts.some((account) => account.googleId === googleId)) {
    throw new Error('That Google account is not in the connected-account list.')
  }
  const nextConnections = { ...connections, activeGoogleId: googleId }
  saveConnections(nextConnections)
  return nextConnections
}
