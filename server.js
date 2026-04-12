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
      // Ping endpoint для UptimeRobot — не даёт Render засыпать
      if (req.url === "/ping") {
        res.statusCode = 200
        res.end("OK")
        return
      }
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

    socket.on("send-message", async (data) => {
      const roomId = String(data.conversationId)

      // ── If message has a tempId it came directly from client (no HTTP POST) ──
      if (data.tempId) {
        // Validate sender
        if (String(data.senderId) !== currentUserId) return

        // Validate content
        const hasText = data.content && typeof data.content === "string" && data.content.trim().length > 0
        const hasFile = data.fileUrl && typeof data.fileUrl === "string"
        const hasVoice = data.voiceUrl && typeof data.voiceUrl === "string"
        if (!hasText && !hasFile && !hasVoice) return
        if (hasText && data.content.length > 4096) return

        // Verify participant
        try {
          const participant = await prisma.conversationParticipant.findFirst({
            where: { conversationId: Number(data.conversationId), userId: Number(currentUserId) }
          })
          if (!participant) return

          // Save to DB
          const message = await prisma.message.create({
            data: {
              content: hasText ? data.content : "",
              conversationId: Number(data.conversationId),
              senderId: Number(currentUserId),
              ...(data.replyToId ? { replyToId: Number(data.replyToId) } : {}),
              ...(data.forwardFromId ? { forwardFromId: Number(data.forwardFromId) } : {}),
              ...(data.fileUrl ? { fileUrl: data.fileUrl, fileName: data.fileName || "file", fileSize: data.fileSize || 0, fileType: data.fileType || "application/octet-stream" } : {}),
              ...(data.voiceUrl ? { voiceUrl: data.voiceUrl, voiceDuration: data.voiceDuration || 0 } : {}),
            },
            include: {
              sender: { select: { id: true, username: true, avatar: true } },
              replyTo: { include: { sender: { select: { id: true, username: true, avatar: true } } } },
              reactions: { include: { user: { select: { id: true, username: true } } } }
            }
          })

          const saved = { ...message, conversationId: message.conversationId }

          // Confirm to sender: replace temp with real message
          socket.emit("message-confirmed", { tempId: data.tempId, message: saved })

          // Deliver to other participants
          socket.to(roomId).emit("new-message", saved)
          if (Array.isArray(data.participantIds)) {
            data.participantIds.forEach(uid => {
              if (String(uid) !== currentUserId) {
                emitToUser(uid, "new-message", saved)
                emitToUser(uid, "conversation-updated", { conversationId: roomId, lastMessage: saved })
              }
            })
          }
          // Notify sender sidebar too
          socket.emit("conversation-updated", { conversationId: roomId, lastMessage: saved })

        } catch (err) {
          console.error("Socket send-message DB error:", err)
          // Notify sender of failure so they can show error state
          socket.emit("message-failed", { tempId: data.tempId })
        }
        return
      }

      // ── Legacy path: message already saved via HTTP POST, just broadcast ──
      const payload = { ...data, conversationId: roomId }
      socket.to(roomId).emit("new-message", payload)
      if (Array.isArray(data.participantIds)) {
        data.participantIds.forEach(uid => {
          if (String(uid) !== currentUserId) {
            emitToUser(uid, "new-message", payload)
          }
        })
      }
      if (Array.isArray(data.participantIds)) {
        data.participantIds.forEach(uid => {
          emitToUser(uid, "conversation-updated", {
            conversationId: roomId,
            lastMessage: payload,
          })
        })
      }
    })

    socket.on("delete-message", async (data) => {
      const roomId = String(data.conversationId)
      // Verify sender owns the message
      try {
        const msg = await prisma.message.findUnique({ where: { id: Number(data.id) } })
        if (!msg) return
        const isParticipant = await prisma.conversationParticipant.findFirst({
          where: { conversationId: msg.conversationId, userId: Number(currentUserId) }
        })
        if (!isParticipant) return
        const deleteForAll = data.deleteForAll && String(msg.senderId) === currentUserId
        if (deleteForAll) {
          await prisma.message.delete({ where: { id: Number(data.id) } })
          io.to(roomId).emit("message-deleted", String(data.id))
        } else {
          // Delete only for self — not implemented in DB yet, just emit to sender
          socket.emit("message-deleted", String(data.id))
        }
      } catch {}
    })

    socket.on("edit-message", async (data) => {
      const roomId = String(data.conversationId)
      if (data.tempEditId) {
        // Socket-based edit (no HTTP)
        try {
          const msg = await prisma.message.findUnique({ where: { id: Number(data.id) } })
          if (!msg || String(msg.senderId) !== currentUserId) return
          if (!data.content || data.content.length > 4096) return
          const updated = await prisma.message.update({
            where: { id: Number(data.id) },
            data: { content: data.content },
            include: {
              sender: { select: { id: true, username: true, avatar: true } },
              replyTo: { include: { sender: { select: { id: true, username: true, avatar: true } } } },
              reactions: { include: { user: { select: { id: true, username: true } } } }
            }
          })
          socket.emit("edit-confirmed", { tempEditId: data.tempEditId, message: updated })
          socket.to(roomId).emit("message-edited", updated)
        } catch {}
        return
      }
      io.to(roomId).emit("message-edited", data)
    })

    socket.on("forward-message", async (data) => {
      // data: { fromMessageId, toConversationIds[], content }
      if (!Array.isArray(data.toConversationIds)) return
      try {
        const original = await prisma.message.findUnique({ where: { id: Number(data.fromMessageId) } })
        if (!original) return
        for (const convId of data.toConversationIds) {
          const participant = await prisma.conversationParticipant.findFirst({
            where: { conversationId: Number(convId), userId: Number(currentUserId) }
          })
          if (!participant) continue
          const forwarded = await prisma.message.create({
            data: {
              content: original.content || "",
              conversationId: Number(convId),
              senderId: Number(currentUserId),
              forwardFromId: original.id,
              fileUrl: original.fileUrl || undefined,
              fileName: original.fileName || undefined,
              fileSize: original.fileSize || undefined,
              fileType: original.fileType || undefined,
            },
            include: {
              sender: { select: { id: true, username: true, avatar: true } },
              replyTo: { include: { sender: { select: { id: true, username: true, avatar: true } } } },
              reactions: { include: { user: { select: { id: true, username: true } } } }
            }
          })
          const saved = { ...forwarded, conversationId: forwarded.conversationId }
          socket.to(String(convId)).emit("new-message", saved)
          socket.emit("new-message", saved)
          // Notify participants
          const participants = await prisma.conversationParticipant.findMany({
            where: { conversationId: Number(convId) }
          })
          participants.forEach(p => {
            if (String(p.userId) !== currentUserId) {
              emitToUser(String(p.userId), "new-message", saved)
              emitToUser(String(p.userId), "conversation-updated", { conversationId: String(convId), lastMessage: saved })
            }
          })
        }
      } catch (err) { console.error("forward-message error:", err) }
    })

    socket.on("typing", (data) => {
      socket.to(String(data.conversationId)).emit("user-typing", data)
    })

    // ── @mentions: notify mentioned users ──
    socket.on("mention", async (data) => {
      // data: { mentionedUserIds: number[], conversationId, messageId }
      if (!Array.isArray(data.mentionedUserIds)) return
      data.mentionedUserIds.forEach(uid => {
        if (String(uid) !== currentUserId) {
          emitToUser(String(uid), "you-were-mentioned", {
            conversationId: String(data.conversationId),
            messageId: data.messageId,
            byUserId: currentUserId,
          })
        }
      })
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

    // ── Session management ────────────────────────────────────
    socket.on("terminate-session", (data) => {
      // data: { targetUserId, sessionId }
      // Отправляем force-logout конкретному пользователю
      emitToUser(String(data.targetUserId), "force-logout", { sessionId: data.sessionId })
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
