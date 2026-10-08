import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'

const ROOM_ID = 'pulse-lounge'
const MESSAGE_PREFIX = `pulse:message:${ROOM_ID}:`
const ROOM_CHANNEL = `pulse:messages:${ROOM_ID}`

type ChatMessage = {
  id: string
  roomId: string
  senderId: string
  senderName: string
  body: string
  sentAt: number
  readBy: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    value.roomId !== ROOM_ID ||
    typeof value.senderId !== 'string' ||
    typeof value.senderName !== 'string' ||
    typeof value.body !== 'string' ||
    typeof value.sentAt !== 'number' ||
    !Array.isArray(value.readBy) ||
    !value.readBy.every((userId) => typeof userId === 'string')
  ) return null

  return {
    id: value.id,
    roomId: ROOM_ID,
    senderId: value.senderId,
    senderName: value.senderName,
    body: value.body,
    sentAt: value.sentAt,
    readBy: value.readBy,
  }
}

function readEntries(value: unknown): ChatMessage[] {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new Error('The message service returned an invalid response.')
  }

  return value.data
    .map((entry) => isRecord(entry) ? readMessage(entry.value) : null)
    .filter((message): message is ChatMessage => message !== null)
    .sort((first, second) => first.sentAt - second.sentAt)
}

function makeMessageId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function messageTime(sentAt: number, now: number) {
  const age = Math.max(0, now - sentAt)
  if (age < 60_000) return 'Just now'
  if (age < 60 * 60_000) return `${Math.floor(age / 60_000)}m ago`

  const date = new Date(sentAt)
  if (date.toDateString() === new Date(now).toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function formatFullTime(sentAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(sentAt)
}

export default function MessagesPage() {
  const [guestId] = useState(() => {
    const storageKey = 'pulse:guest-id'
    try {
      const existingId = window.localStorage.getItem(storageKey)
      if (existingId) return existingId
      const newId = makeMessageId()
      window.localStorage.setItem(storageKey, newId)
      return newId
    } catch {
      return makeMessageId()
    }
  })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const listRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)
  const latestMessagesRef = useRef(messages)

  useEffect(() => {
    latestMessagesRef.current = messages
  }, [messages])

  const loadMessages = useCallback(async () => {
    const store = window.genmb?.kv
    if (!store) throw new Error('The PULSE message service is not available.')
    const response = await store.list(MESSAGE_PREFIX)
    const nextMessages = readEntries(response)
    latestMessagesRef.current = nextMessages
    setMessages(nextMessages)
    return nextMessages
  }, [])

  const markMessagesSeen = useCallback(async (items: ChatMessage[]) => {
    const store = window.genmb?.kv
    const realtime = window.genmb?.realtime
    if (!store || !realtime) throw new Error('The PULSE message service is not available.')

    const unread = items.filter((message) => message.senderId !== guestId && !message.readBy.includes(guestId))
    if (unread.length === 0) return

    const updatedMessages = new Map<string, ChatMessage>()
    for (const message of unread) {
      const key = `${MESSAGE_PREFIX}${message.id}`
      const current = readMessage(await store.get(key)) ?? message
      const updated = current.readBy.includes(guestId)
        ? current
        : { ...current, readBy: [...current.readBy, guestId] }
      if (updated !== current) await store.set(key, updated)
      updatedMessages.set(message.id, updated)
    }
    const nextMessages = latestMessagesRef.current.map((message) => updatedMessages.get(message.id) ?? message)
    latestMessagesRef.current = nextMessages
    setMessages(nextMessages)
    await realtime.publish(ROOM_CHANNEL, { type: 'seen' })
  }, [guestId])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    const realtime = window.genmb?.realtime

    async function initializeRoom() {
      try {
        if (!realtime) throw new Error('Live messaging is not available right now.')
        unsubscribe = realtime.subscribe(ROOM_CHANNEL, () => {
          void loadMessages()
            .then((nextMessages) => markMessagesSeen(nextMessages))
            .catch((caughtError: unknown) => {
              setError(caughtError instanceof Error ? caughtError.message : 'Could not sync new messages.')
            })
        })
        const initialMessages = await loadMessages()
        if (!active) return
        setIsLoading(false)
        await markMessagesSeen(initialMessages)
      } catch (caughtError) {
        if (!active) return
        setError(caughtError instanceof Error ? caughtError.message : 'Could not connect to messages.')
        setIsLoading(false)
      }
    }

    void initializeRoom()
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [loadMessages, markMessagesSeen])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list || isLoading) return
    list.scrollTo({ top: list.scrollHeight, behavior: hasScrolledRef.current ? 'smooth' : 'auto' })
    hasScrolledRef.current = true
  }, [messages.length, isLoading])

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSending) return
    const store = window.genmb?.kv
    if (!store) {
      setError('The PULSE message service is not available.')
      return
    }
    const body = draft.trim()
    if (!body) return
    if (body.length > 2000) {
      setError('Messages must be 2,000 characters or fewer.')
      return
    }

    setIsSending(true)
    setError('')
    const message: ChatMessage = {
      id: makeMessageId(),
      roomId: ROOM_ID,
      senderId: guestId,
      senderName: `Guest ${guestId.slice(0, 4)}`,
      body,
      sentAt: Date.now(),
      readBy: [],
    }

    try {
      await store.set(`${MESSAGE_PREFIX}${message.id}`, message)
      const nextMessages = [...latestMessagesRef.current, message].sort((first, second) => first.sentAt - second.sentAt)
      latestMessagesRef.current = nextMessages
      setMessages(nextMessages)
      setDraft('')
      const realtime = window.genmb?.realtime
      if (!realtime) {
        setError('Message sent, but live updates are not available right now.')
        return
      }
      try {
        await realtime.publish(ROOM_CHANNEL, { type: 'message', id: message.id })
      } catch (publishError) {
        setError(`Message sent, but the live update could not be announced: ${publishError instanceof Error ? publishError.message : String(publishError)}`)
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Your message could not be sent.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="messages-page">
      <header className="messages-page-heading">
        <div>
          <p className="eyebrow">STAY IN THE LOOP</p>
          <h1>Messages</h1>
        </div>
        <span className="messages-live-label"><span /> Live room</span>
      </header>

      <section aria-label="PULSE Lounge chat room" className="chat-room">
        <header className="chat-room-header">
          <Link aria-label="Back to profile" className="chat-back-link" to="/profile">‹</Link>
          <div aria-hidden="true" className="chat-room-avatar">Z</div>
          <div className="chat-room-heading">
            <h2>PULSE Lounge</h2>
            <p>Public community chat · messages sync live</p>
          </div>
          <span aria-label="Live connection" className="chat-online-indicator" />
        </header>

        <div aria-live="polite" aria-relevant="additions text" className="chat-message-list" ref={listRef} role="log">
          {isLoading ? (
            <p className="chat-state-message">Connecting to the room…</p>
          ) : messages.length === 0 ? (
            <div className="chat-empty-state">
              <span aria-hidden="true" className="chat-empty-icon">✦</span>
              <h3>Welcome to the Lounge</h3>
              <p>Start the conversation. Messages appear here instantly for everyone in the room.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.senderId === guestId
              const isSeen = message.readBy.some((readerId) => readerId !== message.senderId)
              return (
                <article className={`chat-message${isOwn ? ' is-own' : ''}`} key={message.id}>
                  {!isOwn && <span aria-hidden="true" className="chat-message-avatar">{message.senderName.slice(0, 1).toUpperCase()}</span>}
                  <div className="chat-message-content">
                    {!isOwn && <span className="chat-sender-name">{message.senderName}</span>}
                    <div className="chat-bubble">
                      <p>{message.body}</p>
                      <span className="chat-message-meta">
                        <time dateTime={new Date(message.sentAt).toISOString()} title={formatFullTime(message.sentAt)}>
                          {messageTime(message.sentAt, now)}
                        </time>
                        {isOwn && (
                          <span aria-label={isSeen ? 'Seen' : 'Sent'} className={`chat-receipt${isSeen ? ' is-seen' : ''}`} title={isSeen ? 'Seen' : 'Sent'}>
                            {isSeen ? '✓✓' : '✓'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>

        {error && <p className="chat-error" role="alert">{error}</p>}
        <form className="chat-composer" onSubmit={(event) => void handleSend(event)}>
          <label className="visually-hidden" htmlFor="chat-message-input">Write a message</label>
          <textarea
            autoComplete="off"
            id="chat-message-input"
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="Message the Lounge as a guest…"
            rows={1}
            value={draft}
          />
          <button aria-label="Send message" disabled={!draft.trim() || isSending || isLoading} type="submit">
            <Icon name="arrow" size={18} />
          </button>
        </form>
        <p className="chat-room-note">Everyone in the room can read these messages · Enter sends, Shift + Enter adds a line</p>
      </section>
    </div>
  )
}
