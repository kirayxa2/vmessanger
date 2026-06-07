import { useEffect, useRef } from "react";

/**
 * Kinetic scrolling hook (как в Telegram Desktop)
 * Добавляет инерционный скролл с плавным замедлением
 */
export function useKineticScroll(elementRef: React.RefObject<HTMLElement | null>, enabled = true) {
  const velocityY = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const rafId = useRef<number | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const el = elementRef.current;
    if (!el) return;

    const FRICTION = 0.92; // Коэффициент замедления (0.92 = 8% замедления за фрейм)
    const MIN_VELOCITY = 0.5; // Минимальная скорость (пиксели/фрейм)

    const handleWheel = (e: WheelEvent) => {
      // Обычный скролл — обрабатываем нативно
      if (Math.abs(e.deltaY) < 50) return;
      
      // Быстрый свайп — добавляем инерцию
      e.preventDefault();
      velocityY.current = -e.deltaY * 0.5;
      lastTime.current = Date.now();
      startKinetic();
    };

    const handleTouchStart = (e: TouchEvent) => {
      isDragging.current = true;
      lastY.current = e.touches[0].clientY;
      lastTime.current = Date.now();
      velocityY.current = 0;
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const now = Date.now();
      const dt = now - lastTime.current;
      if (dt === 0) return;

      const dy = e.touches[0].clientY - lastY.current;
      velocityY.current = (dy / dt) * 16; // px/frame (60fps)
      lastY.current = e.touches[0].clientY;
      lastTime.current = now;
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
      if (Math.abs(velocityY.current) > MIN_VELOCITY) {
        startKinetic();
      }
    };

    const startKinetic = () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);

      const animate = () => {
        if (!el) return;
        if (Math.abs(velocityY.current) < MIN_VELOCITY) {
          velocityY.current = 0;
          rafId.current = null;
          return;
        }

        el.scrollTop -= velocityY.current;
        velocityY.current *= FRICTION;
        rafId.current = requestAnimationFrame(animate);
      };

      rafId.current = requestAnimationFrame(animate);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [elementRef, enabled]);
}
