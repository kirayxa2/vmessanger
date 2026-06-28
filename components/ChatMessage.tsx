import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Linkify from "linkify-react";
import { stripFormatting } from "@/lib/formatText";
import { peerColor } from "@/lib/peerColor";
import { Reply, Pencil, Copy, Forward, Trash2, Check, CheckCheck, Pin, Clock } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useProfanityFilter } from "@/hooks/useProfanityFilter";
import TitleBadge from "./TitleBadge";
import { VerifiedBadge } from "./VerifiedBadge";

const SENDER_COLOR = "var(--sender-bubble, #5b67ea)";
const RECIPIENT_COLOR = "var(--recipient-bubble, #212d3b)";
const ACCENT = "var(--accent, #7e85e1)";
const DEV_USER_ID = 1;

// ── Реальная звуковая кривая голосовых ──────────────────────────
// Декодируем аудио через Web Audio API и считаем пики амплитуды по N столбикам.
// Кэшируем по URL, чтобы не пересчитывать. AudioContext один на всё приложение.
// FIX #3: ограничиваем размер кэша waveform — не даём памяти расти бесконечно.
// Храним максимум 100 записей, при переполнении удаляем самую старую (FIFO).
const WAVEFORM_CACHE_MAX = 100
const waveformCache = new Map<string, number[]>();
// AudioContext — один на всё приложение, не пересоздаём
let sharedAudioCtx: AudioContext | null = null;

async function computeWaveform(url: string, buckets = 48): Promise<number[]> {
  if (waveformCache.has(url)) return waveformCache.get(url)!;
  const AC: typeof AudioContext | undefined =
    (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) || undefined;
  if (!AC) return [];
  if (!sharedAudioCtx) sharedAudioCtx = new AC();
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  const audioBuf: AudioBuffer = await sharedAudioCtx.decodeAudioData(arr);
  const raw = audioBuf.getChannelData(0);
  const block = Math.max(1, Math.floor(raw.length / buckets));
  const peaks: number[] = [];
  let max = 0;
  for (let i = 0; i < buckets; i++) {
    let sum = 0;
    for (let j = 0; j < block; j++) sum += Math.abs(raw[i * block + j] || 0);
    const avg = sum / block;
    peaks.push(avg);
    if (avg > max) max = avg;
  }
  const norm = peaks.map(p => (max > 0 ? p / max : 0)); // 0..1
  // FIX #3: FIFO — если кэш переполнен, удаляем самую старую запись
  if (waveformCache.size >= WAVEFORM_CACHE_MAX) {
    const firstKey = waveformCache.keys().next().value as string
    waveformCache.delete(firstKey)
  }
  waveformCache.set(url, norm);
  return norm;
}

// Telegram-стиль скруглений пузыря (как в официальном приложении)
// hasButtons: под пузырём прилеплены инлайн-кнопки — хвостик убираем, низ скругляем
function getBubbleRadius(isSender: boolean, isFirstInGroup: boolean, isLastInGroup: boolean, hasAbove: boolean, hasButtons = false) {
  const BIG = "15px"
  const SMALL = "4px"
  const TAIL = "4px"
  const bottom = hasButtons ? BIG : (isLastInGroup ? TAIL : SMALL)
  if (isSender) {
    return {
      borderTopLeftRadius: BIG,
      borderTopRightRadius: hasAbove ? SMALL : BIG,
      borderBottomLeftRadius: BIG,
      borderBottomRightRadius: bottom,
    }
  } else {
    return {
      borderTopLeftRadius: hasAbove ? SMALL : BIG,
      borderTopRightRadius: BIG,
      borderBottomLeftRadius: bottom,
      borderBottomRightRadius: BIG,
    }
  }
}

interface ReplyTo {
  id: number;
  content: string;
  sender: { id: number; username: string; avatar?: string };
}

interface ChatMessageProps {
  id: string | number;
  content: string;
  createdAt: string;
  isSender: boolean;
  failed?: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  hasAbove: boolean;
  replyTo?: ReplyTo | null;
  isForwarded?: boolean;
  isRead?: boolean;
  voiceUrl?: string | null;
  voiceDuration?: number | null;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, content: string) => void;
  onReply?: (msg: { id: string; content: string; senderName: string }) => void;
  onForward?: (msg: { id: string; content: string }) => void;
  onScrollToMessage?: (id: string) => void;
  isTemp?: boolean;
  openMenuId: string | null;
  onMenuOpen: (id: string, x: number, y: number) => void;
  onMenuClose: () => void;
  menuPos: { x: number; y: number };
  senderName?: string;
  senderId?: string | number;
  reactions?: { id: number; emoji: string; userId: number; user: { id: number; username: string } }[];
  onPin?: (id: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  currentUserId?: string | number;
  selfDestructAt?: string | null;
  isGroupChat?: boolean;
  onMentionClick?: (username: string) => void;
  animateIn?: boolean;
  // Bot inline keyboard (Telegram-style)
  replyMarkup?: { inline_keyboard?: { text: string; callback_data?: string; url?: string }[][] } | null;
  botId?: number | null;
  onCallback?: (messageId: string, data: string, botId: number) => void;
  // Превью ссылки (OG)
  linkPreview?: { url: string; title?: string; description?: string; image?: string; siteName?: string } | null;
}

const ChatMessage = React.memo(function ChatMessage({
  id, content, createdAt, isSender, isFirstInGroup, isLastInGroup, hasAbove,
  replyTo, isForwarded, isRead, voiceUrl, voiceDuration, isTemp, failed,
  onDelete, onEdit, onReply, onForward, onScrollToMessage,
  openMenuId, onMenuOpen, onMenuClose, menuPos, senderName, senderId,
  reactions, onPin, onReaction, currentUserId, selfDestructAt, isGroupChat, onMentionClick, animateIn,
  replyMarkup, botId, onCallback, linkPreview
}: ChatMessageProps) {
  const { t } = useTranslation();
  const { filter } = useProfanityFilter();
  const messageId = id.toString();
  const displayContent = filter(content);
  const showMenu = openMenuId === messageId;
  const hasButtons = !!(replyMarkup?.inline_keyboard && replyMarkup.inline_keyboard.length > 0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showQuickReactions, setShowQuickReactions] = useState(false);
  const quickReactionEmojis = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

  const swipeX = useMotionValue(0);
  const SWIPE_THRESHOLD = 64;
  const swipeTriggered = useRef(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const gestureDir = useRef<"none" | "horizontal" | "vertical">("none");
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeWrapRef = useRef<HTMLDivElement>(null);
  
  // ── Double-tap для реакции ────────────────────────────────────
  const lastTapTime = useRef(0);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  
  const handleDoubleTap = useCallback(() => {
    const DEFAULT_REACTION = "❤️";
    onReaction?.(messageId, DEFAULT_REACTION);
    setShowHeartAnimation(true);
    if (navigator.vibrate) navigator.vibrate(20);
    setTimeout(() => setShowHeartAnimation(false), 1000);
  }, [messageId, onReaction]);

  const replyIconOpacity = useTransform(
    swipeX,
    isSender ? [-SWIPE_THRESHOLD, -24, 0] : [0, 24, SWIPE_THRESHOLD],
    isSender ? [1, 0.4, 0] : [0, 0.4, 1]
  );
  const replyIconScale = useTransform(
    swipeX,
    isSender ? [-SWIPE_THRESHOLD, -24, 0] : [0, 24, SWIPE_THRESHOLD],
    isSender ? [1, 0.7, 0.3] : [0.3, 0.7, 1]
  );

  const isDevUser =
    senderId !== undefined &&
    (senderId === DEV_USER_ID ||
      senderId === DEV_USER_ID.toString() ||
      Number(senderId) === DEV_USER_ID);

  useEffect(() => {
    const el = swipeWrapRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      gestureDir.current = "none";
      swipeTriggered.current = false;

      // Double-tap detection
      const now = Date.now();
      if (now - lastTapTime.current < 300) {
        handleDoubleTap();
        lastTapTime.current = 0;
        return;
      }
      lastTapTime.current = now;

      const touch = e.touches[0];
      longPressRef.current = setTimeout(() => {
        onMenuOpen(messageId, touch.clientX, touch.clientY);
      }, 500);
    };

    const onMove = (e: TouchEvent) => {
      if (longPressRef.current) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }

      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;

      if (gestureDir.current === "none" && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        gestureDir.current = Math.abs(dx) > Math.abs(dy) * 1.4 ? "horizontal" : "vertical";
      }

      if (gestureDir.current !== "horizontal") return;
      const correctDir = isSender ? dx < 0 : dx > 0;
      if (!correctDir) return;

      e.preventDefault();
      const max = SWIPE_THRESHOLD * 1.15;
      const clamped = isSender ? Math.max(dx, -max) : Math.min(dx, max);
      swipeX.set(clamped);

      if (Math.abs(clamped) >= SWIPE_THRESHOLD && !swipeTriggered.current) {
        swipeTriggered.current = true;
        if (navigator.vibrate) navigator.vibrate(28);
      }
    };

    const onEnd = () => {
      if (longPressRef.current) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
      if (swipeTriggered.current) {
        onReply?.({ id: messageId, content, senderName: senderName || "" });
      }
      animate(swipeX, 0, { type: "spring", stiffness: 480, damping: 36 });
      swipeTriggered.current = false;
      gestureDir.current = "none";
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [isSender, messageId, content, senderName, onMenuOpen, onReply, swipeX, handleDoubleTap]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(voiceDuration || 0);
  const [playRate, setPlayRate] = useState(1);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const speedPickerRef = useRef<HTMLDivElement>(null);

  const cyclePlayRate = useCallback(() => {
    setPlayRate(prev => {
      const next = prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1;
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);
  
  const setCustomPlayRate = useCallback((rate: number) => {
    setPlayRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
    setShowSpeedPicker(false);
  }, []);
  
  // Close speed picker on outside click
  useEffect(() => {
    if (!showSpeedPicker) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (speedPickerRef.current && !speedPickerRef.current.contains(e.target as Node)) {
        setShowSpeedPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showSpeedPicker]);

  // Реальная звуковая кривая: из кэша сразу, иначе лениво декодируем
  const [waveform, setWaveform] = useState<number[] | null>(null);
  useEffect(() => {
    if (!voiceUrl) return;
    if (waveformCache.has(voiceUrl)) { setWaveform(waveformCache.get(voiceUrl)!); return; }
    let cancelled = false;
    const id = setTimeout(() => {
      computeWaveform(voiceUrl).then(w => { if (!cancelled && w.length) setWaveform(w); }).catch(() => {});
    }, 150);
    return () => { cancelled = true; clearTimeout(id); };
  }, [voiceUrl]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMenuOpen(messageId, e.clientX, e.clientY);
  }, [messageId, onMenuOpen]);

  const handleDelete = useCallback(() => {
    onMenuClose();
    setIsDeleting(true);
    setTimeout(() => onDelete?.(messageId), 900);
  }, [messageId, onDelete, onMenuClose]);

  const toggleAudio = useCallback(() => {
    if (!voiceUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(voiceUrl);
      audioRef.current.ontimeupdate = () => {
        const dur = audioRef.current!.duration || audioDuration || 1;
        setAudioProgress((audioRef.current!.currentTime / dur) * 100);
      };
      audioRef.current.onloadedmetadata = () =>
        setAudioDuration(Math.round(audioRef.current!.duration));
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setAudioProgress(0);
      };
      audioRef.current.playbackRate = playRate;
    }
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  }, [voiceUrl, isPlaying, audioDuration, playRate]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const bubbleColor = isSender ? SENDER_COLOR : RECIPIENT_COLOR;

  const particleData = useMemo(() => {
    const num = typeof id === "number" ? id : parseInt(id.replace(/\D/g, "") || "0");
    return Array.from({ length: 24 }).map((_, i) => {
      const s = num + i * 137;
      return {
        initialX: `${(s * 1.23) % 100}%`,
        initialY: `${(s * 4.56) % 100}%`,
        targetX: `${((s * 7.89) % 400) - 200}%`,
        targetY: `${((s * 3.21) % 300) - 50}%`,
        rotate: (s * 999) % 360,
        delay: (s * 0.002) % 0.2,
      };
    });
  }, [id]);

  const waveBars = useMemo(() => {
    const num = typeof id === "number" ? id : parseInt(("" + id).replace(/\D/g, "") || "0");
    let seed = num || 1;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    return Array.from({ length: 48 }).map(() => 3 + Math.round(rnd() * 19)); // высоты 3..22px
  }, [id]);

  const timeStr = new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const { menuStyle, transformOrigin } = useMemo(() => {
    if (typeof window === "undefined")
      return { menuStyle: { top: menuPos.y, left: menuPos.x }, transformOrigin: "top left" };
    const mW = 208, mH = 280, mg = 8;
    const growUp = menuPos.y + mH > window.innerHeight - mg;
    let top = growUp ? menuPos.y - mH - 4 : menuPos.y + 4;
    let left = menuPos.x - mW / 2;
    if (top < mg) top = mg;
    if (left < mg) left = mg;
    if (left + mW > window.innerWidth - mg) left = window.innerWidth - mW - mg;
    const ox = Math.round(Math.min(Math.max(menuPos.x - left, 16), mW - 16));
    return { menuStyle: { top, left }, transformOrigin: `${ox}px ${growUp ? mH : 0}px` };
  }, [menuPos]);

  const ReadIndicator = () => {
    if (!isSender) return null;
    if (failed) return (
      <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="ml-1 flex items-center text-red-400 cursor-pointer" title="Не отправлено">
        <span className="text-[11px] font-bold">!</span>
      </motion.span>
    );
    return (
      <AnimatePresence mode="wait">
        {isTemp ? (
          <motion.span key="clock" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 0.7, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="ml-0.5 flex items-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
              <Clock size={11} strokeWidth={2.5} className="opacity-70" />
            </motion.div>
          </motion.span>
        ) : isRead ? (
          <motion.span key="read" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="ml-0.5 flex items-center">
            <CheckCheck size={13} strokeWidth={2.5} style={{ color: "#a8d8f0" }} />
          </motion.span>
        ) : (
          <motion.span key="sent" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 0.7, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="ml-0.5 flex items-center">
            <Check size={12} strokeWidth={2.5} />
          </motion.span>
        )}
      </AnimatePresence>
    );
  };

  return (
    <motion.div
      initial={isTemp || animateIn
        ? { opacity: 0, scale: 0.94, y: 8, filter: "blur(4px)" }
        : false
      }
      animate={{ 
        opacity: 1, 
        scale: 1, 
        y: 0,
        filter: "blur(0px)",
        transition: {
          type: "spring",
          stiffness: 500,
          damping: 36,
          mass: 0.6
        }
      }}
      exit={isDeleting 
        ? { 
            opacity: 0, 
            scale: 0.8,
            filter: "blur(8px)",
            transition: { duration: 0.3 } 
          } 
        : { 
            opacity: 0, 
            scale: 0.85, 
            transition: { duration: 0.12 } 
          }
      }
      whileHover={!isTemp && !isDeleting ? { scale: 1.005 } : undefined}
      className={`flex w-full ${isSender ? "justify-end" : "justify-start"} mb-[2px] ${isFirstInGroup ? "mt-3" : "mt-0"} relative overflow-visible`}
    >
      <motion.div style={{ opacity: replyIconOpacity, scale: replyIconScale, position: "absolute", top: "50%", translateY: "-50%", ...(isSender ? { left: 8 } : { right: 8 }), pointerEvents: "none", zIndex: 0 }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: ACCENT }}>
          <Reply size={15} color="white" />
        </div>
      </motion.div>

      {/* Double-tap heart animation */}
      <AnimatePresence>
        {showHeartAnimation && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              translateX: "-50%",
              translateY: "-50%",
              pointerEvents: "none",
              zIndex: 10,
              fontSize: "48px",
              filter: "drop-shadow(0 2px 8px rgba(255,0,0,0.5))"
            }}
          >
            ❤️
          </motion.div>
        )}
      </AnimatePresence>

      {!isSender && isGroupChat && isLastInGroup && senderName && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-1 mr-2 self-end overflow-hidden outline outline-1 outline-white/10" style={{ backgroundColor: peerColor(senderId) }}>
          <span className="text-white text-xs font-bold">{senderName[0]?.toUpperCase()}</span>
        </div>
      )}
      {!isSender && isGroupChat && !isLastInGroup && senderName && <div className="w-8 h-8 mr-2 shrink-0"></div>}

      <div className="relative max-w-[80vw]" style={{ zIndex: 1 }}>
        <motion.div ref={swipeWrapRef} style={{ x: swipeX, willChange: "transform" }} onContextMenu={handleContextMenu} className="relative">
          <div
            style={{
              ...getBubbleRadius(isSender, isFirstInGroup, isLastInGroup, hasAbove, hasButtons),
              backgroundColor: bubbleColor,
              willChange: "opacity, transform, filter"
            }}
            className={`relative p-[6px] px-3 shadow-sm text-white cursor-pointer select-none z-10 min-w-[80px] transition-all duration-300 ${
              isDeleting 
                ? "opacity-0 scale-75 blur-md" 
                : "opacity-100 scale-100 blur-0"
            }`}
          >
            {!isSender && isGroupChat && isLastInGroup && senderName && (
              <div className="flex items-center gap-1 mb-[3px] flex-wrap">
                <span className="text-[12px] font-semibold leading-tight" style={{ color: peerColor(senderId) }}>{senderName}</span>
                {isDevUser && <VerifiedBadge size={13} />}
                <TitleBadge userId={senderId} />
              </div>
            )}
            {isForwarded && (
              <div className="flex items-center gap-1 mb-1 opacity-70">
                <Forward size={12} />
                <span className="text-[11px] font-medium">Forwarded</span>
              </div>
            )}
            {replyTo && (
              <motion.div onClick={e => { e.stopPropagation(); onScrollToMessage?.(replyTo.id.toString()); }} className="mb-2 rounded-lg overflow-hidden cursor-pointer" style={{ backgroundColor: "rgba(0,0,0,0.18)" }} whileHover={{ backgroundColor: "rgba(0,0,0,0.28)" }}>
                <div className="flex">
                  <div className="w-[3px] rounded-l-lg shrink-0" style={{ backgroundColor: isSender ? "rgba(255,255,255,0.6)" : ACCENT }} />
                  <div className="px-2 py-1.5 min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{ color: isSender ? "rgba(255,255,255,0.85)" : ACCENT }}>{replyTo.sender.username}</p>
                    <p className="text-[12px] opacity-70 truncate">{stripFormatting(replyTo.content)}</p>
                  </div>
                </div>
              </motion.div>
            )}
            {voiceUrl ? (
              <div className="flex items-center gap-2 min-w-[180px]">
                <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); toggleAudio(); }} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                  {isPlaying ? <svg width="14" height="14" viewBox="0 0 14 14" fill="white"><rect x="2" y="1" width="4" height="12" rx="1.5" /><rect x="8" y="1" width="4" height="12" rx="1.5" /></svg> : <svg width="14" height="14" viewBox="0 0 14 14" fill="white"><path d="M3 2l9 5-9 5V2z" /></svg>}
                </motion.button>
                <div className="flex-1 min-w-0">
                  <div className="relative h-[28px] flex items-center gap-[1px] cursor-pointer"
                    onClick={e => {
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                      setAudioProgress(pct * 100)
                      if (audioRef.current && audioRef.current.duration) audioRef.current.currentTime = pct * audioRef.current.duration
                    }}>
                    {(waveform && waveform.length ? waveform.map(p => 3 + p * 19) : waveBars).map((h, i, arr) => (
                      <div key={i} className="rounded-full shrink-0 transition-all duration-100" style={{ width: 2, height: `${h}px`, backgroundColor: (i / arr.length) * 100 < audioProgress ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)" }} />
                    ))}
                  </div>
                  <span className="text-[10px] opacity-60">{fmt(audioDuration)}</span>
                </div>
                <div className="relative shrink-0 self-center">
                  <motion.button 
                    whileTap={{ scale: 0.85 }} 
                    onClick={e => { e.stopPropagation(); setShowSpeedPicker(!showSpeedPicker); }}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}
                    title="Скорость воспроизведения">
                    {playRate}x
                  </motion.button>
                  
                  <AnimatePresence>
                    {showSpeedPicker && typeof document !== "undefined" && createPortal(
                      <motion.div
                        ref={speedPickerRef}
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="fixed bg-[#1e1e1e]/96 backdrop-blur-xl rounded-xl shadow-2xl py-2 px-1 flex flex-col border border-white/8"
                        style={{ 
                          bottom: "80px",
                          right: "20px",
                          zIndex: 99999,
                          minWidth: "140px"
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="text-[11px] text-gray-400 px-3 pb-1 font-medium">Скорость</p>
                        {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5].map(speed => (
                          <motion.button
                            key={speed}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setCustomPlayRate(speed)}
                            className={`px-3 py-2 text-[13px] font-medium rounded-lg transition-colors text-left ${
                              playRate === speed ? "bg-[var(--accent)] text-white" : "text-white hover:bg-white/5"
                            }`}
                          >
                            {speed}x {playRate === speed && "✓"}
                          </motion.button>
                        ))}
                      </motion.div>,
                      document.body
                    )}
                  </AnimatePresence>
                </div>
                <span className="text-[10px] opacity-60 whitespace-nowrap flex items-center gap-0.5 shrink-0 self-end pb-0.5">{timeStr}<ReadIndicator /></span>
              </div>
            ) : (
              <div className="flex items-end gap-x-2 flex-wrap">
                <span className="leading-[1.4] text-[15px] flex-1" style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                  <Linkify options={{ target: "_blank", rel: "noopener noreferrer", className: "underline opacity-90 hover:opacity-100", ignoreTags: ["a", "code", "pre"] }}>
                    {renderRichText(displayContent, onMentionClick)}
                  </Linkify>
                </span>
                <span className="text-[10px] opacity-60 whitespace-nowrap select-none flex items-center gap-0.5 self-end">{timeStr}<ReadIndicator /></span>
              </div>
            )}
            {linkPreview && (linkPreview.title || linkPreview.description || linkPreview.image) && (
              <a
                href={linkPreview.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="mt-1.5 block rounded-lg overflow-hidden no-underline"
                style={{ background: "rgba(0,0,0,0.18)", maxWidth: 320 }}
              >
                <div className="flex">
                  <div className="w-[3px] shrink-0" style={{ background: isSender ? "rgba(255,255,255,0.6)" : ACCENT }} />
                  <div className="px-2.5 py-1.5 min-w-0">
                    {linkPreview.siteName && (
                      <p className="text-[12px] font-semibold truncate" style={{ color: isSender ? "rgba(255,255,255,0.9)" : ACCENT }}>{linkPreview.siteName}</p>
                    )}
                    {linkPreview.title && (
                      <p className="text-[13px] font-semibold leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{linkPreview.title}</p>
                    )}
                    {linkPreview.description && (
                      <p className="text-[12px] opacity-70 leading-snug mt-0.5" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{linkPreview.description}</p>
                    )}
                  </div>
                </div>
                {linkPreview.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={linkPreview.image} alt="" className="w-full object-cover" style={{ maxHeight: 180 }} loading="lazy" />
                )}
              </a>
            )}
          </div>
          {isLastInGroup && !isDeleting && !hasButtons && (
            <div className={`absolute bottom-0 w-[11px] h-[20px] ${isSender ? "-right-[9px]" : "-left-[9px]"} z-0 overflow-hidden`}>
              <svg width="11" height="20" viewBox="0 0 11 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                {isSender
                  ? <path d="M11 20H0L0.002 0C0.196 3.127 0.88 6.362 2.054 9.66 3.23 12.96 5.25 15.97 8.12 18.68A2 2 0 0011 20z" style={{ fill: SENDER_COLOR }} />
                  : <path d="M0 20h11L10.998 0C10.804 3.127 10.12 6.362 8.946 9.66 7.77 12.96 5.75 15.97 2.88 18.68A2 2 0 010 20z" style={{ fill: RECIPIENT_COLOR }} />
                }
              </svg>
            </div>
          )}
        </motion.div>

        {/* ── Inline keyboard (bot buttons) ── */}
        {replyMarkup?.inline_keyboard && replyMarkup.inline_keyboard.length > 0 && (
          <div className="mt-1 flex flex-col gap-1" style={{ maxWidth: 360 }}>
            {replyMarkup.inline_keyboard.map((row, ri) => (
              <div key={ri} className="flex gap-1">
                {row.map((btn, bi) => (
                  <motion.button
                    key={bi}
                    whileTap={{ scale: 0.96 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (btn.url) {
                        window.open(btn.url, "_blank", "noopener,noreferrer")
                      } else if (btn.callback_data != null) {
                        onCallback?.(messageId, btn.callback_data, botId ?? 0)
                      }
                    }}
                    className="flex-1 px-3 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
                    style={{ backgroundColor: "rgba(126,133,225,0.22)", border: "1px solid rgba(126,133,225,0.35)" }}
                  >
                    {btn.text}
                  </motion.button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── Reactions bar ── */}
        {reactions && reactions.length > 0 && (() => {
          const groups = new Map<string, { count: number; mine: boolean }>()
          for (const r of reactions) {
            const g = groups.get(r.emoji) || { count: 0, mine: false }
            g.count++
            if (currentUserId != null && String(r.userId) === String(currentUserId)) g.mine = true
            groups.set(r.emoji, g)
          }
          return (
            <div className={`flex flex-wrap gap-1 mt-1 ${isSender ? "justify-end" : "justify-start"}`}>
              {Array.from(groups.entries()).map(([emoji, g]) => (
                <motion.button key={emoji} whileTap={{ scale: 0.85 }} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  onClick={e => { e.stopPropagation(); onReaction?.(messageId, emoji) }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-semibold"
                  style={{ backgroundColor: g.mine ? "var(--accent)" : "rgba(255,255,255,0.13)", color: "#fff" }}>
                  <span style={{ fontSize: 13 }}>{emoji}</span>
                  <span>{g.count}</span>
                </motion.button>
              ))}
            </div>
          )
        })()}

        {showMenu && typeof document !== "undefined" && createPortal(
          <AnimatePresence>
            <motion.div
              key="context-menu"
              initial={{ opacity: 0, scale: 0.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.1 }}
              transition={{ type: "spring", stiffness: 500, damping: 26, mass: 0.65 }}
              className="fixed w-52 bg-[#1e1e1e]/96 backdrop-blur-xl rounded-2xl shadow-2xl py-1.5 flex flex-col border border-white/8 overflow-hidden"
              style={{ ...menuStyle, transformOrigin, zIndex: 99999 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Быстрые реакции */}
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/8">
                {quickReactionEmojis.map(emoji => (
                  <motion.button key={emoji} whileHover={{ scale: 1.3 }} whileTap={{ scale: 0.9 }}
                    onClick={() => { onReaction?.(messageId, emoji); onMenuClose(); }}
                    className="text-[22px] leading-none p-1">
                    {emoji}
                  </motion.button>
                ))}
              </div>
              <MenuItem icon={<Reply size={17} />} label={t("reply")} onClick={() => { onReply?.({ id: messageId, content, senderName: senderName || "" }); onMenuClose(); }} />
              {isSender && <MenuItem icon={<Pencil size={17} />} label={t("edit")} onClick={() => { onEdit?.(messageId, content); onMenuClose(); }} />}
              <MenuItem icon={<Copy size={17} />} label={t("copy")} onClick={() => { navigator.clipboard.writeText(content); onMenuClose(); }} />
              <MenuItem icon={<Forward size={17} />} label={t("forward")} onClick={() => { onForward?.({ id: messageId, content }); onMenuClose(); }} />
              <MenuItem icon={<Pin size={17} />} label="📌 Закрепить" onClick={() => { onPin?.(messageId); onMenuClose(); }} />
              <div className="mx-3 my-1 border-t border-white/8" />
              <MenuItem icon={<Trash2 size={17} />} label={t("delete")} color="text-red-400" onClick={handleDelete} />
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
      </div>
    </motion.div>
  );
});

export default ChatMessage;

function MenuItem({ icon, label, color = "text-white", onClick }: { icon: React.ReactNode; label: string; color?: string; onClick?: () => void; }) {
  return (
    <div onClick={onClick} className="px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-white/6 active:bg-white/10 transition-colors group">
      <div className={`${color} opacity-75 group-hover:opacity-100 transition-opacity shrink-0`}>{icon}</div>
      <span className={`text-[14px] font-medium ${color}`}>{label}</span>
    </div>
  );
}

// Парсим @упоминания — подсвечиваем и делаем кликабельными
function renderWithMentions(text: string, onMentionClick?: (username: string) => void): React.ReactNode[] {
  const parts = text.split(/(@\w+)/g)
  return parts.map((part, i) =>
    /^@\w+$/.test(part)
      ? <span
          key={i}
          style={{ color: 'var(--accent, #7e85e1)', fontWeight: 600, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onMentionClick?.(part.slice(1)) }}
        >{part}</span>
      : <span key={i}>{part}</span>
  )
}

// Telegram-стиль: парсим markdown-разметку (bold/italic/strike/моно/спойлер/ссылка) + @упоминания
// Маркеры: **жирный**  __курсив__  ~~зачёркнутый~~  `моно`  ```блок```  ||спойлер||  [текст](url)
const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'

const FORMAT_PATTERNS: { type: string; re: RegExp }[] = [
  { type: "pre", re: /```([\s\S]+?)```/ },
  { type: "code", re: /`([^`\n]+?)`/ },
  { type: "bold", re: /\*\*([\s\S]+?)\*\*/ },
  { type: "strike", re: /~~([\s\S]+?)~~/ },
  { type: "spoiler", re: /\|\|([\s\S]+?)\|\|/ },
  { type: "italic", re: /__([\s\S]+?)__/ },
  { type: "link", re: /\[([^\]\n]+?)\]\((https?:\/\/[^\s)]+)\)/ },
]

// Спойлер: анимированный «шум» из точек поверх текста (как в Telegram), раскрывается по клику
function Spoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (revealed) return
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let raf = 0, running = true, frame = 0
    const resize = () => {
      const r = wrap.getBoundingClientRect()
      canvas.width = Math.max(1, Math.ceil(r.width))
      canvas.height = Math.max(1, Math.ceil(r.height))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    const draw = () => {
      if (!running) return
      frame++
      if (frame % 2 === 0) { // ~30fps — экономим CPU
        const w = canvas.width, h = canvas.height
        ctx.clearRect(0, 0, w, h)
        const count = Math.min(900, Math.floor((w * h) / 28))
        ctx.fillStyle = "#dfe6f0"
        for (let i = 0; i < count; i++) {
          ctx.globalAlpha = Math.random() * 0.8 + 0.15
          ctx.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3)
        }
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect() }
  }, [revealed])
  return (
    <span
      ref={wrapRef}
      onClick={e => { if (!revealed) { e.stopPropagation(); setRevealed(true) } }}
      style={{
        position: "relative", display: "inline-block", borderRadius: 4,
        cursor: revealed ? "inherit" : "pointer",
        WebkitUserSelect: revealed ? "auto" : "none", userSelect: revealed ? "auto" : "none",
      }}
    >
      <span style={{ opacity: revealed ? 1 : 0, transition: "opacity .2s" }}>{children}</span>
      {!revealed && (
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 4, background: "rgba(120,125,140,0.22)" }}
        />
      )}
    </span>
  )
}

function renderRich(text: string, onMentionClick: ((u: string) => void) | undefined, c: { n: number }): React.ReactNode[] {
  if (!text) return []
  let best: { idx: number; len: number; type: string; g1: string; g2?: string } | null = null
  for (const p of FORMAT_PATTERNS) {
    const m = p.re.exec(text)
    if (m && (best === null || m.index < best.idx)) {
      best = { idx: m.index, len: m[0].length, type: p.type, g1: m[1], g2: m[2] }
    }
  }
  if (!best) {
    return [<React.Fragment key={`t${c.n++}`}>{renderWithMentions(text, onMentionClick)}</React.Fragment>]
  }
  const before = text.slice(0, best.idx)
  const after = text.slice(best.idx + best.len)
  const out: React.ReactNode[] = []
  if (before) out.push(...renderRich(before, onMentionClick, c))
  const key = `f${c.n++}`
  switch (best.type) {
    case "pre":
      out.push(<code key={key} style={{ display: "block", whiteSpace: "pre-wrap", fontFamily: MONO_FONT, fontSize: "0.9em", background: "rgba(0,0,0,0.28)", padding: "8px 10px", borderRadius: 8, margin: "3px 0" }}>{best.g1}</code>)
      break
    case "code":
      out.push(<code key={key} style={{ fontFamily: MONO_FONT, fontSize: "0.92em", background: "rgba(0,0,0,0.25)", padding: "1px 5px", borderRadius: 4 }}>{best.g1}</code>)
      break
    case "bold":
      out.push(<strong key={key} style={{ fontWeight: 700 }}>{renderRich(best.g1, onMentionClick, c)}</strong>)
      break
    case "italic":
      out.push(<em key={key}>{renderRich(best.g1, onMentionClick, c)}</em>)
      break
    case "strike":
      out.push(<s key={key}>{renderRich(best.g1, onMentionClick, c)}</s>)
      break
    case "spoiler":
      out.push(<Spoiler key={key}>{renderRich(best.g1, onMentionClick, c)}</Spoiler>)
      break
    case "link":
      out.push(<a key={key} href={best.g2} target="_blank" rel="noopener noreferrer" className="underline opacity-90 hover:opacity-100" onClick={e => e.stopPropagation()}>{best.g1}</a>)
      break
  }
  if (after) out.push(...renderRich(after, onMentionClick, c))
  return out
}

// Точка входа: разметка + @упоминания, ссылки автолинкуются обёрткой <Linkify>
function renderRichText(text: string, onMentionClick?: (username: string) => void): React.ReactNode {
  return renderRich(text, onMentionClick, { n: 0 })
}

function WrappedText({ text }: { text: string }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const LIMIT = isMobile ? 35 : 56;
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    let rem = rawLine;
    while (rem.length > LIMIT) {
      const si = rem.lastIndexOf(" ", LIMIT);
      if (si > 0) { lines.push(rem.slice(0, si)); rem = rem.slice(si + 1); }
      else { lines.push(rem.slice(0, LIMIT)); rem = rem.slice(LIMIT); }
    }
    lines.push(rem);
  }
  return <>{lines.join("\n")}</>;
}
