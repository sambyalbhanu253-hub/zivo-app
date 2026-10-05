type GenMBKeyValueClient = {
  get: (key: string) => Promise<unknown>
  list: (prefix: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<unknown>
}

type GenMBRealtimeClient = {
  publish: (channel: string, payload: unknown) => Promise<unknown>
  subscribe: (channel: string, callback: (payload: unknown) => void) => () => void
}

type GenMBPlatformClient = {
  kv?: GenMBKeyValueClient
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
