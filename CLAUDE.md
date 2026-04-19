# gor-mobile — инструкции для Claude

Правила, которые нужно соблюдать при работе над этим репо.
При любой правке — пройтись по чеклисту в конце.

## Архитектура (коротко)

3 связанных репо под организацией `gorban-dev`:

| Repo | Назначение |
|------|------------|
| `gor-mobile` (этот) | CLI на bash, wizard, llm dispatcher, templates для `~/.claude/` |
| `gor-mobile-rules-default` | git-pack: `manifest.json` + `rules/*.md` + `examples/<layer>/*.kt` |
| `homebrew-gor-mobile` | tap с `Formula/gor-mobile.rb` — регенерится CI при пуше тега |

Distribution: `brew install gorban-dev/gor-mobile/gor-mobile` → tap → tarball релиза.

## Релиз (критично)

Версия живёт в **двух местах** и должна совпадать:
- `lib/constants.sh` → `GOR_MOBILE_VERSION="X.Y.Z"`
- git-тег `vX.Y.Z`

Процедура релиза:
1. Bump `GOR_MOBILE_VERSION` в `lib/constants.sh`.
2. Обновить `CHANGELOG.md`.
3. Коммит, `git tag vX.Y.Z`, `git push --follow-tags`.
4. `gh release create vX.Y.Z --generate-notes` (или через UI).
5. CI (`release.yml`) автоматически скачивает tarball, считает sha256, пушит formula в tap.

**Не бампать тег без bump константы — wizard покажет старую версию в `gor-mobile version`.**

## Templates (`templates/` → `~/.claude/`)

Файлы из `templates/commands/`, `templates/agents/`, `templates/session-start-hook.sh`
копируются wizard-ом в `~/.claude/`. После правки:
- Пользователю нужно `gor-mobile repair`, чтобы подтянуть изменения.
- Упомянуть в CHANGELOG, что требуется `repair`.
- **Не переименовывать файлы** без миграции в `uninstall.sh` (останется мусор в `~/.claude/`).

## Managed-секции

Маркеры, которые НЕЛЬЗЯ менять/переименовывать — по ним wizard находит свои блоки:
- `<!-- BEGIN gor-mobile managed section -->` / `<!-- END gor-mobile managed section -->` (для `CLAUDE.md`)
- `"_managed_by": "gor-mobile"` (для `settings.json` hook entries)

При смене маркера `uninstall`/`repair` перестанут видеть старые инсталляции.

## Rules pack compatibility

В `gor-mobile-rules-default/manifest.json`:
- `version` — SemVer pack-а.
- `compatible_with` — диапазон версий CLI, которые понимают этот pack.

Breaking changes (удаление section, переименование ключей в `sections`,
изменение формы `core.md`) → **bump major** + обновить `compatible_with`.
CLI при `rules update` проверяет совместимость.

## Команды CLI и slash-commands

При добавлении новой команды CLI (`lib/commands/foo.sh`):
1. Зарегистрировать в `bin/gor-mobile` (dispatcher).
2. Добавить в `gor-mobile help` (в `lib/commands/help.sh` если есть, иначе inline).
3. Обновить секцию "Commands" в `README.md`.
4. Добавить bats-тест в `tests/`.

При добавлении нового slash-command (`templates/commands/foo.md`):
1. Жёсткая формулировка про `gor-mobile llm <role>` если делегируем LLM.
2. Обновить список команд в `README.md` и в `templates/session-start-hook.sh`.
3. Учесть в `uninstall.sh` (чтобы удалялся).

## LLM routing

Меняешь routing в `lib/commands/llm.sh` — синхронно обнови:
- Таблицу routing в `README.md`.
- `templates/session-start-hook.sh` если поведение меняется существенно.
- Тесты в `tests/llm_test.bats`.

## Naming

- Везде `gorban-dev/`, **никогда** `gorban/` (старый неправильный). Если заметил `gorban/` — фиксить.
- CLI-команда: `gor-mobile` (с дефисом).
- Bash-переменные: `GOR_MOBILE_*` (upper-snake).

## Тесты

`bats tests/` должен быть зелёным **перед каждым коммитом**.
Запуск: `brew install bats-core` (одноразово), далее `bats tests/`.

## Stylistic

- Bash: `set -euo pipefail` в каждом script-е, `shellcheck`-clean.
- Не добавлять пустые строки в конец файлов.
- Не добавлять `Co-Authored-By: Claude` в коммиты.
- Комментарии — только когда WHY неочевидно. Код должен говорить сам.

## Чеклист перед коммитом

- [ ] `bats tests/` зелёный
- [ ] Если менял `templates/` — упомянул `gor-mobile repair` в changelog
- [ ] Если менял routing — синхронизировал README + тесты
- [ ] Если релиз — версия в `constants.sh` совпадает с тегом
- [ ] Нигде не всплыл `gorban/` вместо `gorban-dev/`
- [ ] Нет пустых строк в конце файлов
