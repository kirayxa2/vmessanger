"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2 } from "lucide-react"

const ACCENT = "#7e85e1"

interface CallModalProps {
  incomingCall?: {
    callId: number
    callType: "audio" | "video"
    initiatorId: string
    initiatorName: string
    initiatorAvatar?: string
  } | null
  outgoingCall?: {
    callId: number
    callType: "audio" | "video"
    receiverId: string
    receiverName: string
    receiverAvatar?: string
  } | null
  onAccept?: () => void
  onDecline?: () => void
  onHangup?: () => void
  socket: any
  currentUserId: string
}

type CallState = "incoming" | "outgoing" | "connected" | "ended"

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ]
}

export default function CallModal({
  incomingCall, outgoingCall, onAccept, onDecline, onHangup, socket, currentUserId
}: CallModalProps) {
  const [callState, setCallState] = useState<CallState>(incomingCall ? "incoming" : "outgoing")
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [statusText, setStatusText] = useState(incomingCall ? "Входящий звонок" : "Вызов...")
  const [hasCamera, setHasCamera] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStartedRef = useRef(false)
  const acceptedRef = useRef(false) // receiver принял звонок

  const callId = incomingCall?.callId || outgoingCall?.callId
  const otherUserId = incomingCall?.initiatorId || outgoingCall?.receiverId
  const otherName = incomingCall?.initiatorName || outgoingCall?.receiverName || ""
  const otherAvatar = incomingCall?.initiatorAvatar || outgoingCall?.receiverAvatar

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.()
      .then(devices => setHasCamera(devices.some(d => d.kind === "videoinput")))
      .catch(() => {})
  }, [])

  const startTimer = useCallback(() => {
    if (timerStartedRef.current) return
    timerStartedRef.current = true
    setCallDuration(0)
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
  }, [])

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`

  const getLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      return stream
    } catch (err: any) {
      console.error("getUserMedia error:", err?.name, err?.message)
      setStatusText("Нет доступа к микрофону")
      return null
    }
  }, [])

  // Создаём RTCPeerConnection
  const createPeer = useCallback((stream: MediaStream): RTCPeerConnection => {
    // Закрываем предыдущий если есть
    if (peerRef.current) {
      peerRef.current.close()
    }

    const peer = new RTCPeerConnection(ICE_SERVERS)
    peerRef.current = peer

    stream.getTracks().forEach(track => peer.addTrack(track, stream))

    peer.ontrack = (event) => {
      console.log("ontrack:", event.streams)
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0]
      }
    }

    peer.onicecandidate = (event) => {
      if (event.candidate && socket && otherUserId) {
        socket.emit("call-ice", { callId, targetUserId: otherUserId, candidate: event.candidate })
      }
    }

    const handleConnected = () => {
      console.log("Peer connected!")
      setCallState("connected")
      setStatusText("")
      startTimer()
    }

    peer.onconnectionstatechange = () => {
      console.log("connectionState:", peer.connectionState)
      if (peer.connectionState === "connected") handleConnected()
      else if (peer.connectionState === "failed") setStatusText("Ошибка соединения")
    }

    peer.oniceconnectionstatechange = () => {
      console.log("iceConnectionState:", peer.iceConnectionState)
      if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
        handleConnected()
      }
    }

    return peer
  }, [socket, otherUserId, callId, startTimer])

  // ── SOCKET EVENTS ────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    // Инициатор: receiver принял, теперь нужно создать offer и отправить
    // ВАЖНО: call-accepted — кастомное событие которое receiver шлёт до offer
    const handleCallAccepted = async (data: { callId: number }) => {
      if (data.callId !== callId) return
      console.log("call-accepted: receiver accepted, creating offer")

      // Меняем UI у инициатора — уже не "Вызов..."
      setCallState("connected")
      setStatusText("Соединение...")

      const stream = await getLocalStream()
      if (!stream) return

      const peer = createPeer(stream)
      try {
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        socket.emit("call-offer", { callId, receiverId: otherUserId, sdp: offer })
      } catch (err) {
        console.error("createOffer error:", err)
      }
    }

    // Инициатор: получил SDP answer от receiver
    const handleCallAnswered = async (data: { callId: number; sdp: RTCSessionDescriptionInit }) => {
      if (data.callId !== callId) return
      console.log("call-answered: got SDP answer")
      const peer = peerRef.current
      if (!peer) return
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp))
      } catch (err) {
        console.error("setRemoteDescription(answer) error:", err)
      }
    }

    // Receiver: получил SDP offer от инициатора
    const handleCallOffer = async (data: { callId: number; sdp: RTCSessionDescriptionInit }) => {
      if (data.callId !== callId) return
      console.log("call-offer received")

      // Если receiver ещё не принял — игнорируем (не должно быть, но на всякий)
      if (!acceptedRef.current) {
        console.log("Got offer but not accepted yet, buffering...")
        // Буферизуем — обработаем когда примет
      }

      const stream = localStreamRef.current || await getLocalStream()
      if (!stream) return

      const peer = createPeer(stream)
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp))
        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        socket.emit("call-answer", { callId, initiatorId: otherUserId, sdp: answer })
        setCallState("connected")
        setStatusText("Соединение...")
        startTimer()
      } catch (err) {
        console.error("handleCallOffer error:", err)
      }
    }

    // ICE кандидат
    const handleIce = async (data: { callId: number; candidate: RTCIceCandidateInit }) => {
      if (data.callId !== callId) return
      try {
        if (peerRef.current?.remoteDescription) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
        }
      } catch {}
    }

    const handleCallDeclined = (data: { callId: number }) => {
      if (data.callId !== callId) return
      setCallState("ended")
      setStatusText("Звонок отклонён")
      setTimeout(() => onHangup?.(), 2000)
    }

    const handleCallEnded = (data: { callId: number }) => {
      if (data.callId !== callId) return
      setCallState("ended")
      setStatusText("Звонок завершён")
      setTimeout(() => onHangup?.(), 1500)
    }

    socket.on("call-accepted", handleCallAccepted)
    socket.on("call-answered", handleCallAnswered)
    socket.on("call-offer", handleCallOffer)
    socket.on("call-ice", handleIce)
    socket.on("call-declined", handleCallDeclined)
    socket.on("call-ended", handleCallEnded)

    return () => {
      socket.off("call-accepted", handleCallAccepted)
      socket.off("call-answered", handleCallAnswered)
      socket.off("call-offer", handleCallOffer)
      socket.off("call-ice", handleIce)
      socket.off("call-declined", handleCallDeclined)
      socket.off("call-ended", handleCallEnded)
    }
  }, [socket, callId, otherUserId, createPeer, getLocalStream, startTimer, onHangup])

  // Исходящий — просто ждём, offer отправим когда получим call-accepted
  // (Старый flow: offer сразу. Новый: offer только после принятия)
  useEffect(() => {
    if (!outgoingCall) return
    // Ничего не делаем — ждём call-accepted от receiver
  }, [])

  // Принять входящий звонок
  const acceptCall = useCallback(async () => {
    acceptedRef.current = true

    // Получаем микрофон заранее
    const stream = await getLocalStream()
    // stream сохранён в localStreamRef — будет использован когда придёт offer

    // Сообщаем инициатору что приняли — он пришлёт offer
    socket?.emit("call-accepted", { callId, initiatorId: otherUserId })

    setCallState("connected")
    setStatusText("Соединение...")
    onAccept?.()
  }, [socket, callId, otherUserId, getLocalStream, onAccept])

  const declineCall = useCallback(() => {
    socket?.emit("call-declined", { callId, initiatorId: otherUserId })
    fetch("/api/calls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId, status: "declined" }),
    }).catch(() => {})
    onDecline?.()
  }, [socket, callId, otherUserId, onDecline])

  const hangup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    peerRef.current?.close()
    peerRef.current = null
    socket?.emit("call-ended", { callId, otherUserId })
    fetch("/api/calls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId, status: "ended" }),
    }).catch(() => {})
    onHangup?.()
  }, [socket, callId, otherUserId, onHangup])

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }, [])

  const toggleCamera = useCallback(async () => {
    if (!isVideoOn) {
      try {
        const vs = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
        if (localVideoRef.current) localVideoRef.current.srcObject = vs
        if (peerRef.current && localStreamRef.current) {
          peerRef.current.addTrack(vs.getVideoTracks()[0], localStreamRef.current)
        }
        setIsVideoOn(true)
      } catch {
        setStatusText("Нет доступа к камере")
        setTimeout(() => setStatusText(""), 2000)
      }
    } else {
      if (localVideoRef.current?.srcObject) {
        (localVideoRef.current.srcObject as MediaStream).getVideoTracks().forEach(t => t.stop())
        localVideoRef.current.srcObject = null
      }
      setIsVideoOn(false)
    }
  }, [isVideoOn])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      peerRef.current?.close()
    }
  }, [])

  const displayStatus = () => {
    if (callState === "connected" && !statusText) return formatDuration(callDuration)
    return statusText
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-between"
      style={{ background: "linear-gradient(160deg, #1a1f2e 0%, #0d1117 100%)" }}
    >
      {/* Remote video */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: isVideoOn && callState === "connected" ? "block" : "none" }}
      />
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Аватар + имя */}
      <div className="relative z-10 pt-16 pb-4 flex flex-col items-center w-full px-6">
        <div className="relative mb-4">
          <motion.div
            animate={callState === "incoming" || callState === "outgoing"
              ? { boxShadow: ["0 0 0 0px rgba(126,133,225,0.4)", "0 0 0 28px rgba(126,133,225,0)"] }
              : {}}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center text-white text-5xl font-bold"
            style={{ backgroundColor: ACCENT }}
          >
            {otherAvatar
              ? <img src={otherAvatar} className="w-full h-full object-cover" alt="" />
              : otherName[0]?.toUpperCase()
            }
          </motion.div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
            <Phone size={14} color="white" />
          </div>
        </div>

        <h2 className="text-white text-2xl font-bold mb-1">{otherName}</h2>
        <motion.p key={displayStatus()} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="text-gray-300 text-[15px]">
          {displayStatus()}
        </motion.p>
      </div>

      {/* Своё видео PiP */}
      {isVideoOn && callState === "connected" && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          className="absolute top-20 right-4 z-20 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </motion.div>
      )}

      {/* Кнопки */}
      <div className="relative z-10 pb-16 w-full px-8">
        {callState === "incoming" ? (
          <div className="flex items-center justify-around">
            <div className="flex flex-col items-center gap-2">
              <motion.button whileTap={{ scale: 0.88 }} onClick={declineCall}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{ backgroundColor: "#e53935" }}>
                <PhoneOff size={26} color="white" />
              </motion.button>
              <span className="text-white/70 text-[12px]">Отклонить</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <motion.button whileTap={{ scale: 0.88 }} onClick={acceptCall}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{ backgroundColor: "#43a047" }}>
                <Phone size={26} color="white" />
              </motion.button>
              <span className="text-white/70 text-[12px]">Принять</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-around flex-wrap gap-y-4">
            <div className="flex flex-col items-center gap-2">
              <motion.button whileTap={{ scale: 0.88 }} onClick={toggleMute}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: isMuted ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)" }}>
                {isMuted ? <MicOff size={22} color="white" /> : <Mic size={22} color="white" />}
              </motion.button>
              <span className="text-white/60 text-[11px]">{isMuted ? "Включить" : "Выкл. звук"}</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <motion.button whileTap={{ scale: 0.88 }} onClick={hangup}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{ backgroundColor: "#e53935" }}>
                <PhoneOff size={26} color="white" />
              </motion.button>
              <span className="text-white/70 text-[12px]">Завершить</span>
            </div>

            {hasCamera && (
              <div className="flex flex-col items-center gap-2">
                <motion.button whileTap={{ scale: 0.88 }} onClick={toggleCamera}
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: isVideoOn ? ACCENT : "rgba(255,255,255,0.12)" }}>
                  {isVideoOn ? <Video size={22} color="white" /> : <VideoOff size={22} color="white" />}
                </motion.button>
                <span className="text-white/60 text-[11px]">{isVideoOn ? "Камера вкл" : "Камера"}</span>
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              <motion.button whileTap={{ scale: 0.88 }}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                <Volume2 size={22} color="white" />
              </motion.button>
              <span className="text-white/60 text-[11px]">Динамик</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
