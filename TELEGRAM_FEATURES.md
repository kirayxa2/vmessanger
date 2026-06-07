# 🎨 Telegram-inspired Features

Новые фичи, вдохновлённые Telegram Web/Desktop, добавленные в проект.

---

## ✅ Реализованные фичи

### 1. **Double-tap для реакции** ❤️
**Как работает:**
- Двойной тап на сообщение = автоматически добавляет реакцию ❤️
- Анимация сердечка с fade-out эффектом
- Вибрация на поддерживаемых устройствах (20ms)

**Файл:** `components/ChatMessage.tsx`

```tsx
// Double-tap detection
const handleDoubleTap = useCallback(() => {
  onReaction?.(messageId, "❤️");
  setShowHeartAnimation(true);
  if (navigator.vibrate) navigator.vibrate(20);
}, [messageId, onReaction]);
```

---

### 5. **Kinetic Scrolling** 🎯
**Как работает:**
- Инерционный скролл с плавным замедлением (как на тачпадах)
- Коэффициент трения: 0.92 (8% замедления за фрейм)
- Поддержка wheel events и touch events

**Файл:** `hooks/useKineticScroll.ts`

**Использование:**
```tsx
import { useKineticScroll } from "@/hooks/useKineticScroll";

const scrollRef = useRef<HTMLDivElement>(null);
useKineticScroll(scrollRef, true);

<div ref={scrollRef} className="overflow-auto">
  {/* Content */}
</div>
```

---

### 8. **Pinned Messages Slider** 📌
**Как работает:**
- Поддержка **нескольких** закреплённых сообщений
- Горизонтальный свайп для переключения
- Стрелки навигации (◀ ▶)
- Индикаторы точками внизу
- Автоматическое переключение каждые 5 секунд

**Файл:** `components/chat/PinnedMessageBanner.tsx`

**Использование:**
```tsx
<PinnedMessageBanner
  pinnedMessages={[
    { id: 1, content: "Первое закреплённое", createdAt: "..." },
    { id: 2, content: "Второе закреплённое", createdAt: "..." },
  ]}
  onUnpin={(id) => handleUnpin(id)}
  onScrollTo={(id) => scrollToMessage(id)}
/>
```

**API изменения:**
```diff
- pinnedMessage: Message | null
+ pinnedMessages: Message[]

- onUnpin: () => void
+ onUnpin: (id: string) => void
```

---

### 9. **Text Selection с контекст-меню** ✂️
**Как работает:**
- Выделяешь текст в сообщении — появляется floating меню
- Действия: **Копировать**, **Ответить**, **Цитата**, **Переслать**
- Автоматически позиционируется над выделением
- Закрывается при клике вне меню

**Файл:** `components/TextSelectionMenu.tsx`

**Использование:**
```tsx
import TextSelectionMenu from "@/components/TextSelectionMenu";

<TextSelectionMenu
  onCopy={(text) => navigator.clipboard.writeText(text)}
  onReply={(text) => handleReply(text)}
  onQuote={(text) => handleQuote(text)}
  onForward={(text) => handleForward(text)}
/>
```

**Встроить в ChatWindow:**
```tsx
<div className="message-container">
  {messages.map(msg => <ChatMessage key={msg.id} {...msg} />)}
  <TextSelectionMenu
    onReply={(text) => setReplyingTo({ text })}
    onCopy={(text) => copyToClipboard(text)}
  />
</div>
```

---

### 11. **Улучшенные Message Animations** ✨
**Что улучшено:**

#### **Появление нового сообщения:**
```tsx
initial={{ opacity: 0, scale: 0.94, y: 8, filter: "blur(4px)" }}
animate={{ 
  opacity: 1, 
  scale: 1, 
  y: 0,
  filter: "blur(0px)"
}}
```
- Плавный fade-in + blur
- Микросдвиг вверх (8px)
- Spring анимация (stiffness: 500, damping: 36)

#### **Удаление сообщения:**
```tsx
exit={{ 
  opacity: 0, 
  scale: 0.8,
  filter: "blur(8px)"
}}
```
- Fade-out + shrink + blur
- Duration: 300ms

#### **Hover эффект:**
```tsx
whileHover={{ scale: 1.005 }}
```
- Микромасштабирование при наведении

**Файл:** `components/ChatMessage.tsx`

---

### 12. **Voice Playback Speed Slider** 🎚️
**Как работает:**
- Клик на кнопку скорости (1x, 1.5x, 2x...) → открывается меню
- Выбор из 8 вариантов: **0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x, 2.5x**
- Текущая скорость подсвечивается акцентным цветом + галочка ✓
- Портал в body (z-index: 99999)

**Файл:** `components/ChatMessage.tsx`

**UI:**
```
┌─────────────┐
│  Скорость   │
├─────────────┤
│ 0.5x        │
│ 0.75x       │
│ 1x       ✓  │ ← Активная
│ 1.25x       │
│ 1.5x        │
│ 1.75x       │
│ 2x          │
│ 2.5x        │
└─────────────┘
```

---

## 🎯 Дополнительные фичи (из исследования)

### Уже реализовано ✅
- ✅ Swipe-to-reply
- ✅ Long-press context menu
- ✅ Quick reactions
- ✅ Voice messages с waveform
- ✅ Link previews
- ✅ Read indicators (✓, ✓✓)
- ✅ Bot inline keyboard
- ✅ Stories row

### Можно добавить в будущем 🚀
- ⏳ **Message effects** (огонь 🔥, сердечки ❤️, конфетти 🎉 при отправке)
- ⏳ **Ripple effect** на кнопках (Material Design)
- ⏳ **Hover reactions preview** (кто поставил реакцию)
- ⏳ **Jump to date** (календарь для быстрого перехода)
- ⏳ **Typing indicators** ("User is typing...")
- ⏳ **Swipe-up для скролла** вверх чата

---

## 📚 Ссылки

- [Telegram Desktop GitHub](https://github.com/telegramdesktop/tdesktop)
- [Telegram Web K (morethanwords/tweb)](https://github.com/morethanwords/tweb)
- [Telegram Web A (Ajaxy/telegram-tt)](https://github.com/Ajaxy/telegram-tt)
- [Telegram Blog — Features](https://telegram.org/blog)

---

## 🛠️ Интеграция

### 1. ChatWindow.tsx
Добавь `TextSelectionMenu`:
```tsx
import TextSelectionMenu from "@/components/TextSelectionMenu";

<TextSelectionMenu
  onReply={(text) => setReplyingTo({ text })}
  onCopy={(text) => navigator.clipboard.writeText(text)}
/>
```

### 2. Kinetic Scroll
Примени к контейнеру сообщений:
```tsx
import { useKineticScroll } from "@/hooks/useKineticScroll";

const messagesRef = useRef<HTMLDivElement>(null);
useKineticScroll(messagesRef, true);

<div ref={messagesRef} className="overflow-auto">
  {/* Messages */}
</div>
```

### 3. Pinned Messages (обновить API)
Измени структуру данных:
```diff
- const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null)
+ const [pinnedMessages, setPinnedMessages] = useState<Message[]>([])

<PinnedMessageBanner
-  pinnedMessage={pinnedMessage}
+  pinnedMessages={pinnedMessages}
-  onUnpin={() => setPinnedMessage(null)}
+  onUnpin={(id) => handleUnpin(id)}
  onScrollTo={scrollToMessage}
/>
```

---

**Content was rephrased for compliance with licensing restrictions.**

Все фичи реализованы с использованием best practices Telegram и адаптированы под ваш стек (Next.js + Framer Motion + TypeScript).
