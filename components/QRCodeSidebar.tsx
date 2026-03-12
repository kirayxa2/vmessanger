"use client"

import React, { useRef, useState } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, Share2, Download, Check } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import html2canvas from "html2canvas"

interface QRCodeSidebarProps {
  user: {
    id: string | number
    username: string
    avatar?: string
  }
  onBack: () => void
}

const ACCENT = "#7e85e1"

const QR_THEMES = [
  { id: "classic", bg: "linear-gradient(135deg, #7e85e1 0%, #5b61b9 100%)", color: "#ffffff" },
  { id: "emerald", bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#ffffff" },
  { id: "rose", bg: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)", color: "#ffffff" },
  { id: "amber", bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#ffffff" },
  { id: "violet", bg: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)", color: "#ffffff" },
]

export default function QRCodeSidebar({ user, onBack }: QRCodeSidebarProps) {
  const qrRef = useRef<HTMLDivElement>(null)
  const [activeTheme, setActiveTheme] = useState(QR_THEMES[0])
  const [isSharing, setIsSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  // URL for the profile - Corrected to root /ID format
  const profileUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/${user.id}`
    : `https://vortex.app/${user.id}`

  const handleShare = async () => {
    if (!qrRef.current) return
    setIsSharing(true)
    try {
      const canvas = await html2canvas(qrRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      })
      
      canvas.toBlob(async (blob) => {
        if (!blob) return
        
        const file = new File([blob], `qr-${user.username}.png`, { type: "image/png" })
        
        if (navigator.share) {
          await navigator.share({
            files: [file],
            title: "My Vortex Profile",
            text: `Connect with me on Vortex: @${user.username}`,
          })
        } else {
          // Fallback download
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          link.download = `qr-${user.username}.png`
          link.click()
          URL.revokeObjectURL(url)
        }
      })
    } catch (error) {
      console.error("Error sharing QR code:", error)
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <motion.div
      className="absolute inset-0 z-[100] flex flex-col bg-[#1c242f]"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="px-4 h-[63px] flex items-center gap-3 border-b border-white/5 shrink-0">
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.9 }}
          className="p-2 -ml-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors"
        >
          <ArrowLeft size={22} />
        </motion.button>
        <h2 className="text-[18px] font-bold text-white flex-1 transition-all">QR Code</h2>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col items-center p-6 bg-[#1c242f]" 
           style={{ 
             backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)`,
             backgroundSize: '24px 24px'
           }}>
        
        {/* QR Card Container for capture */}
        <div 
          ref={qrRef}
          className="relative w-full aspect-[3/4] max-w-[320px] rounded-[32px] p-8 flex flex-col items-center justify-center shadow-2xl overflow-hidden"
          style={{ background: activeTheme.bg }}
        >
          {/* User Avatar Overlay (Top) */}
          <div className="absolute top-10 w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white flex items-center justify-center z-10">
            {user.avatar ? (
              <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-2xl" style={{ color: ACCENT, backgroundColor: '#f3f4f6' }}>
                {user.username[0]?.toUpperCase()}
              </div>
            )}
          </div>

          {/* QR Code White Box */}
          <div className="bg-white rounded-[24px] p-6 pt-16 mt-12 w-full flex flex-col items-center shadow-inner">
            <div className="p-2 bg-white rounded-xl">
              <QRCodeSVG
                value={profileUrl}
                size={180}
                level="H"
                includeMargin={false}
                imageSettings={user.avatar ? {
                  src: user.avatar,
                  x: undefined,
                  y: undefined,
                  height: 40,
                  width: 40,
                  excavate: true,
                } : undefined}
                style={{ borderRadius: '8px' }}
              />
            </div>
            
            <p className="mt-8 text-[20px] font-bold tracking-tight text-gray-800">
              @{user.username.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Theme Selectors */}
        <div className="mt-10 w-full px-2">
          <p className="text-gray-400 text-[13px] font-semibold uppercase tracking-wider mb-4 px-2">
            Appearance
          </p>
          <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar">
            {QR_THEMES.map((theme) => (
              <motion.button
                key={theme.id}
                onClick={() => setActiveTheme(theme)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-14 h-14 rounded-2xl shrink-0 border-2 transition-all flex items-center justify-center ${
                  activeTheme.id === theme.id ? "border-white" : "border-transparent"
                }`}
                style={{ background: theme.bg }}
              >
                {activeTheme.id === theme.id && <Check size={20} className="text-white" />}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Share Button */}
        <div className="mt-auto w-full pt-8 pb-4">
          <motion.button
            onClick={handleShare}
            disabled={isSharing}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-14 rounded-2xl bg-white text-black font-bold text-[16px] flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
          >
            {isSharing ? (
              <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <Share2 size={20} />
                Share QR Code
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
