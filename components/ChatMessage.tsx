import React, { useState, useMemo, useCallback, useRef } from "react";
import { Reply, Pencil, Copy, Forward, Trash2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

const SENDER_COLOR = "#c67c78";
const RECIPIENT_COLOR = "#212121";
const ACCENT = "#7e85e1";

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
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  hasAbove: boolean;
  replyTo?: ReplyTo | null;
  isForwarded?: boolean;
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
}

export default function ChatMessage({
  id, content, createdAt, isSender, isFirstInGroup, isLastInGroup, hasAbove,
  replyTo, isForwarded, isTemp,
  onDelete, onEdit, onReply, onForward, onScrollToMessage,
  openMenuId, onMenuOpen, onMenuClose, menuPos,
  senderName,
}: ChatMessageProps) {
  const { t } = useTranslation();
  const messageId = id.toString();
  const showMenu = openMenuId === messageId;
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMenuOpen(messageId, e.clientX, e.clientY);
  }, [messageId, onMenuOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const timer = setTimeout(() => {
      onMenuOpen(messageId, touch.clientX, touch.clientY);
    }, 500);
    setLongPressTimer(timer);
  }, [messageId, onMenuOpen]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer) clearTimeout(longPressTimer);
  }, [longPressTimer]);

  const handleDelete = useCallback(() => {
    onMenuClose();
    setIsDeleting(true);
    setTimeout(() => onDelete?.(messageId), 900);
  }, [messageId, onDelete, onMenuClose]);

  const bubbleColor = isSender ? SENDER_COLOR : RECIPIENT_COLOR;

  // Particles for delete animation
  const particleData = useMemo(() => {
    const num = typeof id === "number" ? id : parseInt(id.replace(/\D/g, "") || "0");
    return Array.from({ length: 24 }).map((_, i) => {
      const seed = num + i * 137;
      return {
        initialX: `${(seed * 1.23) % 100}%`,
        initialY: `${(seed * 4.56) % 100}%`,
        targetX: `${((seed * 7.89) % 400) - 200}%`,
        targetY: `${((seed * 3.21) % 300) - 50}%`,
        rotate: (seed * 999) % 360,
        delay: (seed * 0.002) % 0.2,
      };
    });
  }, [id]);

  const timeStr = new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const bubbleRef = useRef<HTMLDivElement>(null);

  // Smart position + transform origin so menu grows out of the click point
  const { menuStyle, transformOrigin } = useMemo(() => {
    if (typeof window === "undefined") return { menuStyle: { top: menuPos.y, left: menuPos.x }, transformOrigin: "top left" };
    const menuW = 208;
    const menuH = 280;
    const margin = 8;
    // Decide vertical direction: grow down or up?
    const growUp = menuPos.y + menuH > window.innerHeight - margin;
    let top = growUp ? menuPos.y - menuH - 4 : menuPos.y + 4;
    let left = menuPos.x - menuW / 2;
    if (top < margin) top = margin;
    if (left < margin) left = margin;
    if (left + menuW > window.innerWidth - margin) left = window.innerWidth - menuW - margin;
    // Origin: where the menu grows FROM (the click point relative to menu)
    const originX = Math.round(Math.min(Math.max(menuPos.x - left, 16), menuW - 16));
    const originY = growUp ? menuH : 0;
    return {
      menuStyle: { top, left },
      transformOrigin: `${originX}px ${originY}px`,
    };
  }, [menuPos]);

  return (
    <motion.div
      layout="position"
      initial={isTemp ? { opacity: 0, scale: 0.88, y: 10, x: isSender ? 10 : -10 } : false}
      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
      exit={isDeleting
        ? { opacity: 0, transition: { duration: 0.2, delay: 0.75 } }
        : { opacity: 0, scale: 0.8, transition: { duration: 0.15 } }
      }
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={`flex w-full ${isSender ? "justify-end" : "justify-start"} mb-[2px] ${isFirstInGroup ? "mt-3" : "mt-0"} relative`}
    >
      <div className="relative max-w-[80vw]">
        <motion.div
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          animate={isDeleting ? { opacity: 0, scale: 0.8, filter: "blur(6px)", transition: { duration: 0.3 } } : {}}
          style={{
            borderTopLeftRadius: !isSender && hasAbove ? "5px" : "15px",
            borderTopRightRadius: isSender && hasAbove ? "5px" : "15px",
            borderBottomLeftRadius: !isSender ? (isLastInGroup ? "0px" : "5px") : "15px",
            borderBottomRightRadius: isSender ? (isLastInGroup ? "0px" : "5px") : "15px",
            backgroundColor: bubbleColor,
          }}
          className="relative p-[6px] px-3 shadow-sm text-white cursor-pointer select-none z-10 overflow-hidden min-w-[80px]"
        >
          {/* Forwarded label */}
          {isForwarded && (
            <div className="flex items-center gap-1 mb-1 opacity-70">
              <Forward size={12} />
              <span className="text-[11px] font-medium">Forwarded</span>
            </div>
          )}

          {/* Reply preview inside bubble */}
          {replyTo && (
            <motion.div
              onClick={(e) => { e.stopPropagation(); onScrollToMessage?.(replyTo.id.toString()); }}
              className="mb-2 rounded-lg overflow-hidden cursor-pointer"
              style={{ backgroundColor: "rgba(0,0,0,0.18)" }}
              whileHover={{ backgroundColor: "rgba(0,0,0,0.28)" }}
            >
              <div className="flex">
                {/* Accent bar */}
                <div className="w-[3px] rounded-l-lg shrink-0" style={{ backgroundColor: isSender ? "rgba(255,255,255,0.6)" : ACCENT }} />
                <div className="px-2 py-1.5 min-w-0">
                  <p className="text-[12px] font-semibold truncate" style={{ color: isSender ? "rgba(255,255,255,0.85)" : ACCENT }}>
                    {replyTo.sender.username}
                  </p>
                  <p className="text-[12px] opacity-70 truncate">{replyTo.content}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Message content + time */}
          <div className="flex items-end gap-x-2 flex-wrap">
            <span className="leading-[1.4] text-[15px] break-words flex-1">{content}</span>
            <span className="text-[10px] opacity-60 whitespace-nowrap select-none flex items-center gap-0.5 self-end">
              {timeStr}
              {isSender && <Check size={12} strokeWidth={2.5} className="ml-0.5" />}
            </span>
          </div>
        </motion.div>

        {/* Bubble tail */}
        {isLastInGroup && !isDeleting && (
          <div className={`absolute bottom-0 w-[10px] h-4 ${isSender ? "-right-[10px]" : "-left-[9px]"} z-0`}>
            <svg width="10" height="16" viewBox="0 0 10 16">
              {isSender
                ? <path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill={SENDER_COLOR} />
                : <path d="M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z" fill={RECIPIENT_COLOR} />
              }
            </svg>
          </div>
        )}

        {/* Delete particles */}
        <AnimatePresence>
          {isDeleting && (
            <div className="absolute inset-0 pointer-events-none z-20 overflow-visible">
              {particleData.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ left: p.initialX, top: p.initialY, scale: 1, opacity: 1, backgroundColor: bubbleColor, borderRadius: "2px" }}
                  animate={{ x: p.targetX, y: p.targetY, scale: 0, opacity: 0, rotate: p.rotate }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: p.delay }}
                  className="absolute w-2 h-2"
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Context menu — grows from exact click point on message */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.1 }}
            transition={{ type: "spring", stiffness: 500, damping: 26, mass: 0.65 }}
            className="fixed z-[100] w-52 bg-[#1e1e1e]/96 backdrop-blur-xl rounded-2xl shadow-2xl py-1.5 flex flex-col border border-white/8 overflow-hidden"
            style={{ ...menuStyle, transformOrigin }}
          >
            <MenuItem icon={<Reply size={17} />} label={t('reply')} onClick={() => {
              onReply?.({ id: messageId, content, senderName: senderName || "" });
              onMenuClose();
            }} />
            {isSender && (
              <MenuItem icon={<Pencil size={17} />} label={t('edit')} onClick={() => {
                onEdit?.(messageId, content);
                onMenuClose();
              }} />
            )}
            <MenuItem icon={<Copy size={17} />} label={t('copy')} onClick={() => {
              navigator.clipboard.writeText(content);
              onMenuClose();
            }} />
            <MenuItem icon={<Forward size={17} />} label={t('forward')} onClick={() => {
              onForward?.({ id: messageId, content });
              onMenuClose();
            }} />
            <div className="mx-3 my-1 border-t border-white/8" />
            <MenuItem icon={<Trash2 size={17} />} label={t('delete')} color="text-red-400" onClick={handleDelete} />
            <div className="px-4 py-1.5">
              <span className="text-[11px] text-gray-600">
                {isSender ? "✓ " : ""}{timeStr}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MenuItem({ icon, label, color = "text-white", onClick }: {
  icon: React.ReactNode; label: string; color?: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-white/6 active:bg-white/10 transition-colors group"
    >
      <div className={`${color} opacity-75 group-hover:opacity-100 transition-opacity shrink-0`}>{icon}</div>
      <span className={`text-[14px] font-medium ${color}`}>{label}</span>
    </div>
  );
}
