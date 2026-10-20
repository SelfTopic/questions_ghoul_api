# Architecture

## Структура

```
src/
├── index.ts              # старт: загрузка вопросов, listen, graceful shutdown, очистка просроченных токенов
├── app.ts                # express: helmet, cors, лимиты, роутеры, 404, обработчик ошибок, /api/health
├── config.ts             # dotenv + проверка env через zod; все настройки и лимиты
├── migrate.ts            # применение миграций в production (node dist/migrate.js)
├── errors.ts             # HttpError — единственный способ вернуть клиенту 4xx/5xx с текстом
├── validation.ts         # parseBody (zod → 400 с details), схема email
├── types/                # req.auth
├── database/             # пул pg, drizzle, модели users и refresh_tokens
├── repositories/user.ts
├── middlewares/
│   ├── auth.ts           # authenticate(): определяет вызывающего, пишет req.auth
│   └── rateLimit.ts      # все лимитеры, общий Redis store
├── routers/api/          # accessToken, register, verify, auth (refresh/logout), quiz, whois
└── services/
    ├── questionsDataService.ts  # вопросы в памяти, индексы по id / тексту / вариантам
    ├── whoisDataService.ts      # "кто это?" (медиа-вопросы) — опционален, нет файла — режим отключён
    ├── tokenService.ts          # JWT, refresh-токены, гостевые токены, отзыв сессий
    ├── verificationService.ts   # коды подтверждения в Redis
    ├── emailer.ts
    └── redis.ts                 # единственный клиент Redis
drizzle/                  # SQL-миграции (drizzle-kit generate)
tests/                    # интеграционные тесты, фикстуры, smoke-тест
```

## Хранилища

- **Файл вопросов** — читается один раз при старте. Нет файла или он некорректен — процесс завершается с ошибкой.
- **Файл "кто это"** — тоже читается один раз при старте, но опционален: нет файла — режим просто отключён (эндпоинты отдают `404`); файл есть, но некорректен — так же, как с основными вопросами, процесс завершается с ошибкой.
- **PostgreSQL** — `users`, `refresh_tokens`.
- **Redis** — гостевые токены (`a_token:*`), коды подтверждения (`v_code:*`, hash `{code, attempts}`), кулдаун отправки (`v_cooldown:*`), отозванные сессии (`revoked_sid:*`), счётчики лимитов (`rl:*`).

## Аутентификация

`authenticate({ allowGuest })` принимает ровно один способ:

- `Authorization: Bearer <jwt>` → проверка подписи (только HS256), `iss`, `aud`, `type: 'access'`, затем проверка, что сессия `sid` не отозвана → `req.auth = { type: 'user', userId, sessionId }`.
- `X-Temporary-Token: <uuid>` (если `allowGuest`) → ключ есть в Redis → `req.auth = { type: 'guest', token }`.

Оба заголовка сразу — `400`.

### Сессии и refresh-токены

Вход (`/api/verify-code`) создаёт **сессию** — семейство refresh-токенов с общим `family_id`. Этот же id лежит в access-токене как `sid`.

- Refresh-токен — 32 случайных байта; в БД хранится только sha256.
- `rotate`: в транзакции с `SELECT ... FOR UPDATE` находит токен, помечает его отозванным (`replaced_by` → новый) и выдаёт новую пару с `expires_at = now + 30 дней`.
- Предъявлен уже отозванный токен → отзывается всё семейство, `sid` пишется в `revoked_sid:*`.
- Access-токен живёт 7 дней и сам по себе не отзывается, поэтому при logout / logout-all / обнаружении повторного использования `sid` помечается в Redis на 7 дней, и `authenticate` отклоняет такие токены.

## Лимиты

Порядок для каждого запроса: общий лимит по IP → (для викторины) аутентификация → лимит по проверенному субъекту (`user:<id>` или `guest:<token>`). Ключ никогда не берётся из непроверенных заголовков. Вопросы и ответы пользователя делят один счётчик.

## Ошибки

Обработчики бросают `HttpError`; express 5 сам передаёт исключения из async-обработчиков в общий обработчик. Клиент видит текст только у `HttpError` и у 4xx-ошибок body-parser; всё остальное — `500 Внутренняя ошибка сервера` и полный стек в логах.

## Деплой

`docker-compose.yml` — production: многоступенчатый образ `node:24-alpine`, только prod-зависимости, пользователь `node`. Сервис `migrate` применяет миграции до старта `api`. Вопросы монтируются из `./assets/data` read-only. Postgres и Redis наружу не публикуются, у Redis пароль.

`docker-compose.dev.yml` — поверх production-файла: dev-стадия образа, bind mount исходников, nodemon, порты БД на 127.0.0.1.

Тестовый стенд обновляется автоматически (CI + systemd-таймер на сервере сам подтягивает последнюю зелёную ветку), прод — вручную. Подробности: [docs/deployment.md](docs/deployment.md).
