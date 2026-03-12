"use client"

import { useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"
import { useSocket } from "@/app/ClientProviders"

const SESSION_KEY = "vortex_session_id"

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export function useDeviceSession() {
  const { data: session } = useSession()
  const { socket } = useSocket()
  const registeredRef = useRef(false)

  const sessionId = typeof window !== "undefined" ? getOrCreateSessionId() : ""

  // Register session on login
  useEffect(() => {
    if (!session?.user?.id || registeredRef.current || !sessionId) return
    registeredRef.current = true

    fetch("/api/users/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {})
  }, [session?.user?.id, sessionId])

  // Listen for force-logout
  useEffect(() => {
    if (!socket) return
    const handler = (data: { sessionId?: string }) => {
      // If no sessionId specified → terminate all; if matches current → logout
      if (!data.sessionId || data.sessionId === sessionId) {
        // Remove session record then sign out
        fetch("/api/users/sessions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }).finally(() => {
          signOut({ callbackUrl: "/login" })
        })
      }
    }
    socket.on("force-logout", handler)
    return () => { socket.off("force-logout", handler) }
  }, [socket, sessionId])

  return { sessionId }
}
