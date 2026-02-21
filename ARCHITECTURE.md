# Architecture Documentation

## Overview

Questions Ghoul API — это модульный REST API, построенный на Express.js с использованием TypeScript. Архитектура следует принципам разделения ответственности (SoC) и чистого кода.

## Архитектурные слои

```
┌─────────────────────────────────────────────────┐
│         HTTP Layer (Express Routes)             │
│  /api/quiz/random  /api/quiz/answer  /api/...  │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│       Middleware Layer                          │
│  ├─ Authentication (JWT, Temp Token)            │
│  ├─ Rate Limiting (Redis-backed)                │
│  ├─ Request Logging                             │
│  └─ Error Handling                              │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│       Service Layer (Business Logic)            │
│  ├─ questionsDataService (Data Caching)         │
│  ├─ RedisService (Cache & Tokens)               │
│  ├─ Emailer (Email Delivery)                    │
│  └─ SessionService (User Sessions)              │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│       Repository Layer (Data Access)            │
│  ├─ UserRepository                              │
│  └─ Database Queries via Drizzle ORM            │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│     External Services & Storage                 │
│  ├─ PostgreSQL (User Data)                      │
│  ├─ Redis (Tokens, Rate Limits, Cache)          │
│  ├─ File System (data.json)                     │
│  └─ Email Service (SMTP)                        │
└─────────────────────────────────────────────────┘
```

## Компоненты

### 1. HTTP Layer (`src/routers/`)

**Назначение:** Определение API endpoints и маршрутизация

**Файлы:**
- `quiz.ts` — Endpoints для работы с вопросами (`GET /random`, `POST /answer`)
- `auth.ts` — Endpoints аутентификации
- `register.ts` — Регистрация пользователей
- `verify.ts` — Верификация кодов и выдача JWT
- `accessToken.ts` — Выдача временных токенов

**Характеристики:**
- Использует Express Router
- Применяет middleware для валидации и аутентификации
- Возвращает JSON с единым форматом ошибок

### 2. Middleware Layer (`src/middlewares/`)

#### 2.1 Authentication (`auth.ts`)

**Функции:**
- `requireAuth()` — Проверка JWT токена
- `requireTempAuth()` — Проверка временного токена в Redis
- `or()` — Выбор между двумя методами аутентификации (приоритет: временный токен, затем JWT)

**Особенности:**
- JWT валидируется через `jsonwebtoken`
- Временные токены проверяются в Redis
- Поддержка IPv6 для безопасности

#### 2.2 Rate Limiting (`rateLimit.ts`)

**Конфигурация:**
- `apiLimiter` — 150 запросов/15 минут (общий лимит)
- `authLimiter` — 10 попыток/час (по email)
- `codeRequestLimiter` — 3 попытки/час (по email)
- `accessTokenLimiter` — 1 запрос/час (по email)
- `tempTokenQuestionLimiter` — 10 запросов/час (по токену)
- `jwtTokenQuestionLimiter` — 1000 запросов/час (по JWT)

**Реализация:**
- Redis Store для распределённого хранения счётчиков
- Отдельный RedisStore для каждого лимитера (уникальные префиксы)
- `ipKeyGenerator` для безопасного обработки IPv6

#### 2.3 Логирование и Обработка Ошибок

**Request Logger:**
```typescript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`);
  });
  next();
});
```

**Error Handler:**
```typescript
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message });
});
```

### 3. Service Layer (`src/services/`)

#### 3.1 questionsDataService.ts

**Назначение:** Быстрый доступ к вопросам и ответам

**Структура данных:**
```typescript
type Question = {
  id: number;
  question: string;
  answer: string;
  answer_group?: string;
  answer_options: string[];
};
```

**Индексация:**
- `byId: Map<number, Question>` — поиск по ID за O(1)
- `byQuestion: Map<string, Question>` — поиск по вопросу (нормализация текста)
- `answersIndex: Map<string, Question[]>` — поиск по наборам ответов

**API:**
```typescript
getById(id: number): Question | undefined
getByQuestion(question: string): Question | undefined
getRandomQuestion(): Question | undefined
getByAnswers(answers: string[]): Question[]
allQuestions(): Question[]
```

**Оптимизация:**
- In-memory кеширование (загрузка при старте)
- Нормализация текста (lowercase, trim)
- Сортировка ответов для сравнения

#### 3.2 RedisService.ts

**Функции:**
- `setAccessToken(token)` — Сохранить временный токен (TTL: 1 час)
- `getAccessToken(token)` — Получить временный токен
- `setVerificationCode(email, code)` — Сохранить код верификации (TTL: 5 минут)
- `getVerificationCode(email)` — Получить код
- `deleteVerificationCode(email)` — Удалить код после использования

**Особенности:**
- Использует IORedis для управления Redis
- Автоматическое удаление через TTL
- Ключи префиксированы для избежания коллизий

#### 3.3 Emailer.ts

**Функции:**
- `sendCodeToEmail(email, code)` — Отправить код верификации
- Использует Nodemailer для SMTP

#### 3.4 SessionService.ts

**Функции:**
- Управление пользовательскими сессиями
- Интеграция с Redis

### 4. Repository Layer (`src/repositories/`)

#### 4.1 UserRepository.ts

**Функции:**
- `findByEmail(email)` — Поиск пользователя
- `create(email)` — Создание нового пользователя
- Использует Drizzle ORM для типизированных запросов

**Схема:**
```typescript
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique(),
  created_at: timestamp('created_at').defaultNow(),
});
```

### 5. Types (`src/types/`)

**Определение типов:**
- `Question` — тип вопроса
- `User` — тип пользователя
- `AuthPayload` — JWT payload
- Валидационные схемы Zod

### 6. Database Layer (`src/database/`)

**ORM:** Drizzle ORM

**Модели:**
- `users` — таблица пользователей
- `applications` — таблица приложений (опционально)

**Миграции:**
- Управляются через `drizzle-kit`
- Автоматическое создание/обновление схемы

---

## Data Flow

### 1. Получение случайного вопроса (GET /api/quiz/random)

```
Request
   ↓
[Rate Limiter] — проверка лимита
   ↓
[Auth Middleware] — проверка токена (JWT или Temp)
   ↓
[Router Handler]
   ↓
questionsDataService.getRandomQuestion()
   ↓
Response: {id, question, answer_options, answer_group}
```

### 2. Получение ответа (POST /api/quiz/answer)

```
Request {id или question}
   ↓
[Zod Validation] — валидация входа
   ↓
[Rate Limiter] — проверка лимита (1000/час для JWT)
   ↓
[JWT Auth] — только JWT токены
   ↓
[Router Handler]
   ↓
questionsDataService.getById() или getByQuestion()
   ↓
Response: {id, question, answer, answer_group}
```

### 3. Регистрация и верификация

```
POST /api/register {email}
   ↓
[Validation] — проверка email
   ↓
Generate code: 6 цифр
   ↓
[RedisService.setVerificationCode(email, code, TTL: 5min)]
   ↓
[Emailer.sendCodeToEmail(email, code)]
   ↓
Response: "Код отправлен"

---

POST /api/verify-code {email, code}
   ↓
[Validation]
   ↓
[RedisService.getVerificationCode(email)]
   ↓
Compare codes
   ↓
[UserRepository.findByEmail() or create()]
   ↓
[jwt.sign({userId, email}, JWT_SECRET)]
   ↓
Response: {token: JWT}
```

---

## Security Features

### 1. Rate Limiting
- **Redis-backed** — распределённое хранилище счётчиков
- **Per-token или per-email** — различные стратегии для разных endpoint'ов
- **IPv6-safe** — использование `ipKeyGenerator`

### 2. Authentication
- **JWT** — полный доступ, долгоживущие токены (7 дней)
- **Temporary Tokens** — ограниченный доступ, короткоживущие (1 час)
- **Token Validation** — проверка в Redis, подпись JWT

### 3. Input Validation
- **Zod schemas** — типизированная валидация
- **Email validation** — проверка формата
- **Optional fields** — явное определение обязательных полей

### 4. Error Handling
- **Centralized** — единая точка обработки ошибок
- **Safe messages** — не раскрывают внутренние детали
- **HTTP status codes** — правильное использование кодов (400, 401, 429, 500)

---

## Performance Optimizations

### 1. Data Caching
- **In-memory loading** — вопросы загружаются в память при старте
- **O(1) lookups** — использование Map для быстрого поиска

### 2. Redis
- **Token storage** — кеширование временных токенов
- **Rate limiting** — счётчики запросов
- **TTL** — автоматическое удаление устаревших данных

### 3. Database
- **Connection pooling** — через Drizzle ORM
- **Indexed queries** — по email, userId

### 4. HTTP
- **Compression** — gzip через middleware
- **ETag** — для кеширования на клиенте
- **CORS** — оптимизированная конфигурация

---

## Configuration & Environment

**Переменные окружения:**
```env
NODE_ENV=production|development
PORT=3000
JWT_SECRET=<long-random-string>
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
EMAIL_USER=...
EMAIL_PASSWORD=...
```

**Config-файл** (`src/config.ts`):
```typescript
export default {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpires: '7d',
  accessTokenExpires: 3600,
  ...
};
```

---

## Testing Strategy

### 1. Smoke Tests
- Bash-скрипт `tests/smoke_test_quiz.sh`
- Проверка всех основных endpoints

### 2. Unit Tests (рекомендуется добавить)
- `questionsDataService.test.ts`
- `auth.test.ts`
- `validation.test.ts`

### 3. Integration Tests (рекомендуется добавить)
- Full request/response cycles
- Database interactions
- Redis operations

---

## Deployment Architecture

```
┌─────────────────────────────────────┐
│      Load Balancer (Nginx)          │
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌─────────┐      ┌─────────┐
│ API Pod │      │ API Pod │  (Multiple Replicas)
│ (Node)  │      │ (Node)  │
└────┬────┘      └────┬────┘
     │                │
     └────────┬───────┘
              ▼
    ┌──────────────────┐
    │ PostgreSQL       │
    │ (Primary/Backup) │
    └──────────────────┘
              │
              ▼
    ┌──────────────────┐
    │ Redis Cluster    │
    │ (Rate Limits)    │
    └──────────────────┘
```

---

## Future Improvements

1. **OpenAPI/Swagger** — интерактивная документация API
2. **WebSocket** — real-time обновления для multiplayer режима
3. **GraphQL** — альтернативный API
4. **Caching Layer** — Redis для кеширования часто запрашиваемых вопросов
5. **Monitoring** — Prometheus метрики, Sentry для ошибок
6. **CI/CD** — GitHub Actions для автоматического тестирования и деплоя
7. **API Versioning** — v1, v2 endpoints для обратной совместимости

---

## Документация

- [README.md](README.md) — Быстрый старт и API
- [ARCHITECTURE.md](ARCHITECTURE.md) — Этот документ
- Код содержит JSDoc комментарии для основных функций

