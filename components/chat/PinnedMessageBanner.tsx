"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Pin, X } from "lucide-react"

interface Message {
  id: string | number
  content: string
  createdAt: string
}

interface PinnedMessageBannerProps {
  pinnedMessage: Message | null
  onUnpin: () => void
  onScrollTo: (id: string) => void
}

export default function PinnedMessageBanner({ pinnedMessage, onUnpin, onScrollTo }: PinnedMessageBannerProps) {
  return (
    <AnimatePresence>
      {pinnedMessage && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-[#1c242f] border-b border-white/5 overflow-hidden cursor-pointer"
          onClick={() => onScrollTo(pinnedMessage.id.toString())}
        >
          <div className="flex items-center gap-2 px-4 py-2">
            <Pin size={14} className="text-[#7e85e1] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-[#7e85e1]">Закреплённое сообщение</p>
              <p className="text-[12px] text-gray-400 truncate">{pinnedMessage.content}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={e => { e.stopPropagation(); onUnpin() }}
              className="text-gray-500 hover:text-white p-1 shrink-0"
            >
              <X size={14} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
