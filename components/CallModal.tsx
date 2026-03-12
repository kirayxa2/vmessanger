"use client"
// CallModal v3 — full rewrite with quality monitor, speaker, video toggle
import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, Signal } from "lucide-react"

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

// Бесплатные публичные STUN + несколько TURN для прохода через NAT/файерволл
// Для production заменить на свой TURN (coturn) или metered.ca ($0.4/GB)
const ICE_SERVERS = {
  iceServers: [
    // Google STUN — бесплатно, работает когда оба пользователя за обычным NAT
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    // Cloudflare STUN
    { urls: "stun:stun.cloudflare.com:3478" },
    // Open Relay TURN — бесплатно для тестирования
    // Для прода заменить на metered.ca или свой coturn
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turns:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ],
  iceCandidatePoolSize: 10,
}

export default function CallModal({
  incomingCall, outgoingCall, onAccept, onDecline, onHangup, socket, currentUserId,
}: CallModalProps) {
  // Снимок данных при монтировании — не меняются когда родитель убирает props
  const callDataRef = useRef({
    callId: incomingCall?.callId ?? outgoingCall?.callId,
    otherUserId: incomingCall?.initiatorId ?? outgoingCall?.receiverId,
    otherName: incomingCall?.initiatorName ?? outgoingCall?.receiverName ?? "",
    otherAvatar: incomingCall?.initiatorAvatar ?? outgoingCall?.receiverAvatar,
    isIncoming: !!incomingCall,
    callType: incomingCall?.callType ?? outgoingCall?.callType ?? "audio",
  })
  const { callId, otherUserId, otherName, otherAvatar, isIncoming, callType } = callDataRef.current
  const isVideoCall = callType === "video"

  const [callState, setCallState] = useState<CallState>(isIncoming ? "incoming" : "outgoing")
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(isVideoCall)
  const [isSpeakerOn, setIsSpeakerOn] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [statusText, setStatusText] = useState(isIncoming ? "Входящий звонок" : "Вызов...")
  const [hasCamera, setHasCamera] = useState(false)
  const [quality, setQuality] = useState<"good"|"medium"|"poor"|null>(null)

  const localVideoRef   = useRef<HTMLVideoElement>(null)
  const remoteVideoRef  = useRef<HTMLVideoElement>(null)
  const remoteAudioRef  = useRef<HTMLAudioElement>(null)
  const peerRef         = useRef<RTCPeerConnection | null>(null)
  const localStreamRef  = useRef<MediaStream | null>(null)
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const qualityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStarted    = useRef(false)
  const iceBufRef       = useRef<RTCIceCandidateInit[]>([])

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.()
      .then(ds => setHasCamera(ds.some(d => d.kind === "videoinput")))
      .catch(() => { })
  }, [])

  // ── Таймер ────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerStarted.current) return
    timerStarted.current = true
    setCallDuration(0)
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
  }, [])

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`

  const startQualityMonitor = useCallback(() => {
    qualityTimerRef.current = setInterval(async () => {
      const peer = peerRef.current
      if (!peer) return
      try {
        const stats = await peer.getStats()
        let rtt: number | undefined, lost: number | undefined
        stats.forEach((s: any) => {
          if (s.type === "remote-inbound-rtp" && s.kind === "audio") {
            rtt = s.roundTripTime; lost = s.fractionLost
          }
        })
        if (rtt === undefined) return
        if (rtt < 0.15 && (lost ?? 0) < 0.02)     setQuality("good")
        else if (rtt < 0.4 && (lost ?? 0) < 0.08) setQuality("medium")
        else                                        setQuality("poor")
      } catch {}
    }, 3000)
  }, [])

  const toggleSpeaker = useCallback(() => {
    const audio = remoteAudioRef.current as any
    if (audio?.setSinkId) audio.setSinkId(isSpeakerOn ? "" : "default").catch(() => {})
    setIsSpeakerOn(s => !s)
  }, [isSpeakerOn])

  // ── Микрофон ──────────────────────────────────────────────────
  const getLocalStream = useCallback(async (withVideo = false): Promise<MediaStream | null> => {
    if (localStreamRef.current && !withVideo) return localStreamRef.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: withVideo ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      })
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = stream
      if (withVideo && localVideoRef.current) localVideoRef.current.srcObject = stream
      return stream
    } catch (err: any) {
      console.error("getUserMedia:", err?.name)
      setStatusText("Нет доступа к микрофону")
      return null
    }
  }, [])

  // ── Создаём RTCPeerConnection ─────────────────────────────────
  const createPeer = useCallback((stream: MediaStream): RTCPeerConnection => {
    peerRef.current?.close()
    const peer = new RTCPeerConnection(ICE_SERVERS)
    peerRef.current = peer

    stream.getTracks().forEach(t => peer.addTrack(t, stream))

    // onConnectedOnce — срабатывает ровно один раз от любого из триггеров
    let connectedFired = false
    const onConnectedOnce = () => {
      if (connectedFired) return
      connectedFired = true
      setCallState("connected")
      setStatusText("")
      startTimer()
      startQualityMonitor()
    }

    peer.ontrack = e => {
      const [remStream] = e.streams
      if (remStream) {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remStream
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remStream
      }
      onConnectedOnce()
    }

    peer.onicecandidate = e => {
      if (e.candidate && socket && otherUserId)
        socket.emit("call-ice", { callId, targetUserId: otherUserId, candidate: e.candidate })
    }

    peer.onconnectionstatechange = () => {
      console.log("connectionState:", peer.connectionState)
      if (peer.connectionState === "connected") onConnectedOnce()
      else if (peer.connectionState === "failed") setStatusText("Ошибка соединения")
    }
    peer.oniceconnectionstatechange = () => {
      console.log("iceState:", peer.iceConnectionState)
      if (peer.iceConnectionState === "connected" ||
        peer.iceConnectionState === "completed") onConnectedOnce()
    }

    // Fallback: если через 4с state-события не сработали — всё равно переходим в connected
    const fallbackTimer = setTimeout(() => {
      if (peerRef.current === peer) onConnectedOnce()
    }, 4000)
    // Чистим fallback если пеер закрылся раньше
    peer.addEventListener("connectionstatechange", () => {
      if (peer.connectionState === "closed" || peer.connectionState === "failed")
        clearTimeout(fallbackTimer)
    })

    return peer
  }, [socket, otherUserId, callId, startTimer, startQualityMonitor])

  // ── Применяем буферизованные ICE после setRemoteDescription ──
  const flushIceBuf = useCallback(async () => {
    const peer = peerRef.current
    if (!peer) return
    for (const c of iceBufRef.current) {
      try { await peer.addIceCandidate(new RTCIceCandidate(c)) } catch { }
    }
    iceBufRef.current = []
  }, [])

  // ── Socket events ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    // Инициатор: receiver принял → создаём offer
    const handleCallAccepted = async (data: { callId: number }) => {
      if (data.callId !== callId) return
      setCallState("connected")
      setStatusText(""Соединение...")

      const stream = await getLocalStream()
      if (!stream) return
      const peer = createPeer(stream)
      try {
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        socket.emit("call-offer", { callId, receiverId: otherUserId, sdp: offer })
      } catch (err) {
        console.error("createOffer:", err)
      }
    }

    // Инициатор: получил SDP answer
    const handleCallAnswered = async (data: { callId: number; sdp: RTCSessionDescriptionInit }) => {
      if (data.callId !== callId) return
      const peer = peerRef.current
      if (!peer) return
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp))
        await flushIceBuf()
      } catch (err) {
        console.error("setRemoteDesc(answer):", err)
      }
    }

    // Receiver: получил SDP offer → отвечаем
    const handleCallOffer = async (data: { callId: number; sdp: RTCSessionDescriptionInit }) => {
      if (data.callId !== callId) return
      const stream = localStreamRef.current ?? await getLocalStream()
      if (!stream) return
      const peer = createPeer(stream)
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp))
        await flushIceBuf()
        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        socket.emit("call-answer", { callId, initiatorId: otherUserId, sdp: answer })
        // Не меняем state здесь — onConnectedOnce в createPeer сам сработает когда придет трек
        onAccept?.()
      } catch (err) {
        console.error("handleCallOffer:", err)
      }
    }

    // ICE кандидат — буферизуем до remoteDescription
    const handleIce = async (data: { callId: number; candidate: RTCIceCandidateInit }) => {
      if (data.callId !== callId) return
      const peer = peerRef.current
      if (peer?.remoteDescription) {
        try { await peer.addIceCandidate(new RTCIceCandidate(data.candidate)) } catch { }
      } else {
        iceBufRef.current.push(data.candidate)
      }
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
  }, [socket, callId, otherUserId, createPeer, getLocalStream, flushIceBuf, startTimer, onAccept, onHangup])

  // ── Принять ───────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    // Получаем микрофон заранее — сохраняется в localStreamRef
    await getLocalStream()
    // Сообщаем инициатору — он создаст и пришлёт offer
    socket?.emit("call-accepted", { callId, initiatorId: otherUserId })
    setCallState("connected")
    setStatusText("Соединение...")
    // НЕ вызываем onAccept здесь: он закрыл бы модал раньше call-offer
  }, [socket, callId, otherUserId, getLocalStream])

  // ── Отклонить ─────────────────────────────────────────────────
  const declineCall = useCallback(() => {
    socket?.emit("call-declined", { callId, initiatorId: otherUserId })
    fetch("/api/calls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId, status: "declined" }),
    }).catch(() => { })
    onDecline?.()
  }, [socket, callId, otherUserId, onDecline])

  // ── Завершить ─────────────────────────────────────────────────
  const hangup = useCallback(() => {
    if (timerRef.current)        clearInterval(timerRef.current)
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current)
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    peerRef.current?.close()
    peerRef.current = null
    socket?.emit("call-ended", { callId, otherUserId })
    fetch("/api/calls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId, status: "ended" }),
    }).catch(() => { })
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
        if (peerRef.current && localStreamRef.current)
          peerRef.current.addTrack(vs.getVideoTracks()[0], localStreamRef.current)
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
      if (timerRef.current)        clearInterval(timerRef.current)
      if (qualityTimerRef.current) clearInterval(qualityTimerRef.current)
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      peerRef.current?.close()
    }
  }, [])

  const displayStatus = () => {
    if (callState === "connected" && !statusText) return fmt(callDuration)
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
      {/* Hidden audio element for remote audio — works even without video */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

      {/* Remote video */}
      <video ref={remoteVideoRef} autoPlay playsInline
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
              : otherName[0]?.toUpperCase()}
          </motion.div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: ACCENT }}>
            <Phone size={14} color="white" />
          </div>
        </div>

        <h2 className="text-white text-2xl font-bold mb-1">{otherName}</h2>
        <motion.p key={displayStatus()} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="text-gray-300 text-[15px]">
          {displayStatus()}
        </motion.p>
      </div>

      {/* Local video PiP */}
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
              <motion.button whileTap={{ scale: 0.85 }} onClick={toggleSpeaker}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: isSpeakerOn ? ACCENT : "rgba(255,255,255,0.12)" }}>
                {isSpeakerOn ? <Volume2 size={22} color="white" /> : <VolumeX size={22} color="white" />}
              </motion.button>
              <span className="text-white/60 text-[11px]">{isSpeakerOn ? "Speaker on" : "Speaker"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Quality badge */}
      <AnimatePresence>
        {quality && callState === "connected" && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-black/40 rounded-full px-2.5 py-1">
            <Signal size={12} style={{ color: quality === "good" ? "#4caf50" : quality === "medium" ? "#ff9800" : "#f44336" }} />
            <span className="text-[11px]" style={{ color: quality === "good" ? "#4caf50" : quality === "medium" ? "#ff9800" : "#f44336" }}>
              {quality === "good" ? "Good" : quality === "medium" ? "Fair" : "Poor"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
