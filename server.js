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
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"],
  })

  // userId (string) -> Set<socketId>
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
      sockets.forEach(socketId => {
        io.to(socketId).emit(event, data)
      })
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

      // 1. Room broadcast (excludes sender socket)
      socket.to(roomId).emit("new-message", payload)

      // 2. Direct to each participant by userId (backup if they missed join)
      if (Array.isArray(data.participantIds)) {
        data.participantIds.forEach(uid => {
          if (String(uid) !== String(currentUserId)) {
            emitToUser(uid, "new-message", payload)
          }
        })
      }

      // 3. Sidebar unread counts
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
