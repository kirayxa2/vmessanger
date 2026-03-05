const { createServer } = require("http")
const { parse } = require("url")
const next = require("next")
const { Server } = require("socket.io")
const os = require("os")

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

  io.on("connection", (socket) => {
    let currentUserId = null

    socket.on("user-online", (userId) => {
      currentUserId = String(userId)
      addUserSocket(currentUserId, socket.id)
      io.emit("user-status", { userId: currentUserId, online: true })
    })

    socket.on("check-online", (userId) => {
      socket.emit("user-status", { userId: String(userId), online: isUserOnline(userId) })
    })

    socket.on("join-conversation", (conversationId) => {
      socket.join(String(conversationId))
    })

    socket.on("send-message", (data) => {
      const roomId = String(data.conversationId)
      const payload = { ...data, conversationId: roomId }
      socket.to(roomId).emit("new-message", payload)
      if (Array.isArray(data.participantIds)) {
        data.participantIds.forEach(uid => {
          if (String(uid) !== String(currentUserId)) {
            emitToUser(uid, "new-message", payload)
          }
        })
      }
      io.emit("new-message-global", payload)
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

    // ── Read receipts ──────────────────────────────────────────
    // Client emits this when user opens a chat and sees messages
    socket.on("messages-read", (data) => {
      // data: { conversationId, readByUserId, messageIds }
      // Notify everyone in the room that these messages were read
      socket.to(String(data.conversationId)).emit("messages-read", data)
      // Also direct to participants
      if (Array.isArray(data.participantIds)) {
        data.participantIds.forEach(uid => {
          if (String(uid) !== String(currentUserId)) {
            emitToUser(uid, "messages-read", data)
          }
        })
      }
    })

    // ── WebRTC Signaling ───────────────────────────────────────
    // call-invite: initiator -> receiver
    socket.on("call-invite", (data) => {
      // data: { callId, callType, conversationId, receiverId, initiatorId, initiatorName, initiatorAvatar }
      emitToUser(data.receiverId, "call-incoming", data)
    })

    // call-answer: receiver sends WebRTC answer back to initiator
    socket.on("call-answer", (data) => {
      // data: { callId, initiatorId, sdp }
      emitToUser(data.initiatorId, "call-answered", data)
    })

    // call-declined: receiver declines
    socket.on("call-declined", (data) => {
      // data: { callId, initiatorId }
      emitToUser(data.initiatorId, "call-declined", data)
    })

    // call-ended: either side hangs up
    socket.on("call-ended", (data) => {
      // data: { callId, otherUserId }
      emitToUser(data.otherUserId, "call-ended", data)
    })

    // call-accepted: receiver принял звонок, инициатор должен создать offer
    socket.on("call-accepted", (data) => {
      // data: { callId, initiatorId }
      emitToUser(data.initiatorId, "call-accepted", data)
    })

    // call-offer: WebRTC SDP offer from initiator
    socket.on("call-offer", (data) => {
      // data: { callId, receiverId, sdp }
      emitToUser(data.receiverId, "call-offer", data)
    })

    // call-ice: ICE candidate relay
    socket.on("call-ice", (data) => {
      // data: { callId, targetUserId, candidate }
      emitToUser(data.targetUserId, "call-ice", data)
    })

    socket.on("disconnect", () => {
      if (currentUserId) {
        removeUserSocket(currentUserId, socket.id)
        if (!isUserOnline(currentUserId)) {
          io.emit("user-status", { userId: currentUserId, online: false, lastSeen: new Date().toISOString() })
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
