import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      // Search & nav
      "search_placeholder": "Search",
      "back": "Back",
      "cancel": "Cancel",
      "save": "Save",
      "edit": "Edit",
      "delete": "Delete",
      "close": "Close",

      // Sidebar menu
      "my_profile": "My Profile",
      "saved_messages": "Saved Messages",
      "settings": "Settings",
      "night_mode": "Night Mode",
      "logout": "Logout",
      "vortex_account": "Vortex account",
      "global_search": "Global Search",

      // Settings screen
      "language": "Language",
      "notifications": "Notifications & Sounds",
      "privacy": "Privacy & Security",
      "devices": "Devices",
      "chat_folders": "Chat Folders",
      "edit_profile": "Edit profile",
      "username_label": "Username",
      "bio_label": "Bio",
      "bio_hint": "Any details such as age, occupation or city.",
      "username_hint": "You can use a–z, 0–9 and underscores. Minimum length is 5 characters.",
      "first_name_label": "First name (required)",
      "online": "online",
      "press_to_change": "Press to change",
      "no_bio": "No bio yet",
      "about": "About",
      "joined": "Joined",

      // Chat list
      "no_messages": "No messages yet",
      "draft": "Draft",
      "service_notifications": "Service notifications",
      "saved_chat_subtitle": "Your saved messages",

      // Chat window
      "chat": "Chat",
      "today": "Today",
      "yesterday": "Yesterday",
      "message_placeholder": "Message",
      "typing": "Typing",
      "last_seen": "last seen recently",
      "last_seen_just_now": "last seen just now",
      "service_channel_notice": "This is a service channel — you cannot reply",
      "editing_message": "Editing message",

      // Message context menu
      "copy": "Copy Text",
      "reply": "Reply",
      "forward": "Forward",
      "pin": "Pin",
      "select": "Select",
      "read_today_at": "read today at",

      // Forward modal
      "forward_to": "Forward to...",
      "no_messages_yet": "No messages",

      // File upload
      "attach_file": "Attach file",
      "uploading": "Uploading...",
      "searching": "Searching...",
      "download": "Download",
      "file_too_large": "File too large (max 50MB)",
      "upload_error": "Upload error",

      // Profile panel
      "profile": "Profile",
      "offline": "offline",

      // User profile
      "russian": "Russian",
      "english": "English",

      // Privacy / Anti-profanity
      "content_filter": "Content filter",
      "anti_profanity": "Anti-profanity filter",
      "anti_profanity_on": "Active",
      "anti_profanity_hint": "Replace swear words with asterisks",
      "anti_profanity_desc": "Only you see the filtered version. Messages are not changed for other users.",
      "example": "Example",
    }
  },
  ru: {
    translation: {
      // Search & nav
      "search_placeholder": "Поиск",
      "back": "Назад",
      "cancel": "Отмена",
      "save": "Сохранить",
      "edit": "Изменить",
      "delete": "Удалить",
      "close": "Закрыть",

      // Sidebar menu
      "my_profile": "Мой профиль",
      "saved_messages": "Избранное",
      "settings": "Настройки",
      "night_mode": "Ночной режим",
      "logout": "Выйти",
      "vortex_account": "Аккаунт Vortex",
      "global_search": "Глобальный поиск",

      // Settings screen
      "language": "Язык",
      "notifications": "Уведомления и звуки",
      "privacy": "Конфиденциальность",
      "devices": "Устройства",
      "chat_folders": "Папки чатов",
      "edit_profile": "Редактировать профиль",
      "username_label": "Имя пользователя",
      "bio_label": "О себе",
      "bio_hint": "Любые детали: возраст, профессия, город.",
      "username_hint": "Можно использовать a–z, 0–9 и символ _. Минимум 5 символов.",
      "first_name_label": "Имя (обязательно)",
      "online": "в сети",
      "press_to_change": "Нажмите чтобы изменить",
      "no_bio": "О себе не указано",
      "about": "О себе",
      "joined": "Зарегистрирован",

      // Chat list
      "no_messages": "Нет сообщений",
      "draft": "Черновик",
      "service_notifications": "Системные уведомления",
      "saved_chat_subtitle": "Ваши сохранённые сообщения",

      // Chat window
      "chat": "Чат",
      "today": "Сегодня",
      "yesterday": "Вчера",
      "message_placeholder": "Сообщение",
      "typing": "Печатает",
      "last_seen": "был(а) недавно",
      "last_seen_just_now": "был(а) только что",
      "service_channel_notice": "Это служебный канал — ответить нельзя",
      "editing_message": "Редактирование",

      // Message context menu
      "copy": "Копировать текст",
      "reply": "Ответить",
      "forward": "Переслать",
      "pin": "Закрепить",
      "select": "Выбрать",
      "read_today_at": "прочитано сегодня в",

      // Forward modal
      "forward_to": "Переслать в...",
      "no_messages_yet": "Нет сообщений",

      // File upload
      "attach_file": "Прикрепить файл",
      "uploading": "Загрузка...",
      "searching": "Поиск...",
      "download": "Скачать",
      "file_too_large": "Файл слишком большой (макс. 50МБ)",
      "upload_error": "Ошибка загрузки",

      // Profile panel
      "profile": "Профиль",
      "offline": "не в сети",

      // User profile
      "russian": "Русский",
      "english": "Английский",

      // Privacy / Anti-profanity
      "content_filter": "Фильтр контента",
      "anti_profanity": "Антимат фильтр",
      "anti_profanity_on": "Включён",
      "anti_profanity_hint": "Заменяет маты на звёздочки",
      "anti_profanity_desc": "Фильтрация работает только у вас. Другие пользователи видят сообщения без изменений.",
      "example": "Пример",
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

export default i18n;
