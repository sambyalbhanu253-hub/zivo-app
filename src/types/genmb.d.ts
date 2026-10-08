type GenMBDataOptions = {
  scope?: 'user'
  owned?: boolean
}

type GenMBKeyValueClient = {
  get: (key: string, options?: GenMBDataOptions) => Promise<unknown>
  list: (prefix: string, options?: GenMBDataOptions) => Promise<unknown>
  set: (key: string, value: unknown, options?: GenMBDataOptions) => Promise<unknown>
  delete?: (key: string, options?: GenMBDataOptions) => Promise<unknown>
}

type GenMBStorageClient = {
  upload: (file: File, options?: { folder?: string }) => Promise<{ url?: string }>
}

type GenMBRealtimeClient = {
  publish: (channel: string, payload: unknown) => Promise<unknown>
  subscribe: (channel: string, callback: (payload: unknown) => void) => () => void
}

type GenMBPlatformClient = {
  kv?: GenMBKeyValueClient
  storage?: GenMBStorageClient
  realtime?: GenMBRealtimeClient
}

type GenMBResolvedMedia = {
  src: string
  mediaBase: string
}

interface Window {
  genmb?: GenMBPlatformClient
  GenMBFileStorage?: {
    resolveAsset: (src: string) => GenMBResolvedMedia | null
  }
}
