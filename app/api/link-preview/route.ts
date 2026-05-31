import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/authOptions"

// Простейший OG-парсер: тащим HTML и достаём og:* / twitter:* / <title>.
// Без внешних зависимостей. С базовой защитой от SSRF (запрещаем приватные адреса).

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
}

function metaContent(html: string, names: string[]): string | undefined {
  for (const name of names) {
    // <meta property="og:title" content="...">  (порядок атрибутов любой)
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
      "i"
    )
    const tag = re.exec(html)?.[0]
    if (tag) {
      const c = /content=["']([^"']*)["']/i.exec(tag)?.[1]
      if (c) return decodeEntities(c.trim())
    }
  }
  return undefined
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true
  // IPv4 приватные/loopback диапазоны
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (h === "0.0.0.0" || h === "::1" || h.startsWith("[")) return true
  return false
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const raw = new URL(req.url).searchParams.get("url")
    if (!raw) return NextResponse.json({ error: "url is required" }, { status: 400 })

    let target: URL
    try {
      target = new URL(raw)
    } catch {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 })
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 })
    }
    if (isBlockedHost(target.hostname)) {
      return NextResponse.json({ error: "Blocked host" }, { status: 400 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    let res: Response
    try {
      res = await fetch(target.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; VortexBot/1.0; +https://vortex.chat)",
          Accept: "text/html,application/xhtml+xml",
        },
      })
    } finally {
      clearTimeout(timeout)
    }

    const ct = res.headers.get("content-type") || ""
    if (!res.ok || !ct.includes("text/html")) {
      return NextResponse.json({ preview: null })
    }

    // Читаем не более ~512КБ — заголовки точно в <head>
    const reader = res.body?.getReader()
    let html = ""
    if (reader) {
      const decoder = new TextDecoder()
      let received = 0
      while (received < 512 * 1024) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.length
        html += decoder.decode(value, { stream: true })
        if (/<\/head>/i.test(html)) break // дальше head нам не нужен
      }
      try { await reader.cancel() } catch {}
    } else {
      html = (await res.text()).slice(0, 512 * 1024)
    }

    const title =
      metaContent(html, ["og:title", "twitter:title"]) ||
      decodeEntities((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "").trim()) ||
      undefined
    const description = metaContent(html, ["og:description", "twitter:description", "description"])
    let image = metaContent(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"])
    const siteName = metaContent(html, ["og:site_name"]) || target.hostname.replace(/^www\./, "")

    // Относительный путь картинки → абсолютный
    if (image && !/^https?:\/\//i.test(image)) {
      try { image = new URL(image, target.toString()).toString() } catch { image = undefined }
    }

    if (!title && !description && !image) {
      return NextResponse.json({ preview: null })
    }

    return NextResponse.json({
      preview: {
        url: target.toString(),
        title: title?.slice(0, 200),
        description: description?.slice(0, 300),
        image,
        siteName: siteName?.slice(0, 100),
      },
    })
  } catch {
    return NextResponse.json({ preview: null })
  }
}
