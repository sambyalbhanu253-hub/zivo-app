interface GoogleTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

interface GoogleTokenClient {
  requestAccessToken: (options: { prompt: string }) => void
}

interface GoogleCredentialResponse {
  credential?: string
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (options: {
          client_id: string
          auto_select?: boolean
          cancel_on_tap_outside?: boolean
          context?: 'signin' | 'signup' | 'use'
          callback: (response: GoogleCredentialResponse) => void
        }) => void
        prompt: () => void
      }
      oauth2: {
        initTokenClient: (options: {
          client_id: string
          scope: string
          callback: (response: GoogleTokenResponse) => void
        }) => GoogleTokenClient
      }
    }
  }
}

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
}
