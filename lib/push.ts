import webpush from "web-push"
import { prisma } from "@/lib/prisma"

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com"

let configured = false
function ensureConfigured() {
  if (configured) return
  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID keys are not set — push notifications disabled")
    return
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

interface PushPayload {
  title: string
  body: string
  icon?: string
  image?: string
  url?: string
  conversationId?: number | string
  tag?: string
}

// Отправляет push-уведомление конкретному пользователю на все его устройства
export async function sendPushToUser(userId: number, payload: PushPayload) {
  ensureConfigured()
  if (!configured) return

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })
  if (subscriptions.length === 0) return

  const body = JSON.stringify(payload)

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        )
      } catch (err: any) {
        // 410/404 — подписка больше не действительна, удаляем
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {})
        } else {
          console.error("[push] send error:", err?.statusCode, err?.body || err?.message)
        }
      }
    })
  )
}
