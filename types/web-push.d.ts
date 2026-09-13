// Локальное объявление модуля: типы web-push не нужны для сборки.
// Render режет devDependencies на билде, поэтому @types/web-push там может
// отсутствовать. Это объявление делает импорт `any` и не ломает tsc.
declare module "web-push"
