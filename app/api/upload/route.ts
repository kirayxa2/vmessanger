import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/authOptions"
import { supabaseAdmin } from "@/lib/supabase"
import { randomUUID } from "node:crypto"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 })
    }

    // Whitelist allowed MIME types — блокируем исполняемые файлы
    const ALLOWED_TYPES = [
      // Images
      "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
      // Video
      "video/mp4", "video/webm", "video/ogg", "video/quicktime",
      // Audio
      "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/mp4", "audio/aac",
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      // Archives
      "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
      // Text
      "text/plain", "text/csv", "application/json",
    ]
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 415 })
    }

    // SECURITY: имя файла делаем непредсказуемым — crypto.randomUUID() вместо Math.random(),
    // у которого очень низкая энтропия (~5-8 символов base36) и его теоретически
    // можно перебрать/угадать.
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin"
    const safeName = `${session.user.id}-${Date.now()}-${randomUUID()}.${ext}`
    const filePath = `uploads/${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // SECURITY: вложения из чатов (фото, документы, голосовые) грузятся в отдельный
    // приватный bucket "chat-files" (не путать с публичным "avatars"). Раньше файлы чатов
    // лежали в публичном bucket и были доступны всем по прямой ссылке, даже без
    // участия в чате — теперь выдаётся подписанная ссылка с долгим сроком действия.
    const CHAT_FILES_BUCKET = "chat-files"
    const { error: uploadError } = await supabaseAdmin.storage
      .from(CHAT_FILES_BUCKET)
      .upload(filePath, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error("Upload error:", uploadError)
      return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }

    // Подписанный URL вместо публичного — срок действия 1 год (достаточно долго, чтобы
    // не ломать старые сообщения, но сам URL перестаёт работать без прямого доступа к bucket).
    const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(CHAT_FILES_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)

    if (signError || !signedData?.signedUrl) {
      console.error("Signed URL error:", signError)
      return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }

    return NextResponse.json({
      url: signedData.signedUrl,
      name: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error("Upload API error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
