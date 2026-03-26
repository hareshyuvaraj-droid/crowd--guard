import { useEffect, useRef, useState, useCallback } from 'react'

export function useWSLive() {
  const [zones, setZones]         = useState([])
  const [connected, setConnected] = useState(false)
  const [lastTs, setLastTs]       = useState(null)
  const wsRef   = useRef(null)
  const pingRef = useRef(null)

  const connect = useCallback(() => {
    // Clear any existing ping interval before reconnecting
    if (pingRef.current) clearInterval(pingRef.current)

    const base = import.meta.env.VITE_WS_URL ||
      (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host
    const ws = new WebSocket(`${base}/ws/live`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      // Keep-alive ping every 20s
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 20000)
    }

    ws.onmessage = e => {
      // Guard against binary frames — only process text
      if (typeof e.data !== 'string') return
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'zone_update') {
          setZones(msg.zones)
          setLastTs(msg.ts)
        }
      } catch {
        // Ignore malformed messages
      }
    }

    // Single onclose — clears ping and schedules reconnect
    ws.onclose = () => {
      if (pingRef.current) clearInterval(pingRef.current)
      setConnected(false)
      setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()  // triggers onclose → reconnect
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (pingRef.current) clearInterval(pingRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { zones, connected, lastTs }
}
