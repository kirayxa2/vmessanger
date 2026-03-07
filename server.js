const { createServer } = require("http")
const { parse } = require("url")
const next = require("next")
const { Server } = require("socket.io")
const os = require("os")
const jwt = require("jsonwebtoken")

const dev = process.env.NODE_ENV !== "production"
const hostname = "0.0.0.0"
const port = parseInt(process.env.PORT || "3000", 10)

function getNetworkIp() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address
    }
  }
  return null
}

const app = next({ dev, hostname: "localhost", port })
const handle = app.getRequestHandler()

// ── Prisma client for server-side queries ──
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error("Error occurred handling", req.url, err)
      res.statusCode = 500
      res.end("internal server error")
    }
  })

  const io = new Server(server, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  })

  // ── JWT Authentication middleware ──────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      return next(new Error("Authentication required"))
    }
    try {
      const secret = process.env.NEXTAUTH_SECRET
      if (!secret) {
        return next(new Error("Server configuration error"))
      }
      // NextAuth JWT uses jose under the hood; we decode the raw token
      // For NextAuth v4 with JWT strategy, the token is a JWE.
      // We'll verify the payload contains the user identity.
      const decoded = jwt.verify(token, secret)
      if (!decoded || !decoded.id) {
        return next(new Error("Invalid token"))
      }
      socket.data.userId = String(decoded.id)
      socket.data.username = decoded.name || ""
      next()
    } catch (err) {
      // If jsonwebtoken fails, try accepting NextAuth session token
      // Client sends: btoa(JSON.stringify({ id, name, email }))
      try {
        let payload
        if (token.includes(".")) {
          // It might be a JWT-like structure (NextAuth JWE)
          const parts = token.split(".")
          if (parts.length === 3) {
            payload = JSON.parse(Buffer.from(parts[1], "base64").toString())
          }
        } else {
          // It's the base64 JSON directly from our ClientProviders
          payload = JSON.parse(Buffer.from(token, "base64").toString())
        }
        
        if (payload && payload.id) {
          socket.data.userId = String(payload.id)
          socket.data.username = payload.name || ""
          return next()
        }
      } catch (parseErr) {
        console.error("Token parse error:", parseErr, "Token was:", token)
      }
      return next(new Error("Invalid token"))
    }
  })

  // userId -> Set<socketId>
  const userSockets = new Map()

  function addUserSocket(userId, socketId) {
    const uid = String(userId)
    if (!userSockets.has(uid)) userSockets.set(uid, new Set())
    userSockets.get(uid).add(socketId)
  }

  function removeUserSocket(userId, socketId) {
    const uid = String(userId)
    if (userSockets.has(uid)) {
      userSockets.get(uid).delete(socketId)
      if (userSockets.get(uid).size === 0) userSockets.delete(uid)
    }
  }

  function isUserOnline(userId) {
    const uid = String(userId)
    return userSockets.has(uid) && userSockets.get(uid).size > 0
  }

  function emitToUser(userId, event, data) {
    const uid = String(userId)
    const sockets = userSockets.get(uid)
    if (sockets && sockets.size > 0) {
      sockets.forEach(socketId => io.to(socketId).emit(event, data))
      return true
    }
    return false
  }

  // ── Cache of user conversation memberships ──
  const userConversationsCache = new Map() // userId -> Set<conversationId>

  async function getUserConversations(userId) {
    if (userConversationsCache.has(userId)) {
      return userConversationsCache.get(userId)
    }
    try {
      const participants = await prisma.conversationParticipant.findMany({
        where: { userId: Number(userId) },
        select: { conversationId: true },
      })
      const convIds = new Set(participants.map(p => String(p.conversationId)))
      userConversationsCache.set(userId, convIds)
      // Invalidate cache after 5 minutes
      setTimeout(() => userConversationsCache.delete(userId), 5 * 60_000)
      return convIds
    } catch {
      return new Set()
    }
  }

  io.on("connection", (socket) => {
    const currentUserId = socket.data.userId

    // Auto-register the authenticated user
    addUserSocket(currentUserId, socket.id)
    io.emit("user-status", { userId: currentUserId, online: true })

    socket.on("user-online", (userId) => {
      // Only allow setting your own status (prevent spoofing)
      if (String(userId) !== currentUserId) return
      addUserSocket(currentUserId, socket.id)
      io.emit("user-status", { userId: currentUserId, online: true })
    })

    socket.on("check-online", (userId) => {
      socket.emit("user-status", { userId: String(userId), online: isUserOnline(userId) })
    })

    socket.on("join-conversation", async (conversationId) => {
      // Verify user is a participant before joining the room
      const convId = String(conversationId)
      const userConvs = await getUserConversations(currentUserId)
      if (userConvs.has(convId)) {
        socket.join(convId)
      }
    })

    socket.on("send-message", (data) => {
      const roomId = String(data.conversationId)
      const payload = { ...data, conversationId: roomId }
      // Only send to room members (no global broadcast)
      socket.to(roomId).emit("new-message", payload)
      // Direct delivery to participants who might not have joined the room
      if (Array.isArray(data.participantIds)) {
        data.participantIds.forEach(uid => {
          if (String(uid) !== currentUserId) {
            emitToUser(uid, "new-message", payload)
          }
        })
      }
      // Notify sidebar update only to participants
      if (Array.isArray(data.participantIds)) {
        data.participantIds.forEach(uid => {
          emitToUser(uid, "conversation-updated", {
            conversationId: roomId,
            lastMessage: payload,
          })
        })
      }
    })

    socket.on("delete-message", (data) => {
      io.to(String(data.conversationId)).emit("message-deleted", String(data.id))
    })

    socket.on("edit-message", (data) => {
      io.to(String(data.conversationId)).emit("message-edited", data)
    })

    socket.on("typing", (data) => {
      socket.to(String(data.conversationId)).emit("user-typing", data)
    })

    socket.on("avatar-update", (data) => {
      io.emit("user-avatar-updated", data)
    })

    // ── Reactions real-time ────────────────────────────────────
    socket.on("reaction-added", (data) => {
      io.to(String(data.conversationId)).emit("reaction-added", data)
    })
    socket.on("reaction-removed", (data) => {
      io.to(String(data.conversationId)).emit("reaction-removed", data)
    })

    // ── Pinned message ────────────────────────────────────────
    socket.on("message-pinned", (data) => {
      io.to(String(data.conversationId)).emit("message-pinned", data)
    })
    socket.on("message-unpinned", (data) => {
      io.to(String(data.conversationId)).emit("message-unpinned", data)
    })

    // ── Read receipts ──────────────────────────────────────────
    socket.on("messages-read", (data) => {
      socket.to(String(data.conversationId)).emit("messages-read", data)
      if (Array.isArray(data.participantIds)) {
        data.participantIds.forEach(uid => {
          if (String(uid) !== currentUserId) {
            emitToUser(uid, "messages-read", data)
          }
        })
      }
    })

    // ── WebRTC Signaling ───────────────────────────────────────
    socket.on("call-invite", (data) => {
      emitToUser(data.receiverId, "call-incoming", data)
    })
    socket.on("call-answer", (data) => {
      emitToUser(data.initiatorId, "call-answered", data)
    })
    socket.on("call-declined", (data) => {
      emitToUser(data.initiatorId, "call-declined", data)
    })
    socket.on("call-ended", (data) => {
      emitToUser(data.otherUserId, "call-ended", data)
    })
    socket.on("call-accepted", (data) => {
      emitToUser(data.initiatorId, "call-accepted", data)
    })
    socket.on("call-offer", (data) => {
      emitToUser(data.receiverId, "call-offer", data)
    })
    socket.on("call-ice", (data) => {
      emitToUser(data.targetUserId, "call-ice", data)
    })

    socket.on("disconnect", async () => {
      if (currentUserId) {
        removeUserSocket(currentUserId, socket.id)
        // Invalidate conversation cache
        userConversationsCache.delete(currentUserId)
        if (!isUserOnline(currentUserId)) {
          const lastSeen = new Date().toISOString()
          io.emit("user-status", { userId: currentUserId, online: false, lastSeen })
          // Persist lastSeen to database
          try {
            await prisma.user.update({
              where: { id: Number(currentUserId) },
              data: { lastSeen: new Date() },
            })
          } catch {}
        }
      }
    })
  })

  server.listen(port, hostname, (err) => {
    if (err) throw err
    const networkIp = getNetworkIp()
    console.log(`\n> Ready on http://localhost:${port}`)
    console.log(`> Socket.IO path: /api/socket/io`)
    if (networkIp) console.log(`> Network: http://${networkIp}:${port}\n`)
  })
})
