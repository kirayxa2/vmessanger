// Отправка писем. Поддерживает SMTP (nodemailer) и Resend (HTTP API).
// Приоритет: SMTP_* → RESEND_API_KEY → dev-фолбэк (код в консоль сервера).
//
// ENV (выставить на проде, напр. Render → Environment):
//   SMTP вариант (например Gmail app password):
//     SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_USER=you@gmail.com  SMTP_PASS=app_password
//     EMAIL_FROM="Vortex <you@gmail.com>"
//   Resend вариант:
//     RESEND_API_KEY=re_xxx   EMAIL_FROM="Vortex <onboarding@resend.dev>"

const FROM = process.env.EMAIL_FROM || "Vortex <onboarding@resend.dev>"

type SendResult = { sent: boolean; dev?: boolean; error?: string }

async function sendViaSmtp(to: string, subject: string, html: string): Promise<SendResult> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  // Динамический импорт — модуль грузится только когда реально нужен SMTP
  const nodemailer = (await import("nodemailer")).default
  const port = Number(SMTP_PORT) || 465
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = SMTPS, 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  await transporter.sendMail({ from: FROM, to, subject, html })
  return { sent: true }
}

async function sendViaResend(to: string, subject: string, html: string): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return { sent: false, error: `Resend ${res.status}: ${text}` }
  }
  return { sent: true }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  console.log(`[email] sendEmail called for: ${to}`)
  console.log(`[email] SMTP_HOST=${process.env.SMTP_HOST || '(not set)'}`)
  console.log(`[email] SMTP_USER=${process.env.SMTP_USER || '(not set)'}`)
  console.log(`[email] RESEND_API_KEY=${process.env.RESEND_API_KEY ? 're_***set***' : '(not set)'}`)
  console.log(`[email] EMAIL_FROM=${process.env.EMAIL_FROM || '(not set)'}`)
  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.log('[email] Using SMTP...')
      return await sendViaSmtp(to, subject, html)
    }
    if (process.env.RESEND_API_KEY) {
      console.log('[email] Using Resend...')
      const result = await sendViaResend(to, subject, html)
      console.log('[email] Resend result:', JSON.stringify(result))
      return result
    }
    console.warn(`[email] Не настроен провайдер (SMTP_* / RESEND_API_KEY). Письмо для ${to} НЕ отправлено.`)
    return { sent: false, dev: true }
  } catch (e: any) {
    console.error("[email] send error:", e?.message || e)
    return { sent: false, error: e?.message || "send failed" }
  }
}

// Красивое HTML-письмо с кодом подтверждения
function verificationHtml(code: string): string {
  const boxes = code
    .split("")
    .map(
      d =>
        `<td style="padding:0 5px;"><div style="width:46px;height:58px;line-height:58px;text-align:center;font-size:30px;font-weight:700;color:#ffffff;background:#171b26;border:1px solid #2a3142;border-radius:12px;font-family:'Courier New',monospace;">${d}</div></td>`
    )
    .join("")
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0e1621;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="text-align:center;margin-bottom:8px;">
      <div style="display:inline-block;width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#7e85e1,#5a62d6);line-height:64px;font-size:34px;">💬</div>
    </div>
    <h1 style="color:#fff;text-align:center;font-size:22px;margin:18px 0 6px;">Подтверждение почты</h1>
    <p style="color:#9aa4b2;text-align:center;font-size:14px;margin:0 0 28px;line-height:1.5;">
      Введите этот код в Vortex, чтобы завершить регистрацию.
    </p>
    <table align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;"><tr>${boxes}</tr></table>
    <p style="color:#6b7280;text-align:center;font-size:13px;margin:0;line-height:1.5;">
      Код действует 10 минут. Если вы не запрашивали регистрацию — просто проигнорируйте это письмо.
    </p>
    <div style="border-top:1px solid #1f2735;margin:28px 0 0;padding-top:16px;text-align:center;">
      <span style="color:#4b5563;font-size:12px;">VortexMessenger</span>
    </div>
  </div>
</body></html>`
}

export async function sendVerificationEmail(to: string, code: string): Promise<SendResult> {
  return sendEmail(to, `Код подтверждения Vortex: ${code}`, verificationHtml(code))
}
