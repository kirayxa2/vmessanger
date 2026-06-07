"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion"
import { Pin, X, ChevronLeft, ChevronRight } from "lucide-react"

interface Message {
  id: string | number
  content: string
  createdAt: string
}

interface PinnedMessageBannerProps {
  pinnedMessages: Message[]  // Массив вместо одного
  onUnpin: (id: string) => void
  onScrollTo: (id: string) => void
}

export default function PinnedMessageBanner({ pinnedMessages, onUnpin, onScrollTo }: PinnedMessageBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const swipeX = useMotionValue(0)
  const touchStartX = useRef(0)
  const SWIPE_THRESHOLD = 80
  
  // Циклическая навигация
  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % pinnedMessages.length)
  }
  
  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + pinnedMessages.length) % pinnedMessages.length)
  }
  
  // Auto-advance каждые 5 секунд если больше одного
  useEffect(() => {
    if (pinnedMessages.length <= 1) return
    const timer = setInterval(goToNext, 5000)
    return () => clearInterval(timer)
  }, [pinnedMessages.length])
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current
    swipeX.set(dx)
  }
  
  const handleTouchEnd = () => {
    const x = swipeX.get()
    if (Math.abs(x) > SWIPE_THRESHOLD) {
      if (x > 0) goToPrev()
      else goToNext()
    }
    animate(swipeX, 0, { type: "spring", stiffness: 500, damping: 35 })
  }
  
  if (!pinnedMessages.length) return null
  
  const currentMessage = pinnedMessages[currentIndex]
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-[#1c242f] border-b border-white/5 overflow-hidden relative"
      >
        <motion.div
          style={{ x: swipeX }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="cursor-pointer"
          onClick={() => onScrollTo(currentMessage.id.toString())}
        >
          <div className="flex items-center gap-2 px-4 py-2">
            <Pin size={14} className="text-[#7e85e1] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold text-[#7e85e1]">
                  Закреплено {pinnedMessages.length > 1 && `(${currentIndex + 1}/${pinnedMessages.length})`}
                </p>
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentMessage.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="text-[12px] text-gray-400 truncate"
                >
                  {currentMessage.content}
                </motion.p>
              </AnimatePresence>
            </div>
            
            {/* Навигация если больше одного */}
            {pinnedMessages.length > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={e => { e.stopPropagation(); goToPrev() }}
                  className="text-gray-500 hover:text-white p-1"
                >
                  <ChevronLeft size={14} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={e => { e.stopPropagation(); goToNext() }}
                  className="text-gray-500 hover:text-white p-1"
                >
                  <ChevronRight size={14} />
                </motion.button>
              </div>
            )}
            
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={e => { e.stopPropagation(); onUnpin(currentMessage.id.toString()) }}
              className="text-gray-500 hover:text-white p-1 shrink-0"
            >
              <X size={14} />
            </motion.button>
          </div>
        </motion.div>
        
        {/* Индикаторы */}
        {pinnedMessages.length > 1 && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-1 pb-1">
            {pinnedMessages.map((_, i) => (
              <motion.div
                key={i}
                className="w-1 h-1 rounded-full"
                animate={{
                  backgroundColor: i === currentIndex ? "#7e85e1" : "rgba(255,255,255,0.3)",
                  scale: i === currentIndex ? 1.2 : 1
                }}
                transition={{ duration: 0.2 }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
