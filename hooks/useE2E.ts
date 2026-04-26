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

// Кэш публичных ключей других пользователей (userId -> publicKeyBase64)
// Живёт в памяти пока открыта вкладка — не нужно каждый раз ходить на сервер
const publicKeyCache = new Map<string, string>()

export function useE2E() {
  const { data: session } = useSession()
  const [ready, setReady] = useState(false)
  const [e2eEnabled, setE2eEnabled] = useState(false)
  const initDone = useRef(false)

  // ── Инициализация: проверяем/генерируем ключи при первом рендере ──
  useEffect(() => {
    if (!session?.user?.id || initDone.current) return
    initDone.current = true

    ;(async () => {
      try {
        const hasKeys = await hasLocalKeys()

        if (!hasKeys) {
          // Новое устройство — генерируем ключи
          const { publicKey } = await generateKeyPair()

          // Загружаем публичный ключ на сервер
          await fetch("/api/e2e", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicKey }),
          })
        } else {
          // Ключи есть — проверяем что публичный ключ на сервере актуален
          const pubKey = await getPublicKeyBase64()
          if (pubKey) {
            // Синхронизируем с сервером (тихо, в фоне)
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
        // Если что-то пошло не так — продолжаем без E2E (деградация)
        setE2eEnabled(false)
      } finally {
        setReady(true)
      }
    })()
  }, [session?.user?.id])

  // ── Получить публичный ключ пользователя (с кэшированием) ──
  const getRecipientPublicKey = useCallback(async (userId: string | number): Promise<string | null> => {
    const uid = String(userId)

    if (publicKeyCache.has(uid)) {
      return publicKeyCache.get(uid)!
    }

    try {
      const res = await fetch(`/api/e2e?userId=${uid}`)
      if (!res.ok) return null
      const data = await res.json()
      if (data.publicKey) {
        publicKeyCache.set(uid, data.publicKey)
        return data.publicKey
      }
    } catch {
      return null
    }

    return null
  }, [])

  // ── Зашифровать сообщение для получателя ──
  const encrypt = useCallback(async (
    plaintext: string,
    recipientUserId: string | number
  ): Promise<string | null> => {
    if (!e2eEnabled) return null

    const recipientPubKey = await getRecipientPublicKey(recipientUserId)
    if (!recipientPubKey) return null

    return encryptMessage(plaintext, recipientPubKey)
  }, [e2eEnabled, getRecipientPublicKey])

  // ── Расшифровать сообщение от отправителя ──
  const decrypt = useCallback(async (
    encryptedContent: string,
    senderUserId: string | number
  ): Promise<string | null> => {
    if (!e2eEnabled) return null

    const senderPubKey = await getRecipientPublicKey(senderUserId)
    if (!senderPubKey) return null

    return decryptMessage(encryptedContent, senderPubKey)
  }, [e2eEnabled, getRecipientPublicKey])

  // ── Расшифровать список сообщений (для загрузки истории) ──
  const decryptMessages = useCallback(async <T extends { content: string; isEncrypted?: boolean; sender: { id: string | number } }>(
    messages: T[]
  ): Promise<T[]> => {
    if (!e2eEnabled) return messages

    const decrypted = await Promise.all(
      messages.map(async (msg) => {
        // Если сообщение не помечено как зашифрованное — возвращаем как есть
        if (!msg.isEncrypted) return msg

        // Своё сообщение — мы сами отправители, расшифровываем своим ключом
        // (ECDH симметричный — обе стороны получают одинаковый shared secret)
        const senderId = String(msg.sender.id)
        const myId = String(session?.user?.id)

        // Если это наше сообщение — нам нужен ключ получателя для расшифровки
        // Если чужое — нужен ключ отправителя
        // В ECDH sharedKey(myPriv, theirPub) == sharedKey(theirPriv, myPub)
        // Поэтому decrypt всегда вызываем с ключом другой стороны
        const otherUserId = senderId === myId ? senderId : senderId

        const plaintext = await decrypt(msg.content, otherUserId)
        if (plaintext === null) {
          // Не смогли расшифровать — показываем плейсхолдер
          return { ...msg, content: "🔒 Зашифрованное сообщение" }
        }
        return { ...msg, content: plaintext }
      })
    )

    return decrypted
  }, [e2eEnabled, decrypt, session?.user?.id])

  return {
    ready,
    e2eEnabled,
    encrypt,
    decrypt,
    decryptMessages,
    getRecipientPublicKey,
  }
}
