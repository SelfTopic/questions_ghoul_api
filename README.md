# Questions Ghoul API

REST API с базой вопросов викторины по аниме «Tokyo Ghoul». Гости получают случайные вопросы с вариантами ответа, зарегистрированные пользователи — ещё и правильные ответы.

Стек: Node.js 24, TypeScript, Express 5, PostgreSQL (Drizzle ORM), Redis (ioredis), Zod, JWT, Nodemailer.

## Быстрый старт

Файл вопросов (`assets/data/processed/data.json`) **не хранится в репозитории и не попадает в Docker-образ**. Положите его локально — в compose он монтируется в контейнер только для чтения.

```bash
cp .env.example .env   # заполнить JWT_SECRET, пароли, почту
```

### Production (Docker)

```bash
docker compose up -d --build
```

Поднимаются `postgres`, `redis` (с паролем, наружу не открыт), одноразовый `migrate` и `api` на порту `API_PORT` (по умолчанию 3300). Если перед API стоит reverse proxy, задайте `TRUST_PROXY` — иначе лимиты по IP будут считаться по адресу прокси.

### Разработка

```bash
# всё в Docker, с hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# или локально (Postgres и Redis уже запущены, URL в .env)
pnpm install
pnpm db:migrate
pnpm dev
```

Для разработки без почты: `EMAIL_TRANSPORT=log` — код подтверждения пишется в консоль (в production запрещено).

## Конфигурация

Все переменные описаны в [.env.example](.env.example). Они проверяются при старте ([src/config.ts](src/config.ts)); при ошибке сервер не запускается и пишет, что не так.

## API

Все ошибки имеют формат `{ "error": "текст", "details"?: {...} }`. Лимиты отдаются в заголовках `RateLimit` / `RateLimit-Policy`; при превышении — `429`.

### Гостевой доступ

`GET /api/access_token` → `{ "accessToken": "<uuid>", "expiresIn": 3600 }`

Токен передаётся в заголовке `X-Temporary-Token`. Живёт 1 час, даёт 10 вопросов в час, к ответам доступа нет.

### Регистрация / вход

1. `POST /api/register` `{ "email": "user@example.com" }` — отправляет 6-значный код (живёт 5 минут, повторная отправка — не чаще раза в минуту).
2. `POST /api/verify-code` `{ "email": "...", "code": "572286" }` → пара токенов:

```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "q3Z...",
  "tokenType": "Bearer",
  "expiresIn": 604800,
  "refreshExpiresIn": 2592000
}
```

На один код — 5 попыток, потом он сгорает. Пользователь создаётся при первом входе.

### Токены

- **Access** (JWT, `Authorization: Bearer <token>`) — 7 дней.
- **Refresh** (непрозрачная строка) — 30 дней, продлевается при каждом обновлении. Пока клиент заходит хотя бы раз в месяц, повторный вход по почте не нужен.

| Метод | Путь | Тело / заголовки | Ответ |
|---|---|---|---|
| POST | `/api/auth/refresh` | `{ "refreshToken": "..." }` | новая пара токенов |
| POST | `/api/auth/logout` | `{ "refreshToken": "..." }` | `204`, завершает эту сессию |
| POST | `/api/auth/logout-all` | `Authorization: Bearer` | `204`, завершает все сессии пользователя |

**Важно для клиента.** Refresh-токен одноразовый: после обновления старый недействителен. Повторное предъявление уже использованного токена считается утечкой — вся сессия отзывается (и refresh, и выданные в ней access-токены), нужен новый вход по почте. Поэтому клиент должен сохранять новую пару сразу и не запускать несколько обновлений параллельно.

### Викторина

`GET /api/quiz/random` — пользователь или гость (ровно один из заголовков; оба сразу → `400`). Вариантов ответа от 2 до 10 — число не фиксировано:

```json
{ "id": 158, "question": "...", "answer_options": ["...", "..."], "answer_group": "name" }
```

`POST /api/quiz/answer` — только пользователь. Тело `{ "id": 5 }` или `{ "question": "текст вопроса" }` (поиск не чувствителен к регистру, «ё/е», пунктуации и пробелам):

```json
{ "id": 5, "question": "...", "answer": "...", "answer_group": "name", "answerMedia": null }
```

`answerMedia` — иллюстрация к правильному ответу (`{ "url": "...", "kind": "image" }`), если для вопроса она есть; иначе всегда `null` (поле присутствует в любом случае, не только когда есть фото).

#### «Кто это?»

Отдельный режим: вопрос — фото, а не текст. Опционален — если файл `WHOIS_PATH` не настроен, эндпоинты отдают `404`.

`GET /api/quiz/whois/random` — пользователь или гость:

```json
{ "id": 12, "promptMedia": { "url": "...", "kind": "image" }, "answer_options": ["...", "..."] }
```

`POST /api/quiz/whois/answer` — только пользователь. Тело `{ "id": 12 }` (текста вопроса здесь нет, искать по нему нельзя):

```json
{ "id": 12, "answer": "..." }
```

### Служебное

`GET /api/health` → `200 { "ok": true }` или `503`, если недоступны Redis или Postgres.

### Лимиты

| Что | Лимит | Ключ |
|---|---|---|
| Любой запрос к `/api` | 120 / мин | IP |
| Гостевой токен | 1 / час | IP |
| Регистрация | 10 / час и 5 / час | IP и email |
| Проверка кода | 30 / час | IP |
| Refresh / logout | 60 / час | IP |
| Вопросы и ответы, гость | 10 / час | гостевой токен |
| Вопросы и ответы, пользователь | 1000 / час | id пользователя |

Значения задаются в [src/config.ts](src/config.ts).

## Скрипты

```bash
pnpm dev            # ts-node + nodemon
pnpm build          # компиляция в dist/
pnpm start          # запуск dist/
pnpm migrate        # применить миграции (из dist/, для production)
pnpm typecheck | lint | prettier

pnpm db:generate    # создать миграцию после изменения схемы
pnpm db:migrate     # применить миграции (drizzle-kit, для разработки)

pnpm test           # unit-тесты, без внешних сервисов (Redis/БД замоканы)

pnpm test:env:up        # поднять тестовые Postgres/Redis в Docker
pnpm test:integration   # интеграционные тесты (vitest + supertest)
pnpm test:env:down
./tests/smoke_test_quiz.sh http://localhost:3300
```

## License

MIT — см. [LICENSE.md](LICENSE.md). Автор — CheStor.
