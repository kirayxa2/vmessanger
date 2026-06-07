"use client"

import React, { useEffect, useState, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Copy, Reply, Forward, MessageSquare } from "lucide-react"

interface TextSelectionMenuProps {
  onReply?: (text: string) => void
  onCopy?: (text: string) => void
  onForward?: (text: string) => void
  onQuote?: (text: string) => void
}

export default function TextSelectionMenu({ 
  onReply, 
  onCopy, 
  onForward,
  onQuote 
}: TextSelectionMenuProps) {
  const [selection, setSelection] = useState<string>("")
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim()
      
      if (text && text.length > 0) {
        setSelection(text)
        
        // Получаем позицию выделения
        const range = sel?.getRangeAt(0)
        const rect = range?.getBoundingClientRect()
        
        if (rect) {
          // Показываем меню над выделением
          setPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 8
          })
        }
      } else {
        setSelection("")
        setPosition(null)
      }
    }

    // Слушаем изменения выделения
    document.addEventListener("selectionchange", handleSelectionChange)
    
    // Закрываем меню при клике вне его
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        window.getSelection()?.removeAllRanges()
        setSelection("")
        setPosition(null)
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside)
    
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleAction = (action: (text: string) => void) => {
    action(selection)
    window.getSelection()?.removeAllRanges()
    setSelection("")
    setPosition(null)
  }

  if (!position || !selection) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="fixed bg-[#1e1e1e]/96 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden z-[100000]"
        style={{
          left: position.x,
          top: position.y,
          transform: "translate(-50%, -100%)"
        }}
      >
        <div className="flex items-center divide-x divide-white/10">
          {onCopy && (
            <MenuButton
              icon={<Copy size={16} />}
              label="Копировать"
              onClick={() => {
                navigator.clipboard.writeText(selection)
                handleAction(onCopy)
              }}
            />
          )}
          
          {onReply && (
            <MenuButton
              icon={<Reply size={16} />}
              label="Ответить"
              onClick={() => handleAction(onReply)}
            />
          )}
          
          {onQuote && (
            <MenuButton
              icon={<MessageSquare size={16} />}
              label="Цитата"
              onClick={() => handleAction(onQuote)}
            />
          )}
          
          {onForward && (
            <MenuButton
              icon={<Forward size={16} />}
              label="Переслать"
              onClick={() => handleAction(onForward)}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

function MenuButton({ 
  icon, 
  label, 
  onClick 
}: { 
  icon: React.ReactNode
  label: string
  onClick: () => void 
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-4 py-2.5 hover:bg-white/10 transition-colors group"
    >
      <div className="text-gray-400 group-hover:text-white transition-colors">
        {icon}
      </div>
      <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors whitespace-nowrap">
        {label}
      </span>
    </motion.button>
  )
}
