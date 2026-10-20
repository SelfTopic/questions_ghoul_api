# Тестирование и деплой

Проблема: на локальной машине CheStor нестабильный интернет — ни `docker build`,
ни `docker pull`, ни тем более прогон интеграционных тестов с поднятием
контейнеров делать там не стоит (см. память `no-local-builds`). Решение —
взять уже проверенную схему из `~/chestor_bot` и адаптировать её под этот
репозиторий: тестирование уходит в CI (у GitHub Actions всегда хороший
интернет), а на реальный сервер код сам подтягивается тестовым стендом —
никаких docker-команд руками на своей машине.

## CI (`.github/workflows/ci.yml`)

На каждый push и PR, аналогично `chestor_bot`:

- **`checks`** — `pnpm install`, `typecheck`, `lint`, `prettier`, `pnpm test`
  (юнит, без докера), затем `pnpm test:env:up` (поднимает postgres/redis из
  `docker-compose.test.yml` на фиксированных портах 55432/56379 — ровно то,
  что ждёт `vitest.config.mts`) и `pnpm test:integration`.
- **`image`** — отдельная проверка, что Docker-образ вообще собирается
  (`docker/build-push-action`, `push: false`, кэш через `type=gha`), плюс
  минимальная проверка, что `dist/index.js` в образе есть и `node` в нём
  запускается. Образ никуда не публикуется — собирать его для стенда/прода
  будет сам сервер при деплое, из исходников.

## Тестовый стенд (`deploy/stand/`)

Копия механизма `chestor_bot` (см. `~/chestor_bot/docs/dev/stand.md`), только
без своего бота — файлы: `deploy.sh`, `ghoul-stand.service`,
`ghoul-stand.timer`, `ghoul-stand.env.example`.

Как это работает: на сервере таймер systemd раз в минуту запускает
`deploy.sh`. Скрипт делает `git fetch`, берёт ветку с самым свежим коммитом и
смотрит check runs этого коммита на GitHub:

- CI ещё идёт — ждёт следующей минуты;
- CI красный — пишет в Telegram «❌ CI красный» и больше не трогает этот коммит;
- CI зелёный — `git checkout` коммита в папке стенда и
  `docker compose -p ghoul_test up -d --build --remove-orphans api` (postgres,
  redis и `migrate` поднимутся сами через `depends_on` в `docker-compose.yml`),
  затем уведомление «✅ На стенде <ветка>» или «❌ Стенд не поднялся» с
  последними строками лога сборки.

**Сервер сам забирает обновления — у GitHub нет ключей от сервера**, никаких
SSH-секретов в GitHub Actions заводить не нужно.

### Отличия от `chestor_bot`

- **Уведомления**: у `chestor_bot` скрипт брал `BOT_TOKEN` из `.env` самого
  бота (это и есть его токен). У `questions_ghoul_api` своего бота нет, поэтому
  `BOT_TOKEN` теперь настраивается прямо в `/etc/ghoul-stand.env` — можно
  вписать туда токен `chestor_bot` (или его тестовой копии) просто как канал
  уведомлений, без привязки деплоя одного проекта к файлам другого.
- **Секретные данные**: как и в проде, папке стенда нужен свой
  `assets/data/processed/data.json` — положить руками один раз, `git checkout
  --force` его не трогает (он в `.gitignore`).
- **Порты**: стенд и прод на одном сервере — разные `docker compose`-проекты
  (`ghoul_test` / дефолтный) со своими `.env` (`API_PORT` и т.п.), как и у
  `chestor_bot`.

### Установка на сервере (аналогично `chestor_bot`, один раз)

```sh
git clone https://github.com/SelfTopic/questions_ghoul_api.git /root/ghoul_test
cp /путь/к/.env.стенда /root/ghoul_test/.env
cp /путь/к/data.json /root/ghoul_test/assets/data/processed/data.json

cd /root/ghoul_test
install -m 755 deploy/stand/deploy.sh /usr/local/bin/ghoul-stand-deploy
install -m 644 deploy/stand/ghoul-stand.service deploy/stand/ghoul-stand.timer /etc/systemd/system/
install -m 600 deploy/stand/ghoul-stand.env.example /etc/ghoul-stand.env
nano /etc/ghoul-stand.env   # STAND_DIR, NOTIFY_CHAT_ID, BOT_TOKEN
systemctl daemon-reload
systemctl enable --now ghoul-stand.timer
```

## Прод

Остаётся ручным, как сейчас (`docker compose up -d --build`) — автодеплоя для
прода нет и у `chestor_bot`. Логика та же: стенд — для быстрой проверки,
прод — осознанное действие после того, как стенд подтвердил, что всё работает.
