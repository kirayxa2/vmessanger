import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Linkify from "linkify-react";
import { stripFormatting } from "@/lib/formatText";
import { Reply, Pencil, Copy, Forward, Trash2, Check, CheckCheck, Pin, Clock } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useProfanityFilter } from "@/hooks/useProfanityFilter";
import TitleBadge from "./TitleBadge";
import { VerifiedBadge } from "./VerifiedBadge";

const SENDER_COLOR = "#5b67ea";
const RECIPIENT_COLOR = "#212d3b";
const ACCENT = "var(--accent, #7e85e1)";
const DEV_USER_ID = 1;

// Telegram-стиль скруглений пузыря (как в официальном приложении)
// hasButtons: под пузырём прилеплены инлайн-кнопки — хвостик убираем, низ скругляем
function getBubbleRadius(isSender: boolean, isFirstInGroup: boolean, isLastInGroup: boolean, hasAbove: boolean, hasButtons = false) {
  const BIG = "18px"
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
  }, [isSender, messageId, content, senderName, onMenuOpen, onReply, swipeX]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(voiceDuration || 0);

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
    }
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  }, [voiceUrl, isPlaying, audioDuration]);

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
        ? { opacity: 0, scale: 0.92, y: 6, x: isSender ? 6 : -6 }
        : false
      }
      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
      exit={isDeleting ? { opacity: 0, transition: { duration: 0.2, delay: 0.75 } } : { opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 500, damping: 36, mass: 0.6 }}
      className={`flex w-full ${isSender ? "justify-end" : "justify-start"} mb-[2px] ${isFirstInGroup ? "mt-3" : "mt-0"} relative overflow-visible`}
    >
      <motion.div style={{ opacity: replyIconOpacity, scale: replyIconScale, position: "absolute", top: "50%", translateY: "-50%", ...(isSender ? { left: 8 } : { right: 8 }), pointerEvents: "none", zIndex: 0 }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: ACCENT }}>
          <Reply size={15} color="white" />
        </div>
      </motion.div>

      {!isSender && isGroupChat && isLastInGroup && senderName && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-1 mr-2 self-end overflow-hidden outline outline-1 outline-white/10" style={{ backgroundColor: ACCENT }}>
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
              opacity: isDeleting ? 0 : 1,
              transform: isDeleting ? "scale(0.8)" : "scale(1)",
              filter: isDeleting ? "blur(6px)" : "none",
              transition: isDeleting ? "opacity 0.3s, transform 0.3s, filter 0.3s" : "none",
            }}
            className="relative p-[6px] px-3 shadow-sm text-white cursor-pointer select-none z-10 min-w-[80px]"
          >
            {!isSender && isGroupChat && isLastInGroup && senderName && (
              <div className="flex items-center gap-1 mb-[3px] flex-wrap">
                <span className="text-[12px] font-semibold leading-tight" style={{ color: ACCENT }}>{senderName}</span>
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
                  <div className="relative h-[28px] flex items-center gap-[2px]">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <div key={i} className="rounded-full flex-1 transition-all duration-100" style={{ height: `${[3, 5, 8, 12, 16, 20, 18, 14, 10, 7, 5, 8, 14, 20, 18, 12, 8, 5, 7, 11, 17, 20, 16, 11, 7, 5, 4, 3][i % 28]}px`, backgroundColor: (i / 28) * 100 < audioProgress ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }} />
                    ))}
                  </div>
                  <span className="text-[10px] opacity-60">{fmt(audioDuration)}</span>
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
                  ? <path d="M11 20H0L0.002 0C0.196 3.127 0.88 6.362 2.054 9.66 3.23 12.96 5.25 15.97 8.12 18.68A2 2 0 0011 20z" fill={SENDER_COLOR} />
                  : <path d="M0 20h11L10.998 0C10.804 3.127 10.12 6.362 8.946 9.66 7.77 12.96 5.75 15.97 2.88 18.68A2 2 0 010 20z" fill={RECIPIENT_COLOR} />
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
          style={{ color: '#7e85e1', fontWeight: 600, cursor: 'pointer' }}
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

// Спойлер: размыт, раскрывается по клику (как в Telegram)
function Spoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <span
      onClick={e => { if (!revealed) { e.stopPropagation(); setRevealed(true) } }}
      style={{
        cursor: revealed ? "inherit" : "pointer",
        filter: revealed ? "none" : "blur(5px)",
        backgroundColor: revealed ? "transparent" : "rgba(150,150,160,0.25)",
        borderRadius: 4,
        padding: revealed ? 0 : "0 2px",
        transition: "filter .25s, background-color .25s",
        WebkitUserSelect: revealed ? "auto" : "none",
        userSelect: revealed ? "auto" : "none",
      }}
    >{children}</span>
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