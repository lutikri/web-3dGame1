# OperatorGame

Браузерная first-person игра об операторе промышленной установки термоядерного ядра. Игрок не строит реактор и не управляет заводом: он проводит смену за физическим пультом, удерживая систему в рабочем диапазоне под растущей нагрузкой.

## Короткий дизайн-док

### Фантазия игрока

Игрок — не герой и не инженер с всеведущим интерфейсом, а сменный оператор старого тяжёлого оборудования. Информация приходит через стрелочные приборы, лампы, небольшие экраны, звук и поведение помещения. Ошибка должна сначала ощущаться как симптом, а уже затем пониматься как причина.

### Основной цикл

1. Получить краткий shift brief.
2. Осмотреть панель и состояние помещения.
3. Подготовить магнитное поле и выполнить зажигание плазмы.
4. Балансировать `Fuel Injection`, `Magnetic Field` и `Coolant Flow`.
5. Следовать меняющемуся `Grid Demand`, не перегревая ядро.
6. Пережить неисправности или применить аварийный `Vent/Purge`.
7. Получить отчёт смены и профиль поведения оператора.

### Главные принципы

- Управление причинное, а не аркадное: игрок меняет реальные входы системы, а не нажимает кнопку «починить».
- Высокая температура не всегда является ошибкой. Финальная нагрузка намеренно требует работы рядом с опасной зоной.
- Состояние читается не только по цифрам: важны стрелки, свет, звук, flicker, blackout и реакция помещения.
- Интерфейс является частью мира. Обычный HUD используется минимально.
- Неисправности должны создавать диагностическую задачу, а не случайно отнимать здоровье.
- Интерактивные объекты и поведение повторно используются как prefabs между уровнями.

### Размещение prefab-объектов

Prefab можно разместить вручную в конфиге уровня или Empty-маркером внутри environment GLB:

```text
PF_fluorescentLamp_PowerHall1
PF_redBulkLamp_PowerHall1
PF_bulkheadDoor_C
```

Формат имени — `PF_<prefabType>_<instanceName>`, где `prefabType` зарегистрирован в `PrefabRegistry`. Transform берётся из Blender, а runtime-имя включает тип, например `fluorescentLamp_PowerHall1`. Ручной prefab с таким же стабильным именем имеет приоритет. Настройки marker-prefab, сохранённые через `SAVE LEVEL`, применяются после обнаружения marker-а при следующей загрузке.

### Текущие уровни

- `intro-shift` — маленькая быстро загружаемая операторская, обучение базовой смене.
- `exploring-around` — операторская и сервисный коридор; основа для исследования оборудования и дополнительных контролов.
- `freeplay` — использует окружение `intro-shift`, но запускает другой режим сессии.

### Направления механик

- Сервисный коридор: насосы, электрика, охлаждение и локальные панели.
- Неисправности приборов: показания могут расходиться с физическими симптомами.
- Качество и подача топлива.
- Локальное отключение питания и последовательное восстановление оборудования.
- Физические предметы и препятствия, которые взаимодействуют с player collision.
- Причинно связанные звук, вибрация, свет и состояние ядра.

## Архитектура

### Уровни

`src/levels/LevelRegistry.js` — единая точка регистрации metadata и runtime environment.

Каждый level environment описывает:

- architecture и collision GLB;
- player spawn;
- fog и ambient lighting;
- собственные point lights;
- список prefab instances;
- встроенные environment behaviors, например вентиляторы.

В runtime существует только одно окружение. При переходе старый `LevelRuntime` полностью освобождает scene objects, lights, interactions и Rapier world. Исходные GLB могут оставаться в общем `AssetCache`.

### Prefabs

`src/prefabs/PrefabRegistry.js` хранит общие assets, materials, interaction, physics и behavior defaults.

Level config может задавать только instance-owned данные:

- уникальное имя;
- position/rotation/scale;
- startup state;
- light tuning и явно разрешённые параметры экземпляра.

Алгоритм двери, fluorescent flicker или physics нельзя копировать в level config.

### Runtime modules

- `src/runtime/LevelRuntimeManager.js` — атомарные переходы, latest request wins.
- `src/runtime/LevelRuntime.js` — единый idempotent `dispose()`.
- `src/runtime/AssetCache.js` — кэш source assets и повторные instances.
- `src/runtime/RuntimeSmoke.js` — автоматическая проверка переходов.
- `src/scene/LevelSceneBuilder.js` — architecture, collision и prefab instances.
- `src/lighting/LightingRuntime.js` — level-owned ambient и point lights.
- `src/interactions/DoorInteractionSystem.js` — общее физическое управление дверями.
- `src/player/PlayerController.js` — runtime-граница движения и player collision.
- `src/postprocessing/PostProcessingRuntime.js` — lifecycle post-processing pipeline.
- `src/panels/OperatorPanelRuntime.js` — lifecycle и видимость операторской панели.
- `src/levels/LevelSession.js` — objectives, bindings, events и checkpoint текущей смены.
- `src/physics/PhysicsSystem.js` — Rapier character, static collision и физические двери.

`Panel1` не является обязательным: уровень без prefab с behavior `operatorPanel` загружает только своё окружение и скрывает общую панель.

Level-specific логика описывается через `session.objectives` и `session.bindings`. Tutorial сейчас требует провести 180 секунд активной смены и открыть свою гермодверь; встроенная кнопка комнаты переключает конкретный prefab светильника. Уникальные будущие механики должны подписываться на события `LevelSession`, не обращаться напрямую к глобалам `OperatorGame`.

### Конфиги

Level configs имеют `schemaVersion`, проходят validation и migration. Generated overrides лежат в `src/generated/` и сохраняют только instance-owned prefab fields.

Debug `SAVE LEVEL` сохраняет активное окружение и глобальную настройку материалов.

## Разработка

Установка и запуск:

```text
npm install
npm run dev
```

Открыть `http://localhost:5173/`.

Быстрая проверка без браузера:

```text
npm run check
```

Автоматический runtime smoke без ручных кликов:

```text
http://localhost:5173/?runtimeSmoke=1
```

Ожидаемый результат в консоли: `[RuntimeSmoke] PASS`.

Ручная проверка нужна для субъективных вещей: ощущения двери, качества flicker, света, collision comfort и presentation timing.

## Runtime assets

- `src/` — browser runtime code.
- `styles/` — UI и HUD styling.
- `assets/` — GLB, compressed textures, briefings и runtime images.
- `asset-source/` и `3dGameAssetsDev/` — исходники арта и текстур.
- `src/generated/` — настройки, сохранённые локальной debug-панелью.

После изменения runtime texture sources запустить:

```text
generate-runtime-textures.bat
```

Preview и full KTX2 записываются в `assets/runtime-textures/`.

## Ближайший технический roadmap

1. Вынести создание architecture/collision/prefabs из `OperatorGame.js` в `LevelSceneBuilder`.
2. Перенести реализацию prefab behaviors в отдельный behavior registry.
3. Выделить `LightingRuntime`, `PlayerController`, `DoorInteractionSystem` и `PostProcessingRuntime`.
4. Добавить reference counting и ограничение памяти в `AssetCache`.
5. Удалить оставшиеся default-environment fallback state из `OperatorGame.js`.
