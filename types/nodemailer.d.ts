// Локальное объявление модуля: типы nodemailer не нужны для сборки.
// Render режет devDependencies на билде, поэтому @types/nodemailer там может
// отсутствовать. Это объявление делает импорт `any` и не ломает tsc.
declare module "nodemailer"
