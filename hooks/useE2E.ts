"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import {
  generateKeyPair,
  getPrivateKey,
  hasLocalKeys,
  encryptMessage,
  decryptMessage,
  encryptMessageForSelf,
  decryptMessageFromSelf,
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

// Тип результата шифрования: пара копий — для получателя и для себя
export interface EncryptedPair {
  forRecipient: string
  forSender: string
}

export function useE2E() {
  const { data: session } = useSession()
  const [ready, setReady] = useState(false)
  const [e2eEnabled, setE2eEnabled] = useState(false)
  const initDone = useRef(false)
  const e2eEnabledRef = useRef(false)
  // Простой флаг: инициализация завершена (успешно или нет)
  const initFinishedRef = useRef(false)
  // ID текущего пользователя — для определения "своих" сообщений
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!session?.user?.id) return
    currentUserIdRef.current = String(session.user.id)
    if (initDone.current) return
    initDone.current = true

    ;(async () => {
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
        e2eEnabledRef.current = true
      } catch (err) {
        console.error("[E2E] Init error:", err)
        setE2eEnabled(false)
      } finally {
        setReady(true)
        initFinishedRef.current = true
      }
    })()
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

  // Зашифровать сообщение — возвращает ПАРУ копий: для получателя и для себя
  // Если что-то не получилось — возвращает null (UI должен слать plaintext)
  const encrypt = useCallback(async (
    plaintext: string,
    recipientUserId: string | number
  ): Promise<EncryptedPair | null> => {
    if (!e2eEnabledRef.current) return null
    const recipientPubKey = await getRecipientPublicKey(recipientUserId)
    if (!recipientPubKey) return null

    // Параллельно: одна копия для получателя, одна для себя
    const [forRecipient, forSender] = await Promise.all([
      encryptMessage(plaintext, recipientPubKey),
      encryptMessageForSelf(plaintext),
    ])
    if (!forRecipient || !forSender) return null
    return { forRecipient, forSender }
  }, [getRecipientPublicKey])

  // Расшифровать сообщение — авто выбирает: своё или чужое
  // Для своих — использует contentForSender (если передан) и расшифровывает self-key
  // Для чужих — использует обычную расшифровку через ключ отправителя
  const decrypt = useCallback(async (
    encryptedContent: string,
    senderUserId: string | number,
    encryptedContentForSender?: string | null
  ): Promise<string | null> => {
    if (!e2eEnabledRef.current) return null

    const senderId = String(senderUserId)
    const myId = currentUserIdRef.current

    // Если это моё сообщение и есть self-копия — расшифровываем её
    if (myId && senderId === myId) {
      if (encryptedContentForSender) {
        return decryptMessageFromSelf(encryptedContentForSender)
      }
      // Нет self-копии (старое сообщение до фикса) — пробуем decrypt через свой же pub key
      // на случай если сообщение всё-таки удастся прочесть
      return decryptMessageFromSelf(encryptedContent)
    }

    // Чужое сообщение — обычный путь через pub key отправителя
    const senderPubKey = await getRecipientPublicKey(senderUserId)
    if (!senderPubKey) return null
    return decryptMessage(encryptedContent, senderPubKey)
  }, [getRecipientPublicKey])

  // Расшифровать список сообщений
  // Ждёт инициализацию E2E перед обработкой — без расинг кондишных не вернёт
  const decryptMessages = useCallback(async (messages: any[]): Promise<any[]> => {
    // Ждём инициализации E2E макс 3 секунды, потом идём дальше без E2E
    if (!initFinishedRef.current) {
      const deadline = Date.now() + 3000
      while (!initFinishedRef.current && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 50))
      }
    }

    // если E2E не включился — возвращаем сообщения как есть
    if (!e2eEnabledRef.current) return messages

    const myId = currentUserIdRef.current

    // Предзагружаем все публичные ключи отправителей параллельно
    // (только чужих — для своих ключ не нужен, расшифруем self-копию)
    const encryptedMessages = messages.filter(m => m.isEncrypted)
    if (encryptedMessages.length > 0) {
      const otherSenderIds = [...new Set(
        encryptedMessages
          .map(m => String(m.sender?.id))
          .filter(id => id !== myId)
      )]
      await Promise.all(otherSenderIds.map(id => getRecipientPublicKey(id)))
    }

    return Promise.all(
      messages.map(async (msg) => {
        if (!msg.isEncrypted) return msg
        const senderId = String(msg.sender?.id)
        const isOwn = myId && senderId === myId

        const plaintext = await decrypt(msg.content, senderId, msg.contentForSender)
        if (plaintext === null) {
          // Расшифровка не удалась — повторим один раз через 100мс (ключ мог только что загрузиться)
          await new Promise(r => setTimeout(r, 100))
          const retry = await decrypt(msg.content, senderId, msg.contentForSender)
          if (retry !== null) return { ...msg, content: retry }
          // Если даже retry не сработал — сообщаем честно, не показываем мусор
          if (isOwn && !msg.contentForSender) {
            // Старое сообщение без self-копии — не сможем расшифровать никогда
            console.warn(`[E2E] Своё сообщение ${msg.id} без contentForSender — не расшифровать (отправлено до фикса)`)
          } else {
            console.error(`[E2E] Не удалось расшифровать сообщение ${msg.id} от пользователя ${senderId}`)
          }
          return { ...msg, content: "🔒 Сообщение зашифровано", isEncrypted: false }
        }
        return { ...msg, content: plaintext }
      })
    )
  }, [decrypt, getRecipientPublicKey])

  return {
    ready,
    e2eEnabled,
    encrypt,
    decrypt,
    decryptMessages,
    getRecipientPublicKey,
  }
}
