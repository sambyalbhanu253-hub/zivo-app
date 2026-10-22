export type ChannelProfile = {
  name: string
  handle: string
  description: string
  communityEnabled: boolean
  privacyEnabled: boolean
  avatarUrl: string
  bannerUrl: string
}

export const DEFAULT_CHANNEL_PROFILE: ChannelProfile = {
  name: 'Sanatan Shakti parivar',
  handle: 'BhanuSambyal-e5s6j',
  description: '🙏 Welcome to Sanatan Vision 🙏...',
  communityEnabled: false,
  privacyEnabled: true,
  avatarUrl: '',
  bannerUrl: '',
}

const CHANNEL_PROFILE_KEY = 'pulse:channel-profile:v1'

export function loadChannelProfile(): ChannelProfile {
  const saved = window.localStorage.getItem(CHANNEL_PROFILE_KEY)
  if (!saved) return DEFAULT_CHANNEL_PROFILE

  let value: unknown
  try {
    value = JSON.parse(saved)
  } catch {
    throw new Error('Saved channel details could not be read. Clear the saved channel settings and try again.')
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Saved channel details have an unexpected format.')
  }
  const record = value as Record<string, unknown>

  return {
    name: typeof record.name === 'string' ? record.name : DEFAULT_CHANNEL_PROFILE.name,
    handle: typeof record.handle === 'string' ? record.handle : DEFAULT_CHANNEL_PROFILE.handle,
    description: typeof record.description === 'string' ? record.description : DEFAULT_CHANNEL_PROFILE.description,
    communityEnabled: typeof record.communityEnabled === 'boolean' ? record.communityEnabled : DEFAULT_CHANNEL_PROFILE.communityEnabled,
    privacyEnabled: typeof record.privacyEnabled === 'boolean' ? record.privacyEnabled : DEFAULT_CHANNEL_PROFILE.privacyEnabled,
    avatarUrl: typeof record.avatarUrl === 'string' ? record.avatarUrl : DEFAULT_CHANNEL_PROFILE.avatarUrl,
    bannerUrl: typeof record.bannerUrl === 'string' ? record.bannerUrl : DEFAULT_CHANNEL_PROFILE.bannerUrl,
  }
}

export function saveChannelProfile(profile: ChannelProfile) {
  window.localStorage.setItem(CHANNEL_PROFILE_KEY, JSON.stringify(profile))
}
