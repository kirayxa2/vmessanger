"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2 } from "lucide-react"

const ACCENT = "#7e85e1"

interface CallModalProps {
  // Incoming call props
  incomingCall?: {
    callId: number
    callType: "audio" | "video"
    initiatorId: string
    initiatorName: string
    initiatorAvatar?: string
  } | null
  // Outgoing call props
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

export default function CallModal({
  incomingCall, outgoingCall, onAccept, onDecline, onHangup, socket, currentUserId
}: CallModalProps) {
  const [callState, setCallState] = useState<CallState>(incomingCall ? "incoming" : "outgoing")
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState("Соединение...")

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const callType = incomingCall?.callType || outgoingCall?.callType || "audio"
  const isVideo = callType === "video"
  const callId = incomingCall?.callId || outgoingCall?.callId
  const otherUserId = incomingCall?.initiatorId || outgoingCall?.receiverId
  const otherName = incomingCall?.initiatorName || outgoingCall?.receiverName || ""
  const otherAvatar = incomingCall?.initiatorAvatar || outgoingCall?.receiverAvatar

  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ]
  }

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
  }, [])

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: "user", width: 640, height: 480 } : false,
      })
      localStreamRef.current = stream
      if (localVideoRef.current && isVideo) {
        localVideoRef.current.srcObject = stream
      }
      return stream
    } catch (err) {
      console.error("getUserMedia error:", err)
      return null
    }
  }, [isVideo])

  const createPeer = useCallback((stream: MediaStream) => {
    const peer = new RTCPeerConnection(ICE_SERVERS)
    peerRef.current = peer

    stream.getTracks().forEach(track => peer.addTrack(track, stream))

    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
      }
    }

    peer.onicecandidate = (event) => {
      if (event.candidate && socket && otherUserId) {
        socket.emit("call-ice", {
          callId,
          targetUserId: otherUserId,
          candidate: event.candidate,
        })
      }
    }

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        setConnectionStatus("Подключено")
        setCallState("connected")
        startTimer()
      } else if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
        setConnectionStatus("Соединение потеряно")
      }
    }

    return peer
  }, [socket, otherUserId, callId, startTimer])

  // Initiator: create offer after call accepted
  useEffect(() => {
    if (!socket) return

    const handleCallAnswered = async (data: { callId: number; sdp: RTCSessionDescriptionInit }) => {
      if (data.callId !== callId) return
      const peer = peerRef.current
      if (!peer) return
      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp))
    }

    const handleCallOffer = async (data: { callId: number; sdp: RTCSessionDescriptionInit }) => {
      if (data.callId !== callId) return
      const stream = await getLocalStream()
      if (!stream) return
      const peer = createPeer(stream)
      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp))
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      socket.emit("call-answer", { callId, initiatorId: otherUserId, sdp: answer })
      setCallState("connected")
      startTimer()
    }

    const handleIce = async (data: { callId: number; candidate: RTCIceCandidateInit }) => {
      if (data.callId !== callId) return
      try {
        await peerRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate))
      } catch {}
    }

    const handleCallDeclined = (data: { callId: number }) => {
      if (data.callId !== callId) return
      setCallState("ended")
      setConnectionStatus("Звонок отклонён")
      setTimeout(() => onHangup?.(), 2000)
    }

    const handleCallEnded = (data: { callId: number }) => {
      if (data.callId !== callId) return
      setCallState("ended")
      setConnectionStatus("Звонок завершён")
      setTimeout(() => onHangup?.(), 1500)
    }

    socket.on("call-answered", handleCallAnswered)
    socket.on("call-offer", handleCallOffer)
    socket.on("call-ice", handleIce)
    socket.on("call-declined", handleCallDeclined)
    socket.on("call-ended", handleCallEnded)

    return () => {
      socket.off("call-answered", handleCallAnswered)
      socket.off("call-offer", handleCallOffer)
      socket.off("call-ice", handleIce)
      socket.off("call-declined", handleCallDeclined)
      socket.off("call-ended", handleCallEnded)
    }
  }, [socket, callId, otherUserId, createPeer, getLocalStream, startTimer, onHangup])

  // Outgoing: get stream and send offer
  useEffect(() => {
    if (!outgoingCall || !socket) return
    ;(async () => {
      const stream = await getLocalStream()
      if (!stream) return
      const peer = createPeer(stream)
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      socket.emit("call-offer", {
        callId,
        receiverId: outgoingCall.receiverId,
        sdp: offer,
      })
    })()
  }, []) // only on mount

  const acceptCall = useCallback(async () => {
    setCallState("connected")
    onAccept?.()
    // Stream + peer will be created when we receive call-offer
  }, [onAccept])

  const declineCall = useCallback(() => {
    socket?.emit("call-declined", { callId, initiatorId: otherUserId })
    fetch("/api/calls", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId, status: "declined" }) })
    onDecline?.()
  }, [socket, callId, otherUserId, onDecline])

  const hangup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    peerRef.current?.close()
    socket?.emit("call-ended", { callId, otherUserId })
    fetch("/api/calls", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId, status: "ended" }) })
    onHangup?.()
  }, [socket, callId, otherUserId, onHangup])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }, [])

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsVideoOff(v => !v)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      peerRef.current?.close()
    }
  }, [])

  const avatarBg = ACCENT

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-between"
      style={{ background: isVideo && callState === "connected" ? "transparent" : "linear-gradient(160deg, #1a1f2e 0%, #0d1117 100%)" }}
    >
      {/* Remote video background */}
      {isVideo && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: callState === "connected" ? "block" : "none" }}
        />
      )}

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 pt-16 pb-4 flex flex-col items-center w-full px-6">
        {/* Avatar */}
        <div className="relative mb-4">
          <motion.div
            animate={callState === "incoming" || callState === "outgoing"
              ? { boxShadow: ["0 0 0 0px rgba(126,133,225,0.4)", "0 0 0 24px rgba(126,133,225,0)"] }
              : {}
            }
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center text-white text-5xl font-bold"
            style={{ backgroundColor: avatarBg }}
          >
            {otherAvatar
              ? <img src={otherAvatar} className="w-full h-full object-cover" alt="" />
              : otherName[0]?.toUpperCase()
            }
          </motion.div>

          {/* Call type badge */}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: ACCENT }}>
            {isVideo ? <Video size={14} color="white" /> : <Phone size={14} color="white" />}
          </div>
        </div>

        {/* Name */}
        <h2 className="text-white text-2xl font-bold mb-1">{otherName}</h2>

        {/* Status */}
        <p className="text-gray-300 text-[15px]">
          {callState === "incoming" && (isVideo ? "Входящий видеозвонок" : "Входящий звонок")}
          {callState === "outgoing" && "Вызов..."}
          {callState === "connected" && formatDuration(callDuration)}
          {callState === "ended" && connectionStatus}
        </p>
      </div>

      {/* Local video (small PiP) */}
      {isVideo && callState === "connected" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-20 right-4 z-20 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl"
        >
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </motion.div>
      )}

      {/* Controls */}
      <div className="relative z-10 pb-16 w-full px-8">
        {callState === "incoming" ? (
          /* Incoming: accept + decline */
          <div className="flex items-center justify-around">
            <div className="flex flex-col items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={declineCall}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{ backgroundColor: "#e53935" }}
              >
                <PhoneOff size={26} color="white" />
              </motion.button>
              <span className="text-white/70 text-[12px]">Отклонить</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={acceptCall}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{ backgroundColor: "#43a047" }}
              >
                {isVideo ? <Video size={26} color="white" /> : <Phone size={26} color="white" />}
              </motion.button>
              <span className="text-white/70 text-[12px]">Принять</span>
            </div>
          </div>
        ) : (
          /* Outgoing / connected */
          <div className="flex items-center justify-around">
            {/* Mute */}
            <div className="flex flex-col items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={toggleMute}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: isMuted ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)" }}
              >
                {isMuted ? <MicOff size={22} color="white" /> : <Mic size={22} color="white" />}
              </motion.button>
              <span className="text-white/60 text-[11px]">{isMuted ? "Вкл. микрофон" : "Выкл. микрофон"}</span>
            </div>

            {/* Hangup */}
            <div className="flex flex-col items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={hangup}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{ backgroundColor: "#e53935" }}
              >
                <PhoneOff size={26} color="white" />
              </motion.button>
              <span className="text-white/70 text-[12px]">Завершить</span>
            </div>

            {/* Video toggle */}
            {isVideo && (
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={toggleVideo}
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: isVideoOff ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)" }}
                >
                  {isVideoOff ? <VideoOff size={22} color="white" /> : <Video size={22} color="white" />}
                </motion.button>
                <span className="text-white/60 text-[11px]">{isVideoOff ? "Вкл. камеру" : "Выкл. камеру"}</span>
              </div>
            )}

            {/* Speaker (audio only) */}
            {!isVideo && (
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                >
                  <Volume2 size={22} color="white" />
                </motion.button>
                <span className="text-white/60 text-[11px]">Динамик</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
