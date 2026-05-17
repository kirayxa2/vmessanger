"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import {
  generateKeyPair,
  getPrivateKey,
  hasLocalKeys,
  encryptMessage,
  decryptMessage,
  getPublicKeyBase64,
} from "@/lib/crypto"

// Глобальный кэш публичных ключей (userId -> publicKeyBase64)
// Живёт между перемонтами страницы — не нужно каждый раз ходить на сервер
 const publicKeyCache = new Map<string, string>()

// Очередь запросов на сервер — предотвращаем дублирование запросов для одного userId
const pendingFetches = new Map<string, Promise<string | null>>()

async function fetchPublicKeyFromServer(uid: string): Promise<string | null> {
  // Если уже есть параллельный запрос — ожидаем его
  if (pendingFetches.has(uid)) return pendingFetches.get(uid)!

  const promise = (async () => {
    try {
      const res = await fetch(`/api/e2e?userId=${uid}`)
      if (!res.ok) return null
      const data = await res.json()
      if (data.publicKey) {
        publicKeyCache.set(uid, data.publicKey)
        try { sessionStorage.setItem("vortex_pubkey_" + uid, data.publicKey) } catch {}
        return data.publicKey
      }
      return null
    } catch {
      return null
    } finally {
      pendingFetches.delete(uid)
    }
  })()

  pendingFetches.set(uid, promise)
  return promise
}

export function useE2E() {
  const { data: session } = useSession()
  const [ready, setReady] = useState(false)
  const [e2eEnabled, setE2eEnabled] = useState(false)
  const initDone = useRef(false)
  // Промис инициализации — decryptMessages ждёт его вместо того чтобы возвращать мусор
  const initPromiseRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (!session?.user?.id || initDone.current) return
    initDone.current = true

    const initPromise = (async () => {
      try {
        const hasKeys = await hasLocalKeys()

        if (!hasKeys) {
          const { publicKey } = await generateKeyPair()
          await fetch("/api/e2e", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicKey }),
          })
        } else {
          const pubKey = await getPublicKeyBase64()
          if (pubKey) {
            fetch("/api/e2e", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ publicKey: pubKey }),
            }).catch(() => {})
          }
        }
        setE2eEnabled(true)
      } catch (err) {
        console.error("[E2E] Init error:", err)
        setE2eEnabled(false)
      } finally {
        setReady(true)
      }
    })()

    initPromiseRef.current = initPromise
  }, [session?.user?.id])

  // Получить публичный ключ пользователя с кэшированием и дедублированием запросов
  const getRecipientPublicKey = useCallback(async (userId: string | number): Promise<string | null> => {
    const uid = String(userId)

    // 1. In-memory кэш
    if (publicKeyCache.has(uid)) return publicKeyCache.get(uid)!

    // 2. sessionStorage
    try {
      const cached = sessionStorage.getItem("vortex_pubkey_" + uid)
      if (cached) {
        publicKeyCache.set(uid, cached)
        return cached
      }
    } catch {}

    // 3. Сервер (с дедублированием)
    return fetchPublicKeyFromServer(uid)
  }, [])

  // Зашифровать сообщение
  const encrypt = useCallback(async (
    plaintext: string,
    recipientUserId: string | number
  ): Promise<string | null> => {
    if (!e2eEnabled) return null
    const recipientPubKey = await getRecipientPublicKey(recipientUserId)
    if (!recipientPubKey) return null
    return encryptMessage(plaintext, recipientPubKey)
  }, [e2eEnabled, getRecipientPublicKey])

  // Расшифровать сообщение
  const decrypt = useCallback(async (
    encryptedContent: string,
    senderUserId: string | number
  ): Promise<string | null> => {
    if (!e2eEnabled) return null
    const senderPubKey = await getRecipientPublicKey(senderUserId)
    if (!senderPubKey) return null
    return decryptMessage(encryptedContent, senderPubKey)
  }, [e2eEnabled, getRecipientPublicKey])

  // Расшифровать список сообщений
  // Ждёт инициализацию E2E перед обработкой — без расинг кондишных не вернёт
  const decryptMessages = useCallback(async (messages: any[]): Promise<any[]> => {
    // Ждём инициализации
    if (initPromiseRef.current) await initPromiseRef.current

    // Если E2E не активно — возвращаем как есть
    if (!e2eEnabled) return messages

    // Предзагружаем все публичные ключи параллельно
    const encryptedMessages = messages.filter(m => m.isEncrypted)
    if (encryptedMessages.length > 0) {
      const uniqueSenderIds = [...new Set(encryptedMessages.map(m => String(m.sender?.id)))]
      await Promise.all(uniqueSenderIds.map(id => getRecipientPublicKey(id)))
    }

    return Promise.all(
      messages.map(async (msg) => {
        if (!msg.isEncrypted) return msg
        const senderId = String(msg.sender?.id)
        const plaintext = await decrypt(msg.content, senderId)
        if (plaintext === null) {
          // Расшифровка не удалась — повторим один раз через 100мс (ключ мог только что загрузиться)
          await new Promise(r => setTimeout(r, 100))
          const retry = await decrypt(msg.content, senderId)
          if (retry !== null) return { ...msg, content: retry }
          // Если даже retry не сработал — сообщаем честно, не показываем мусор
          console.error(`[E2E] Не удалось расшифровать сообщение ${msg.id} от пользователя ${senderId}`)
          return { ...msg, content: "🔒 Сообщение зашифровано", isEncrypted: false }
        }
        return { ...msg, content: plaintext }
      })
    )
  }, [e2eEnabled, decrypt, getRecipientPublicKey])

  return {
    ready,
    e2eEnabled,
    encrypt,
    decrypt,
    decryptMessages,
    getRecipientPublicKey,
  }
}
