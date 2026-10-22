import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import {
  DEFAULT_CHANNEL_PROFILE,
  loadChannelProfile,
  saveChannelProfile,
  type ChannelProfile,
} from '../lib/channelProfile'

type ImageKind = 'avatar' | 'banner'

export default function EditChannelPage() {
  const [profile, setProfile] = useState<ChannelProfile>(DEFAULT_CHANNEL_PROFILE)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bannerPreview, setBannerPreview] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    try {
      setProfile(loadChannelProfile())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Saved channel details could not be loaded.')
    }
  }, [])

  useEffect(() => {
    if (avatarPreview.startsWith('blob:')) return () => URL.revokeObjectURL(avatarPreview)
    return undefined
  }, [avatarPreview])

  useEffect(() => {
    if (bannerPreview.startsWith('blob:')) return () => URL.revokeObjectURL(bannerPreview)
    return undefined
  }, [bannerPreview])

  const channelUrl = `https://pulse.app/@${profile.handle}`

  function selectImage(kind: ImageKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for your channel artwork.')
      return
    }

    setError('')
    setNotice('')
    const preview = URL.createObjectURL(file)
    if (kind === 'avatar') {
      setAvatarFile(file)
      setAvatarPreview(preview)
    } else {
      setBannerFile(file)
      setBannerPreview(preview)
    }
    event.currentTarget.value = ''
  }

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(channelUrl)
      setError('')
      setNotice('Channel URL copied.')
    } catch {
      setNotice('')
      setError('Could not copy the channel URL. Check clipboard permissions and try again.')
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      let nextProfile = profile
      if (avatarFile || bannerFile) {
        const storage = window.genmb?.storage
        if (!storage) {
          throw new Error('Channel artwork upload is unavailable. Open the app from its configured GenMB deployment.')
        }
        const [avatar, banner] = await Promise.all([
          avatarFile ? storage.upload(avatarFile, { folder: 'pulse/profiles' }) : null,
          bannerFile ? storage.upload(bannerFile, { folder: 'pulse/profiles' }) : null,
        ])
        if (avatarFile && !avatar?.url) throw new Error('The avatar was uploaded but no image URL was returned.')
        if (bannerFile && !banner?.url) throw new Error('The banner was uploaded but no image URL was returned.')
        nextProfile = {
          ...profile,
          avatarUrl: avatar?.url ?? profile.avatarUrl,
          bannerUrl: banner?.url ?? profile.bannerUrl,
        }
      }

      saveChannelProfile(nextProfile)
      setProfile(nextProfile)
      setAvatarFile(null)
      setBannerFile(null)
      setAvatarPreview('')
      setBannerPreview('')
      setNotice('Channel details saved on this device.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Channel details could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="page-content edit-channel-page">
      <div className="edit-channel-topbar">
        <Link aria-label="Back to profile" className="edit-channel-back" to="/profile">
          <Icon name="back" size={21} />
        </Link>
        <h1>Edit channel</h1>
      </div>

      <form onSubmit={(event) => void handleSave(event)}>
        <section aria-label="Channel artwork" className="channel-artwork">
          <div
            aria-label="Channel banner preview"
            className="channel-banner-preview"
            role="img"
            style={bannerPreview || profile.bannerUrl ? { backgroundImage: `linear-gradient(90deg, rgb(9 9 15 / 24%), rgb(9 9 15 / 4%)), url("${bannerPreview || profile.bannerUrl}")` } : undefined}
          >
            <label className="channel-image-button channel-banner-button">
              <Icon name="camera" size={18} />
              <span>Change banner</span>
              <input accept="image/*" aria-label="Change channel banner" onChange={(event) => selectImage('banner', event)} type="file" />
            </label>
          </div>
          <div className="channel-avatar-wrap">
            <div
              aria-label="Channel avatar preview"
              className="channel-avatar-preview"
              role="img"
              style={avatarPreview || profile.avatarUrl ? { backgroundImage: `url("${avatarPreview || profile.avatarUrl}")` } : undefined}
            >
              {!avatarPreview && !profile.avatarUrl && <span>{profile.name.slice(0, 1).toUpperCase()}</span>}
            </div>
            <label className="channel-image-button channel-avatar-button">
              <Icon name="camera" size={16} />
              <span className="visually-hidden">Change channel avatar</span>
              <input accept="image/*" aria-label="Change channel avatar" onChange={(event) => selectImage('avatar', event)} type="file" />
            </label>
          </div>
        </section>

        <div className="edit-channel-fields">
          <label className="edit-channel-field">
            <span>Name</span>
            <input
              autoComplete="organization"
              maxLength={80}
              onChange={(event) => setProfile({ ...profile, name: event.target.value })}
              required
              value={profile.name}
            />
          </label>

          <label className="edit-channel-field edit-channel-handle-field">
            <span>Handle</span>
            <span className="handle-input-wrap">
              <span aria-hidden="true">@</span>
              <input
                autoCapitalize="none"
                autoComplete="username"
                maxLength={50}
                onChange={(event) => setProfile({ ...profile, handle: event.target.value.replace(/^@+/, '').replace(/\s/g, '') })}
                pattern="[A-Za-z0-9._-]+"
                required
                value={profile.handle}
              />
            </span>
          </label>

          <div className="edit-channel-field channel-url-field">
            <label htmlFor="channel-url">Channel URL</label>
            <div className="channel-url-copy">
              <input id="channel-url" readOnly value={channelUrl} />
              <button aria-label="Copy channel URL" className="channel-copy-button" onClick={() => void handleCopyUrl()} type="button">
                <Icon name="copy" size={19} />
              </button>
            </div>
          </div>

          <label className="edit-channel-field edit-channel-description-field">
            <span>Description</span>
            <textarea
              maxLength={1000}
              onChange={(event) => setProfile({ ...profile, description: event.target.value })}
              rows={4}
              value={profile.description}
            />
            <span className="description-character-count">{profile.description.length}/1000</span>
          </label>
        </div>

        <section aria-label="Channel preferences" className="channel-preferences">
          <label className="channel-toggle-row">
            <span>
              <span className="channel-toggle-title">My community</span>
              <span className="channel-toggle-description">Viewers can post</span>
            </span>
            <input
              checked={profile.communityEnabled}
              className="channel-switch"
              onChange={(event) => setProfile({ ...profile, communityEnabled: event.target.checked })}
              type="checkbox"
            />
          </label>
          <label className="channel-toggle-row">
            <span>
              <span className="channel-toggle-title">Privacy</span>
              <span className="channel-toggle-description">Keep all my subscriptions private</span>
            </span>
            <input
              checked={profile.privacyEnabled}
              className="channel-switch"
              onChange={(event) => setProfile({ ...profile, privacyEnabled: event.target.checked })}
              type="checkbox"
            />
          </label>
        </section>

        {error && <p className="edit-channel-message is-error" role="alert">{error}</p>}
        {notice && <p className="edit-channel-message" role="status">{notice}</p>}
        <div className="edit-channel-actions">
          <Link className="edit-channel-cancel" to="/profile">Cancel</Link>
          <button className="edit-channel-save" disabled={isSaving} type="submit">
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
