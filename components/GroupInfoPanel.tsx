"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Users, Crown, Shield, User, MessageSquare } from "lucide-react"
import TitleBadge from "./TitleBadge"
import { VerifiedBadge } from "./VerifiedBadge"

const ACCENT = "#7e85e1"
const DEV_USER_ID = 1

interface GroupMember {
  userId: number
  role: string
  joinedAt: string
  user: { id: number; username: string; avatar?: string }
}

interface GroupInfoPanelProps {
  conversationId: string | number
  conversation: any
  currentUserId: string | number | undefined
  onClose: () => void
  onOpenPrivateChat: (userId: string) => void
  isMobile?: boolean
}

export default function GroupInfoPanel({
  conversationId, conversation, currentUserId, onClose, onOpenPrivateChat, isMobile,
}: GroupInfoPanelProps) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!conversation?.participants) { setLoading(false); return }
    // Сортируем: owner → admin → member
    const sorted = [...conversation.participants].sort((a: any, b: any) => {
      const order = { owner: 0, admin: 1, member: 2 }
      return (order[a.role as keyof typeof order] ?? 2) - (order[b.role as keyof typeof order] ?? 2)
    })
    setMembers(sorted)
    setLoading(false)
  }, [conversation])

  const memberCount = members.length
  const groupName = conversation?.name || "Группа"
  const groupAvatar = conversation?.avatar
  const groupDesc = conversation?.description

  const RoleIcon = ({ role }: { role: string }) => {
    if (role === "owner") return <Crown size={13} className="text-yellow-400 shrink-0" />
    if (role === "admin") return <Shield size={13} className="text-blue-400 shrink-0" />
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: isMobile ? 0 : 280, y: isMobile ? 60 : 0, scale: isMobile ? 0.96 : 1 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: isMobile ? 0 : 280, y: isMobile ? 60 : 0, scale: isMobile ? 0.96 : 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className={`
        flex flex-col overflow-hidden z-50
        ${isMobile
          ? "fixed inset-x-0 bottom-0 top-[10%] rounded-t-[28px]"
          : "absolute top-0 right-0 bottom-0 w-[300px] border-l border-white/8"
        }
      `}
      style={{ backgroundColor: "#1c242f" }}
    >
      {/* Header */}
      <div className="px-4 h-[58px] flex items-center gap-3 border-b border-white/8 shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: ACCENT + "20" }}
        >
          <Users size={16} style={{ color: ACCENT }} />
        </div>
        <h2 className="text-[16px] font-bold text-white flex-1">Информация о группе</h2>
        <motion.button
          onClick={onClose} whileTap={{ scale: 0.88 }}
          className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {/* Group avatar + name */}
        <div className="flex flex-col items-center pt-6 pb-5 px-4 border-b border-white/5">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl mb-3 overflow-hidden"
            style={{ backgroundColor: ACCENT }}
          >
            {groupAvatar
              ? <img src={groupAvatar} className="w-full h-full object-cover" alt="" />
              : groupName[0]?.toUpperCase()
            }
          </div>
          <h3 className="text-[18px] font-bold text-white text-center leading-tight">{groupName}</h3>
          <p className="text-[13px] mt-1" style={{ color: ACCENT }}>
            {memberCount.toLocaleString()} участник{memberCount === 1 ? "" : memberCount < 5 ? "а" : "ов"}
          </p>
          {groupDesc && (
            <p className="text-[13px] text-gray-400 text-center mt-2 leading-relaxed px-2">{groupDesc}</p>
          )}
        </div>

        {/* Members list */}
        <div className="pt-3 pb-2 px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: ACCENT }}>
            Участники
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: ACCENT }} />
          </div>
        ) : (
          <div className="px-2 pb-4">
            {members.map((member) => {
              const isMe = member.userId?.toString() === currentUserId?.toString()
              const isDev = Number(member.user.id) === DEV_USER_ID

              return (
                <motion.div
                  key={member.userId}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (!isMe) onOpenPrivateChat(member.userId.toString())
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-colors ${
                    isMe ? "cursor-default" : "cursor-pointer hover:bg-white/5"
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden text-base"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {member.user.avatar
                      ? <img src={member.user.avatar} className="w-full h-full object-cover" alt="" />
                      : member.user.username[0]?.toUpperCase()
                    }
                  </div>

                  {/* Name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[14px] font-semibold text-white truncate leading-tight">
                        {member.user.username}
                      </span>
                      {isDev && <VerifiedBadge size={13} />}
                      <TitleBadge userId={member.user.id} />
                      {isMe && (
                        <span className="text-[10px] text-gray-500 ml-0.5">вы</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-[1px]">
                      <RoleIcon role={member.role} />
                      {member.role !== "member" && (
                        <span className="text-[11px] text-gray-500">
                          {member.role === "owner" ? "Создатель" : "Администратор"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Open chat icon */}
                  {!isMe && (
                    <MessageSquare size={16} className="text-gray-600 shrink-0" />
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
