"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Search, Check, Users, ChevronRight } from "lucide-react"

const ACCENT = "var(--accent, #7e85e1)"

interface User {
  id: number
  username: string
  avatar?: string
}

interface CreateGroupModalProps {
  onClose: () => void
  onCreated: (conversation: any) => void
  currentUserId: string | number | undefined
}

export default function CreateGroupModal({ onClose, onCreated, currentUserId }: CreateGroupModalProps) {
  const [step, setStep] = useState<"members" | "details">("members")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [groupName, setGroupName] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) { setSearchResults([]); return }
      setIsSearching(true)
      try {
        const res = await fetch(`/api/users/search?query=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch { setSearchResults([]) }
      finally { setIsSearching(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const toggleUser = (user: User) => {
    setSelectedUsers(prev =>
      prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    )
  }

  const handleCreate = async () => {
    if (!groupName.trim()) { setError("Введите название группы"); return }
    setIsCreating(true); setError("")
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "group",
          name: groupName.trim(),
          memberIds: selectedUsers.map(u => u.id),
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const conv = await res.json()
      onCreated(conv)
      onClose()
    } catch (e: any) {
      setError(e.message || "Ошибка создания группы")
    } finally { setIsCreating(false) }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full md:max-w-md bg-[#1c242f] rounded-t-[28px] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "85vh" }}
        initial={{ y: 80, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 80, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-white/8 shrink-0">
          <motion.button onClick={onClose} whileTap={{ scale: 0.9 }}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400">
            <X size={20} />
          </motion.button>
          <h2 className="text-[17px] font-bold text-white flex-1">
            {step === "members" ? "Добавить участников" : "Название группы"}
          </h2>
          {step === "members" && selectedUsers.length > 0 && (
            <motion.button
              onClick={() => setStep("details")}
              whileTap={{ scale: 0.9 }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-[14px] font-semibold"
              style={{ backgroundColor: ACCENT }}
            >
              Далее <ChevronRight size={15} />
            </motion.button>
          )}
          {step === "details" && (
            <motion.button
              onClick={handleCreate} disabled={isCreating}
              whileTap={{ scale: 0.9 }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-[14px] font-semibold disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {isCreating ? "..." : "Создать"}
            </motion.button>
          )}
        </div>

        {/* Step: Members */}
        <AnimatePresence mode="wait">
          {step === "members" && (
            <motion.div key="members" className="flex flex-col flex-1 overflow-hidden"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {/* Search */}
              <div className="px-4 py-3 border-b border-white/5 shrink-0">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Поиск пользователей..."
                    className="w-full bg-[#242f3d] text-white text-[14px] rounded-full pl-9 pr-4 py-2.5 outline-none placeholder-gray-500"
                  />
                </div>
              </div>

              {/* Selected chips */}
              {selectedUsers.length > 0 && (
                <div className="flex gap-2 px-4 py-2 overflow-x-auto hide-scrollbar shrink-0 border-b border-white/5">
                  {selectedUsers.map(u => (
                    <div key={u.id} onClick={() => toggleUser(u)}
                      className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 cursor-pointer shrink-0">
                      <div className="w-5 h-5 rounded-full overflow-hidden text-white text-[10px] font-bold flex items-center justify-center"
                        style={{ backgroundColor: ACCENT }}>
                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.username[0].toUpperCase()}
                      </div>
                      <span className="text-[12px] text-white">{u.username}</span>
                      <X size={12} className="text-gray-400 ml-0.5" />
                    </div>
                  ))}
                </div>
              )}

              {/* Results */}
              <div className="flex-1 overflow-y-auto hide-scrollbar py-1">
                {isSearching ? (
                  <div className="text-center py-6 text-gray-500 text-[14px]">Поиск...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map(user => {
                    const isSelected = selectedUsers.some(u => u.id === user.id)
                    return (
                      <motion.div key={user.id} onClick={() => toggleUser(user)}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden"
                          style={{ backgroundColor: ACCENT }}>
                          {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-white truncate">{user.username}</p>
                          <p className="text-[12px] text-gray-500">@{user.username.toLowerCase()}</p>
                        </div>
                        <motion.div
                          animate={{ scale: isSelected ? 1 : 0.5, opacity: isSelected ? 1 : 0 }}
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: ACCENT }}
                        >
                          <Check size={14} className="text-white" strokeWidth={2.5} />
                        </motion.div>
                      </motion.div>
                    )
                  })
                ) : searchQuery.trim() ? (
                  <div className="text-center py-6 text-gray-500 text-[14px]">Пользователи не найдены</div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-600">
                    <Users size={40} />
                    <p className="text-[14px]">Найдите пользователей для добавления</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === "details" && (
            <motion.div key="details" className="flex flex-col gap-5 p-5"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              {/* Group icon placeholder */}
              <div className="flex flex-col items-center gap-3 pb-4 border-b border-white/5">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl"
                  style={{ backgroundColor: ACCENT }}>
                  {groupName ? groupName[0].toUpperCase() : <Users size={32} />}
                </div>
                <p className="text-[13px] text-gray-500">{selectedUsers.length} участник{selectedUsers.length === 1 ? "" : selectedUsers.length < 5 ? "а" : "ов"}</p>
              </div>

              {/* Group name input */}
              <div>
                <label className="text-[12px] text-gray-500 mb-1.5 block">Название группы</label>
                <input
                  autoFocus value={groupName} onChange={e => setGroupName(e.target.value)}
                  maxLength={64}
                  placeholder="Введите название..."
                  className="w-full bg-[#242f3d] text-white text-[16px] rounded-xl px-4 py-3 outline-none placeholder-gray-500"
                  style={{ border: `1.5px solid ${ACCENT}44` }}
                />
              </div>

              {error && <p className="text-red-400 text-[13px]">{error}</p>}

              {/* Members preview */}
              <div>
                <p className="text-[12px] text-gray-500 mb-2">Участники</p>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-1.5 bg-white/8 rounded-full px-3 py-1.5">
                      <div className="w-5 h-5 rounded-full overflow-hidden text-white text-[10px] font-bold flex items-center justify-center"
                        style={{ backgroundColor: ACCENT }}>
                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.username[0].toUpperCase()}
                      </div>
                      <span className="text-[13px] text-white">{u.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
