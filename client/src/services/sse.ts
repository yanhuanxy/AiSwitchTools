type SseHandlers = {
  onMeta?: (data: any) => void
  onDelta?: (data: any) => void
  onThought?: (data: any) => void
  onToolUse?: (data: any) => void
  onToolResult?: (data: any) => void
  onDone?: (data: any) => void
  onError?: (data: any) => void
  onOpen?: () => void
  onClose?: () => void
  onStatus?: (status: "connecting" | "open" | "reconnecting" | "closed") => void
  onRetry?: (retryCount: number, delay: number) => void
}

let activeConnections = 0

export const createSseConnection = (options: {
  url: string
  token?: string | null
  handlers: SseHandlers
  lastEventId?: string | null
}) => {
  const { url, token, handlers } = options
  if (activeConnections >= 3) {
    throw new Error("SSE connections limit reached")
  }

  let retryCount = 0
  let stopped = false
  let lastEventId: string | null = options.lastEventId || null
  let source: EventSource | null = null

  const buildUrl = () => {
    const target = new URL(url, window.location.origin)
    if (token) {
      target.searchParams.set("accessToken", token)
    }
    if (lastEventId) {
      target.searchParams.set("lastEventId", lastEventId)
    }
    return target.toString()
  }

  const connect = () => {
    if (stopped) return
    handlers.onStatus?.("connecting")
    activeConnections += 1
    source = new EventSource(buildUrl())
    source.onopen = () => {
      retryCount = 0
      handlers.onOpen?.()
      handlers.onStatus?.("open")
    }
    source.addEventListener("meta", (event) => {
      const message = event as MessageEvent
      const data = JSON.parse(message.data)
      lastEventId = message.lastEventId || data?.eventId || data?.lastEventId || lastEventId
      handlers.onMeta?.(data)
    })
    source.addEventListener("delta", (event) => {
      const message = event as MessageEvent
      const data = JSON.parse(message.data)
      lastEventId = message.lastEventId || data?.eventId || data?.lastEventId || lastEventId
      handlers.onDelta?.(data)
    })
    source.addEventListener("thought", (event) => {
      const message = event as MessageEvent
      const data = JSON.parse(message.data)
      lastEventId = message.lastEventId || data?.eventId || data?.lastEventId || lastEventId
      handlers.onThought?.(data)
    })
    source.addEventListener("tool_use", (event) => {
      const message = event as MessageEvent
      const data = JSON.parse(message.data)
      lastEventId = message.lastEventId || data?.eventId || data?.lastEventId || lastEventId
      handlers.onToolUse?.(data)
    })
    source.addEventListener("tool_result", (event) => {
      const message = event as MessageEvent
      const data = JSON.parse(message.data)
      lastEventId = message.lastEventId || data?.eventId || data?.lastEventId || lastEventId
      handlers.onToolResult?.(data)
    })
    source.addEventListener("done", (event) => {
      const message = event as MessageEvent
      const data = JSON.parse(message.data)
      lastEventId = message.lastEventId || data?.eventId || data?.lastEventId || lastEventId
      handlers.onDone?.(data)
      close()
    })
    source.addEventListener("error", (event) => {
      handlers.onError?.(event)
      reconnect()
    })
  }

  const reconnect = () => {
    if (stopped) return
    close(false)
    retryCount += 1
    const delay = Math.min(1000 * 2 ** retryCount, 15000)
    handlers.onStatus?.("reconnecting")
    handlers.onRetry?.(retryCount, delay)
    window.setTimeout(connect, delay)
  }

  const close = (triggerClose = true) => {
    if (source) {
      source.close()
      source = null
      activeConnections = Math.max(0, activeConnections - 1)
      if (triggerClose) handlers.onClose?.()
      if (triggerClose) handlers.onStatus?.("closed")
    }
  }

  connect()

  return {
    close: () => {
      stopped = true
      close()
    }
  }
}
