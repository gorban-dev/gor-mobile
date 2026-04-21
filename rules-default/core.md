# Android Core Rules (gor-mobile fallback)

Minimal fallback used when no external rules pack is available. Replace by:

```sh
gor-mobile rules use <your-pack-url>
```

## Screen/View separation
- Screen = thin adapter (viewState + eventHandler → View). No logic, no remember.
- View  = pure UI. UI state (`rememberPagerState`, `rememberScrollState`) only here.

## ViewModel
- Extends `BaseSharedViewModel<State, Action, Event>`. No Compose imports.
- `updateState { it.copy(...) }`, `sendAction(...)`.

## UseCase
- `{Feature}{Action}UseCase.kt`, extends `UseCase<Params, Result>`.
- `suspend fun execute(params): Result<T>`. NOT operator fun.

## Repository
- `I{Feature}Repository` interface + `{Feature}Repository` impl.

## Files
- One class per file. No god-files.

## Theme
- `{App}Theme.colors.*`, `{App}Theme.typography.*`.
- Never `MaterialTheme.colorScheme` or hardcoded `Color(0xFF...)`.

## Prohibited
- Compose in ViewModel
- Business logic in View
- `remember`/side-effects in Screen
- `operator fun invoke` in UseCase
