"use client"
export default function OfflinePage() {
  return (
    <html>
      <head>
        <title>Vortex — Нет соединения</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #0a0f17;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 20px;
            padding: 24px;
            text-align: center;
          }
          .icon {
            width: 80px; height: 80px;
            background: rgba(126,133,225,0.15);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          h1 { font-size: 22px; font-weight: 700; }
          p { font-size: 15px; color: #6b7280; line-height: 1.5; max-width: 280px; }
          button {
            margin-top: 8px;
            background: #7e85e1;
            color: white;
            border: none;
            padding: 12px 32px;
            border-radius: 24px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
          }
        `}</style>
      </head>
      <body>
        <div className="icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#7e85e1" strokeWidth="1.8" strokeLinecap="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <line x1="12" y1="20" x2="12.01" y2="20"/>
          </svg>
        </div>
        <h1>Нет соединения</h1>
        <p>Проверьте подключение к интернету и попробуйте снова</p>
        <button onClick={() => window.location.reload()}>Попробовать снова</button>
      </body>
    </html>
  )
}
