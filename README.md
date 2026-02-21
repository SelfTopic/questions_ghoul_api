# Questions Ghoul API

Высокопроизводительный REST API для быстрого доступа к базе вопросов и ответов из аниме "Tokyo Ghoul". API предоставляет эндпоинты для получения случайных вопросов, поиска ответов и управления доступом через JWT и временные токены.

## Особенности

- 🚀 **Быстрый доступ к данным** — in-memory кеширование вопросов с индексацией по ID и вопросу
- 🔐 **Двухуровневая аутентификация** — JWT токены для полного доступа и временные токены для гостей
- ⏱️ **Rate Limiting** — отдельные лимиты для временных (10/ч) и JWT токенов (1000/ч), на основе Redis
- ✅ **Валидация входа** — использование `zod` для типизированной валидации
- 📊 **Централизованная обработка ошибок** — единый формат ошибок и логирование
- 🐳 **Docker Ready** — полная поддержка контейнеризации

## Требования

- Node.js >= 18
- Docker & Docker Compose (опционально)
- Redis (для rate-limiting)
- PostgreSQL (для хранения пользователей)

## Быстрый старт

### Локальная установка

```bash
# Клонировать репозиторий
git clone <repo-url>
cd questions_ghoul_api

# Установить зависимости
pnpm install

# Создать .env файл (см. раздел Configuration)
cp .env.example .env

# Запустить миграции БД
pnpm run db:push

# Запустить в режиме разработки
pnpm run dev
```

### Docker

```bash
# Запустить всё через Docker Compose
docker-compose up

# API будет доступен на http://localhost:3000
```

## Configuration

Создайте файл `.env` в корне проекта:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/questions_ghoul

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-change-in-production

# Email (для отправки кодов верификации)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_SERVICE=gmail
```

## API Документация

### Аутентификация

#### 1. Получить временный токен
```bash
GET /api/access_token
```
**Ответ (200 OK):**
```json
{
  "accessToken": "664e9678-eb63-4bde-b23c-37ddf2d686a4",
  "expires_in": 3600
}
```
**Rate Limit:** 1 запрос/час (по email или IP)

---

#### 2. Регистрация (отправить код на почту)
```bash
POST /api/register
Content-Type: application/json

{
  "email": "user@example.com"
}
```
**Ответ (200 OK):**
```json
{
  "message": "Код отправлен, проверьте свою почту и закончите регистрацию."
}
```
**Rate Limit:** 10 запросов/час

---

#### 3. Верификация кода и получение JWT
```bash
POST /api/verify-code
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "572286"
}
```
**Ответ (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
**Rate Limit:** 3 попытки/час

---

### Quiz Endpoints

#### 4. Получить случайный вопрос
```bash
GET /api/quiz/random
Authorization: Bearer <JWT_TOKEN>
# или
X-Temporary-Token: <TEMP_TOKEN>
```
**Ответ (200 OK):**
```json
{
  "id": 158,
  "question": "Кто в результате побега изуродавал Токаге Гомаса?",
  "answer_options": [
    "Ямори",
    "Канеки",
    "Аято",
    "Наки"
  ],
  "answer_group": "name"
}
```
**Rate Limit:**
- Временный токен: 10 запросов/час
- JWT: 1000 запросов/час

---

#### 5. Получить ответ на вопрос
```bash
POST /api/quiz/answer
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "id": 5
}
```
**или по вопросу:**
```json
{
  "question": "Как звали кошку Акиры Мадо?"
}
```

**Ответ (200 OK):**
```json
{
  "id": 5,
  "question": "Кто владел куинке, изготовленным из какухо Арата Киришимы?",
  "answer": "Юкинори Синохара, Ивао Куроива, Котаро Амон, Ханби Абара и Джузо Судзуя",
  "answer_group": "name"
}
```
**Rate Limit:** 1000 запросов/час (только JWT)

---

## Обработка ошибок

### 400 Bad Request
```json
{
  "error": "Неверные входные данные",
  "details": {
    "id": ["Expected number"],
    "question": ["Expected string"]
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Токен отсутствует или имеет неверный формат. Используйте заголовок: Authorization: Bearer <token>"
}
```

### 404 Not Found
```json
{
  "error": "Вопрос не найден"
}
```

### 429 Too Many Requests
```json
{
  "error": "Слишком много запросов. Попробуйте позже."
}
```

---

## Структура проекта

```
src/
├── app.ts                 # Express приложение
├── index.ts               # Entry point
├── config.ts              # Конфигурация
├── database/              # Drizzle ORM
├── middlewares/           # Express middleware (auth, rate-limit)
├── routers/               # API routers
│   └── api/
│       ├── quiz.ts        # Endpoints для вопросов
│       ├── auth.ts        # Endpoints аутентификации
│       ├── register.ts    # Регистрация
│       └── verify.ts      # Верификация
├── services/              # Business logic
│   ├── questionsDataService.ts  # Кеширование и индексация вопросов
│   ├── redis.ts           # Redis операции
│   ├── sessionService.ts  # Управление сессиями
│   └── emailer.ts         # Отправка писем
├── repositories/          # Database queries
├── types/                 # TypeScript типы
└── assets/
    └── data/
        └── processed/
            └── data.json  # База вопросов и ответов

tests/
└── smoke_test_quiz.sh     # Smoke-тесты всех endpoints
```

---

## Разработка

### Доступные команды

```bash
# Разработка
pnpm run dev          # Запустить с hot-reload (ts-node + nodemon)

# Сборка
pnpm run build        # Скомпилировать TypeScript

# Production
pnpm run start        # Запустить скомпилированный код

# Очистка
pnpm run clean        # Удалить dist/

# Lint & Format
pnpm run lint         # Проверить код (ESLint)
pnpm run lint:fix     # Исправить ошибки (ESLint)
pnpm run prettier     # Проверить форматирование
pnpm run prettier:fix # Отформатировать код

# База данных
pnpm run db:push      # Применить миграции
pnpm run db:generate  # Генерировать миграции
pnpm run db:migrate   # Запустить миграции
pnpm run db:studio    # Открыть Drizzle Studio
```

---

## Тестирование

### Smoke-тесты

```bash
chmod +x tests/smoke_test_quiz.sh
./tests/smoke_test_quiz.sh
```

### Вручную через curl

```bash
# Получить временный токен
curl http://localhost:3000/api/access_token

# Получить случайный вопрос
curl -H "X-Temporary-Token: <token>" http://localhost:3000/api/quiz/random

# Получить ответ (требует JWT)
curl -X POST -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"id": 1}' \
  http://localhost:3000/api/quiz/answer
```

---

## Production Deployment

### Docker

```bash
# Собрать image
docker build -t questions-ghoul-api:latest .

# Запустить контейнер
docker run -p 3000:3000 --env-file .env questions-ghoul-api:latest
```

### Environment Variables для Production

```env
NODE_ENV=production
JWT_SECRET=<long-random-secret>
DATABASE_URL=<production-db-url>
REDIS_URL=<production-redis-url>
```

### Рекомендации

- Использовать HTTPS/TLS на production
- Хранить секреты в менеджере (Vault, AWS Secrets Manager)
- Настроить мониторинг (Sentry, Prometheus)
- Использовать reverse proxy (Nginx)
- Включить логирование и аудит

---

## License

MIT — см. [LICENSE.md](LICENSE.md)

---

## Автор

CheStor

---

## Поддержка

Для вопросов и багов откройте issue в репозитории.
