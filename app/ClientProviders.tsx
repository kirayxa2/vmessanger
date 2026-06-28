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
      // Announce ourselves as online immediately
      socket.emit("user-online", session.user.id);

      // Re-announce on reconnect
      const handleReconnect = () => {
        socket.emit("user-online", session.user.id);
      };
      socket.on("connect", handleReconnect);
      return () => { socket.off("connect", handleReconnect); };
    }
  }, [socket, session?.user?.id]);

  return <>{children}</>;
}

// Inner component with session access for socket init
function SocketInitializer({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Only connect when authenticated
    if (status !== "authenticated" || !session?.user?.id) {
      return;
    }

    // Получаем подписанный NextAuth JWT через API-роут и передаём его в сокет.
    // Раньше здесь был небезопасный btoa(JSON.stringify(...)) без подписи —
    // любой мог подделать userId. Теперь сервер проверяет подпись через NEXTAUTH_SECRET.
    let token: string
    try {
      const res = await fetch("/api/auth/token")
      if (!res.ok) throw new Error("token fetch failed")
      const data = await res.json()
      token = data.token
      if (!token) throw new Error("no token in response")
    } catch (err) {
      console.error("[socket] Failed to get JWT token:", err)
      return
    }

    const socketInstance = io(process.env.NEXT_PUBLIC_SITE_URL || "", {
      path: "/api/socket/io",
      addTrailingSlash: false,
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      auth: { token },
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (err: Error) => {
      console.error("Socket connection error:", err.message);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
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
