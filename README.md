# Sweet Santa Bot — Telegram Mini App

Коротко: Telegram Mini App для проведения игры «Тайный Санта». Пользователи создают игры, приглашают друзей по ссылке, настраивают стоп‑листы и запускают жеребьевку. После старта каждый видит своего подопечного под спойлером; оффлайн‑игроки доступны создателю игры в отдельном интерфейсе.

## Технологии
- Next.js (App Router), монолит с Server Actions
- PostgreSQL + Prisma ORM
- UI: shadcn/ui + Tailwind CSS
- Telegram WebApp SDK (@twa-dev/sdk)
- Валидация initData Telegram на сервере

## Как это работает
- Создание игры и приглашение по уникальному invite‑коду.
- Участники: онлайн (Telegram пользователи) и оффлайн (без Telegram).
- Стоп‑листы: запрет «КТО не дарит КОМУ», поддержка взаимного исключения.
- Жеребьевка: поиск перестановки с учётом стоп‑листов, сохранение результата в БД, статус игры меняется на STARTED.
- Просмотр результатов: у каждого участника — спойлер; у создателя — просмотр результатов оффлайн‑игроков.

Ключевые места в коде:
- Провайдер Telegram: [telegram-provider.tsx](src/components/providers/telegram-provider.tsx)
- Авторизация и создание пользователя: [auth.ts](src/app/actions/auth.ts)
- Валидация initData: [telegram-auth.ts](src/lib/telegram-auth.ts)
- Prisma клиент/подключение: [prisma.ts](src/lib/prisma.ts), схема БД: [schema.prisma](prisma/schema.prisma)

## Быстрый старт (локально)
Требования: Node.js 20+, PostgreSQL, npm.

1. Установка зависимостей
   ```bash
   npm ci
   # или
   npm install
   ```
2. Настройка окружения (.env)
   ```bash
   # строка подключения к PostgreSQL
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sweet_santa?schema=public"
   # токен(ы) бота для проверки initData (можно через запятую)
   TELEGRAM_BOT_TOKEN="123456:ABC-DEF..." 
   TELEGRAM_BOT_TOKENS="123456:ABC-DEF...,654321:XYZ-..."
   # режим разработки без Telegram (опционально)
   ALLOW_DEV_NO_TELEGRAM_AUTH="true"
   ```
3. Генерация клиента Prisma и миграции
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```
4. Запуск dev‑сервера
   ```bash
   npm run dev
   ```
   Открыть http://localhost:3000

## Основные команды
- Запуск в разработке: `npm run dev`
- Сборка: `npm run build`
- Продакшн‑старт: `npm run start`
- Линт: `npm run lint`

## Docker
В репозитории есть Dockerfile. Сборка и запуск:
```bash
docker build -t sweet-santa .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public" \
  -e TELEGRAM_BOT_TOKEN="123456:ABC-DEF..." \
  sweet-santa
```
Контейнер на старте применяет миграции (`npx prisma migrate deploy`) и запускает сервер на порту 3000.

## Настройка Telegram Mini App
- Создать/настроить бота в BotFather.
- Установить Menu Button → Web App, указать URL деплоя.
- Для инвайтов используется `start_param` в `initDataUnsafe` (deeplink `tg://resolve...startapp=...`).

## Структура проекта
- `src/app` — маршруты и Server Actions (Next.js App Router)
- `src/components` — UI‑компоненты (shadcn/ui)
- `prisma/schema.prisma` — схема БД и миграции
- `src/lib` — утилиты (авторизация Telegram, Prisma клиент)

Если нужны подробности по логике, см. [DOCS.MD](DOCS.MD) и [PLAN.md](PLAN.md).
