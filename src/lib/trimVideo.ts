export type TrimmedVideo = {
  file: File
  startTime: number
  endTime: number
}

async function recordTrimmedVideo(
  video: HTMLVideoElement,
  file: File,
  end: number,
  onStream: (stream: MediaStream) => void,
): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser cannot record trimmed video.')
  }

  const capturableVideo = video as HTMLVideoElement & {
    captureStream?: () => MediaStream
    webkitCaptureStream?: () => MediaStream
  }
  const capture = capturableVideo.captureStream ?? capturableVideo.webkitCaptureStream
  if (!capture) throw new Error('This browser cannot capture video for trimming.')

  const capturedStream = capture.call(video)
  onStream(capturedStream)
  const mimeType = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/mp4',
  ].find((type) => MediaRecorder.isTypeSupported(type))
  const recorder = mimeType
    ? new MediaRecorder(capturedStream, { mimeType })
    : new MediaRecorder(capturedStream)

  return new Promise<Blob>((resolve, reject) => {
    const chunks: Blob[] = []
    let settled = false
    let endCheckId: number | undefined

    const cleanup = () => {
      if (endCheckId !== undefined) window.clearInterval(endCheckId)
      video.removeEventListener('timeupdate', stopAtEnd)
      video.removeEventListener('ended', stopAtEnd)
    }
    const fail = (reason: Error) => {
      if (settled) return
      settled = true
      cleanup()
      video.pause()
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // Recorder errors are handled by the source-file fallback.
        }
      }
      reject(reason)
    }
    const stopAtEnd = () => {
      if (video.currentTime < end || recorder.state !== 'recording') return
      video.pause()
      try {
        recorder.stop()
      } catch (reason) {
        fail(new Error(`The trimmed video could not be stopped: ${reason instanceof Error ? reason.message : String(reason)}`))
      }
    }

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    })
    recorder.addEventListener('error', () => fail(new Error('The trimmed video could not be recorded.')), { once: true })
    recorder.addEventListener('stop', () => {
      if (settled) return
      settled = true
      cleanup()
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || file.type })
      if (!blob.size) {
        reject(new Error('The trimmed video recording was empty.'))
        return
      }
      resolve(blob)
    }, { once: true })
    video.addEventListener('timeupdate', stopAtEnd)
    video.addEventListener('ended', stopAtEnd)

    try {
      recorder.start()
      endCheckId = window.setInterval(stopAtEnd, 10)
      void video.play().catch((reason: unknown) => {
        fail(new Error(`The video could not play while trimming: ${reason instanceof Error ? reason.message : String(reason)}`))
      })
    } catch (reason) {
      fail(new Error(`The trimmed video could not be started: ${reason instanceof Error ? reason.message : String(reason)}`))
    }
  })
}

export async function trimVideoFile(file: File, startTime: number, endTime: number): Promise<TrimmedVideo> {
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || endTime <= startTime) {
    throw new Error('Choose a valid start and end time before saving this Short.')
  }

  const sourceUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.playsInline = true
  video.muted = false

  let stream: MediaStream | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true })
      video.addEventListener('error', () => reject(new Error('The selected video could not be decoded for trimming.')), { once: true })
      video.src = sourceUrl
    })

    const duration = video.duration
    const start = Math.min(startTime, duration)
    const end = Math.min(endTime, duration)
    if (!Number.isFinite(duration) || end <= start) {
      throw new Error('The selected trim range is outside the video duration.')
    }

    await new Promise<void>((resolve, reject) => {
      const eventName = start === 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        ? 'loadeddata'
        : 'seeked'
      const onReady = () => resolve()
      const onError = () => reject(new Error('The video could not seek to the selected start time.'))
      if (start === 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        resolve()
        return
      }
      video.addEventListener(eventName, onReady, { once: true })
      video.addEventListener('error', onError, { once: true })
      video.currentTime = start
    })

    let trimmedBlob: Blob
    try {
      trimmedBlob = await recordTrimmedVideo(video, file, end, (capturedStream) => {
        stream = capturedStream
      })
    } catch {
      // Preserve the source file and enforce the selected range during playback.
      return { file, startTime: start, endTime: end }
    }

    const outputType = trimmedBlob.type || file.type
    const extension = outputType.includes('webm') ? 'webm' : 'mp4'
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'pulse-short'
    const trimmedFile = new File([trimmedBlob], `${baseName}.${extension}`, { type: outputType })
    return {
      file: trimmedFile,
      startTime: 0,
      endTime: end - start,
    }
  } finally {
    video.pause()
    stream?.getTracks().forEach((track) => track.stop())
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(sourceUrl)
  }
}
