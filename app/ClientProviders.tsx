"use client"

import i18n from "@/lib/i18n";
import { SessionProvider, useSession } from "next-auth/react";
import { createContext, useContext, useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

// Inner component that has access to session
function SocketManager({ children, socket }: { children: React.ReactNode, socket: Socket | null }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (socket && session?.user?.id) {
      socket.emit("user-online", session.user.id);

      const handleReconnect = () => {
        socket.emit("user-online", session.user.id);
      };
      socket.on("connect", handleReconnect);
      return () => { socket.off("connect", handleReconnect); };
    }
  }, [socket, session?.user?.id]);

  // Регистрация push-подписки (как в Telegram: системные уведомления о новых сообщениях)
  useEffect(() => {
    if (!session?.user?.id) return
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) return

    let cancelled = false

    function urlBase64ToUint8Array(base64String: string) {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
      const rawData = window.atob(base64)
      const outputArray = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
      }
      return outputArray
    }

    (async () => {
      try {
        // Запрашиваем разрешение на уведомления, если ещё не спросили
        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission()
          if (permission !== "granted") return
        }
        if (Notification.permission !== "granted") return

        const registration = await navigator.serviceWorker.register("/sw.js")
        await navigator.serviceWorker.ready
        if (cancelled) return

        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          })
        }
        if (cancelled) return

        const subJson = subscription.toJSON()
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          }),
        })
      } catch (err) {
        console.error("[push] subscription failed:", err)
      }
    })()

    return () => { cancelled = true }
  }, [session?.user?.id])

  return <>{children}</>;
}

// Inner component with session access for socket init
function SocketInitializer({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      return;
    }

    // useEffect не может быть async — оборачиваем в IIFE
    // cancelled флаг защищает от race condition если компонент размонтировался
    // пока мы ждали токен
    let cancelled = false;
    let socketInstance: ReturnType<typeof io> | null = null;

    (async () => {
      // Получаем подписанный NextAuth JWT через API-роут.
      // Раньше здесь был небезопасный btoa(JSON.stringify(...)) без подписи.
      let token: string;
      try {
        const res = await fetch("/api/auth/token");
        if (!res.ok) throw new Error("token fetch failed");
        const data = await res.json();
        token = data.token;
        if (!token) throw new Error("no token in response");
      } catch (err) {
        console.error("[socket] Failed to get JWT token:", err);
        return;
      }

      if (cancelled) return;

      socketInstance = io(process.env.NEXT_PUBLIC_SITE_URL || "", {
        path: "/api/socket/io",
        addTrailingSlash: false,
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        auth: { token },
      });

      socketInstance.on("connect", () => setIsConnected(true));
      socketInstance.on("disconnect", () => setIsConnected(false));
      socketInstance.on("connect_error", (err: Error) => {
        console.error("Socket connection error:", err.message);
      });

      setSocket(socketInstance);
    })();

    return () => {
      cancelled = true;
      if (socketInstance) {
        socketInstance.disconnect();
      }
      setSocket(null);
    };
  }, [status, session?.user?.id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      <SocketManager socket={socket}>
        {children}
      </SocketManager>
    </SocketContext.Provider>
  );
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <SessionProvider>
        <SocketContext.Provider value={{ socket: null, isConnected: false }}>
          {children}
        </SocketContext.Provider>
      </SessionProvider>
    );
  }

  return (
    <SessionProvider>
      <I18nextProvider i18n={i18n}>
        <SocketInitializer>
          {children}
        </SocketInitializer>
      </I18nextProvider>
    </SessionProvider>
  );
}
