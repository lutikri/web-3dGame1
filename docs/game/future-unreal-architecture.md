# OperatorGame — Game Architecture

> Status: older high-level design draft for a possible Unreal/future version. It is not the current browser project code map. For current code ownership use `../project-structure.md`; for current design priority use `README.md` in this directory.
>
> Current lore direction: the first run is `Elevator Arrival -> Facility Entrance -> Control Booth Tutorial -> Shift Report -> assigned shifts`. Shift 1/2/3/4 notes below are still useful mechanically, but should be interpreted as assigned facility shifts rather than disconnected prototype levels.

Working architecture draft for the Unreal version of **OperatorGame / Fusion Core Operator**.

The goal of this document is to keep the project from turning into one giant `BP_GodObject_Final2`, while also avoiding over-engineering. The game should be built around a small number of clear gameplay systems, reusable physical controls, data-driven shift scenarios, and one persistent facility that opens up over time.

---

## 1. Core Design Fantasy

The player is a shift operator of an old industrial fusion-core installation.

The main fantasy is not “using a UI,” but **physically operating a machine**:

- reading analog gauges;
- listening to hum, alarms, and electrical instability;
- watching lamps and status monitors;
- adjusting physical levers, switches, knobs, and breakers;
- following grid demand and shift procedure;
- diagnosing problems from symptoms instead of receiving direct instructions.

The core game is the reactor panel.

The player balances three main control inputs:

```text
Fuel Injection  -> raises temperature and power, consumes fuel, can reduce stability
Magnetic Field  -> improves containment/stability, consumes energy, can reduce useful output if excessive
Coolant Flow    -> removes heat, but too much cooling can cause quench / loss of power
```

The player must follow changing `Grid Demand` while keeping safe values for:

```text
Plasma Temp
Containment / Stability
Power Output
Core Stress
Fuel Reserve
Reaction Efficiency
```

Maximum power is not automatically the right answer. Under-production fails the scheduled output, while over-production increases thermal load and stress.

`Vent/Purge` is an emergency hold action. It rapidly reduces thermal pressure but strongly hurts production and consumes resources. It is a recovery tool, not a normal optimization button.

---

## 2. Main Architecture Principle

The game should be organized by responsibility, not by one giant level script.

```text
ReactorCore        -> calculates the real reactor state
ShiftManager       -> controls shift timing, phases, goals, win/fail conditions
ReactorPanel       -> physical interface between player controls and reactor systems
PanelRuntime       -> binds true system state to displayed panel instruments
Interactables      -> reusable levers, buttons, switches, knobs, breakers
Indicators         -> gauges, lamps, speakers, analog displays
World Displays     -> in-world CRT/status monitors
PowerBus           -> battery, breakers, internal consumers, grid output
OperatorCondition  -> stress, fatigue, thirst, caffeine
Hint/Subtitle      -> tutorial hints and protagonist thoughts
ShiftScenario      -> data for a specific shift
ReactorDefinition  -> data for a specific reactor type
FacilityAccess     -> which parts of the facility are unlocked for the current shift
```

Main rules:

```text
Controls do not calculate the reactor.
Indicators do not own gameplay state.
World screens do not invent danger logic.
Level Blueprint does not contain major gameplay logic.
One Blueprint = one clear responsibility.
```

---

## 3. Unreal Project Structure

Suggested folder structure:

```text
Content/
  OperatorGame/
    Core/
      BP_GameMode_Operator
      BP_PlayerController_Operator
      BP_OperatorPawn
      BP_ShiftManager
      BP_FacilityAccessManager

    Reactor/
      Core/
        BP_ReactorCoreBase
        BP_ReactorCore_FCU16
      Panel/
        BP_ReactorPanelBase
        BP_ReactorPanel_FCU16
        BP_PanelRuntimeBase
        BP_PanelRuntime_FCU16
      Data/
        DA_ReactorDefinition_FCU16
      Curves/
        Curve_FCU16_GridDemand_L01
        Curve_FCU16_GridDemand_L02
        Curve_FCU16_GridDemand_L03
        Curve_FCU16_TempResponse
        Curve_FCU16_ContainmentResponse

    Interactables/
      BPI_Interactable
      BP_BaseInteractable
      BP_Lever
      BP_Knob
      BP_Button
      BP_Switch
      BP_Breaker
      BP_Door

    Indicators/
      BP_DialGauge
      BP_WarningLamp
      BP_IndicatorLight
      BP_AnalogDisplay
      BP_SpeakerAlarm

    Displays/
      BP_StatusScreenActor
      BP_StatusScreenRenderer
      BP_CRTScreenMaterialController
      Materials/
        M_StatusScreen_Unlit
        MI_StatusScreen_FCU16
      RenderTargets/
        RT_StatusScreen_FCU16
      Data/
        DA_StatusScreenTheme_FCU16
        ST_StatusScreenText

    Shift/
      Data/
        DA_Shift_FCU16_01_Baseline
        DA_Shift_FCU16_02_InstrumentFault
        DA_Shift_FCU16_03_FuelQuality
        DA_Shift_FCU16_04_FullShiftClock
      FaultProfiles/
        DA_FaultProfile_None
        DA_FaultProfile_InstrumentDrift
        DA_FaultProfile_FuelInstability
        DA_FaultProfile_PowerBusIntro
      FuelProfiles/
        DA_FuelProfile_Standard
        DA_FuelProfile_LowGrade
        DA_FuelProfile_HighReactivity
        DA_FuelProfile_Contaminated
      InstrumentProfiles/
        DA_InstrumentProfile_Normal
        DA_InstrumentProfile_Drifting
        DA_InstrumentProfile_Damaged
      Reports/
        WBP_ShiftReport

    PowerBus/
      BP_PowerProviderBase
      BP_AbstractPowerProvider
      BP_PowerBus
      BP_Battery
      BP_PowerConsumerComponent

    OperatorState/
      BP_OperatorConditionComponent
      Data/
        DA_OperatorConditionDefaults

    Tutorial/
      BP_HintSystem
      BP_SubtitleSystem
      DT_Hints_EN_RU
      DT_Subtitles_EN_RU

    UI/
      WBP_Hint
      WBP_Subtitle
      WBP_ShiftBrief
      WBP_Crosshair
      WBP_Report

    Levels/
      L_FCU16_Facility
      L_Prototype_ControlBooth

    Audio/
    Materials/
    Meshes/
    Decals/
```

---

## 4. Facility / Level Structure

For Unreal, the game should not be split into many tiny web-style levels. The preferred approach is one persistent facility map for the first reactor:

```text
L_FCU16_Facility
  - Control Booth
  - Service Corridor
  - Power Bus Room
  - Staff Room
  - Pump & Feed Room
  - Locked / future service areas
```

Early shifts do not need the whole facility, but the facility can already physically exist.

Progression comes from:

```text
ShiftScenario
FacilityAccess
EnabledSystems
FaultProfile
FuelProfile
InstrumentProfile
```

Not from deleting/rebuilding the map for every level.

### Why this is better

```text
The player does not feel teleported into a new prototype level.
The facility feels like a real workplace.
Locked doors imply future responsibility.
New mechanics feel like new access/clearance, not a different game.
```

### Performance note

For this game scale, one facility map is fine in Unreal. But locked rooms should not run expensive gameplay unnecessarily.

Avoid:

```text
- ticking hundreds of unused actors behind locked doors
- unnecessary dynamic lights in unopened areas
- active VFX/audio/physics in rooms that are not relevant yet
```

Use:

```text
- disabled components
- inactive systems until unlocked
- level streaming later if the facility becomes large
- simple access masks for doors and interactables
```

---

## 5. Shift vs Level

The project should think in terms of **shifts**, not traditional disconnected levels.

```text
Facility Map + ShiftScenario = current playable mission
```

Examples:

```text
L_FCU16_Facility
  DA_Shift_FCU16_01_Baseline
  DA_Shift_FCU16_02_InstrumentFault
  DA_Shift_FCU16_03_FuelQuality
  DA_Shift_FCU16_04_FullShiftClock
```

A shift defines:

```text
- start mode
- accessible areas
- enabled systems
- grid demand curve
- fuel quality
- instrument reliability
- fault events
- clock schedule
- win/fail conditions
- tutorial state
```

---

## 6. Updated Shift Progression

### Shift 1 — Baseline Operation

Purpose: teach the basic reactor operation.

Access:

```text
Control Booth only
```

Enabled:

```text
Reactor panel
Ignite
Fuel Injection
Magnetic Field
Coolant Flow
Vent/Purge
Main gauges
StatusScreen
Basic alarms
```

Disabled / abstracted:

```text
Power Bus Room
Staff Room
Pump Room
Wall-clock schedule pressure
Operator fatigue/thirst
Complex faults
```

Start mode:

```text
Shift Brief -> player looks around -> Ignite starts the run
```

Gameplay:

```text
Normal reactor operation.
Follow Grid Demand.
Avoid overheating, containment loss, and core stress.
```

---

### Shift 2 — Instrument Reliability / False Readings

Purpose: teach the player that instruments can lag, drift, or fail.

Access:

```text
Control Booth only
```

New problems:

```text
Some instruments may show delayed or inaccurate values.
Temp gauge can lag behind real temperature.
Power output needle can jitter.
Containment gauge can stick for short periods.
StatusScreen can report sensor drift or corruption.
Warning lamps can respond late.
```

Important rule:

```text
This must not feel like random unfair lying.
There must be symptoms that something is wrong.
```

Possible symptoms:

```text
- needle jitter
- visible sticking
- delayed movement
- StatusScreen SENSOR DRIFT message
- audio/lighting does not match a gauge reading
- multiple instruments disagree
```

Gameplay lesson:

```text
Do not trust one gauge blindly.
Cross-read the panel, screen, lamps, sound, and reactor behavior.
```

---

### Shift 3 — Fuel Quality / Reactivity

Purpose: teach that the same reactor can behave differently depending on fuel quality and reactivity.

Access:

```text
Control Booth only
```

New problems:

```text
Fuel quality affects reaction stability.
Bad fuel makes temperature and output less predictable.
High reactivity can cause sudden spikes.
Low-grade fuel can create core stall risk.
```

Possible fuel parameters:

```text
FuelQuality
FuelReactivity
FuelImpurity
BurnInstability
StallRisk
EfficiencyMultiplier
StressMultiplier
```

Possible effects:

```text
- temperature jumps
- unstable output
- harder containment
- reaction stalls
- core stall risk
- reactivity spikes
- aggressive Fuel Injection becomes more dangerous
```

Possible status codes:

```text
LOW GRADE FUEL
UNSTABLE BURN
REACTIVITY SURGE
CORE STALL RISK
REACTION STALLED
```

Gameplay lesson:

```text
The player must adapt, not just repeat the Shift 1 solution.
```

---

### Shift 4 — Full Shift / Facility + Clock

Purpose: introduce the game as a full operator shift, not only a panel simulation.

Access:

```text
Control Booth
Service Corridor
Power Bus Room
Staff Room, possibly partial
```

New systems:

```text
Wall clock
Scheduled output windows
Power Bus
Battery / breakers
Control Bus
Grid Output Breaker
Routine windows
Possibly early OperatorCondition
```

Start mode:

```text
Player spawns before shift start.
Example: 21:59:30.
Shift starts at 22:00:00.
```

Example schedule:

```text
21:59:30  Player spawn
22:00:00  Shift start
22:01:00  Ignition expected
22:02:00  Output to grid expected
22:03:00  Scheduled load ramp
22:04:30  High-demand hold
```

Gameplay lesson:

```text
The player is no longer only controlling a reactor.
The player is conducting a shift according to procedure.
```

---

## 7. Start Modes and Time

There are two different time concepts.

### ReactorRunTime

Time since `Ignite`.

Used for:

```text
- reactor phase sequence
- burn progression
- intro runs
- baseline operation
```

Example:

```text
00:00  Ignite
00:20  Field Precharge
00:40  Stable Burn
01:30  Demand Surge
03:00  End of intro run
```

### ShiftClock

Physical shift time / wall clock.

Used for:

```text
- scheduled work
- output windows
- routine windows
- late arrival pressure
- full shift structure
```

Example:

```text
21:59:30  Player spawn
22:00:00  Shift start
22:02:00  Output > 350 MW expected
22:08:00  Shift ends
```

### StartMode enum

```text
ManualIgniteStartsRun
ScheduledClockStartsShift
HybridPrepThenIgnite
```

Recommended use:

```text
Shift 1:
  StartMode = ManualIgniteStartsRun
  No time punishment before Ignite

Shift 2:
  StartMode = ManualIgniteStartsRun
  Instrument faults start after Ignite

Shift 3:
  StartMode = ManualIgniteStartsRun
  Fuel/reaction instability starts after Ignite

Shift 4:
  StartMode = ScheduledClockStartsShift
  Player spawns before shift
  Wall clock matters
```

---

## 8. ShiftManager

`BP_ShiftManager` is the director of the shift.

Responsibilities:

```text
- load DA_ShiftScenario
- set current StartMode
- start/stop ReactorRunTime
- manage ShiftClock if enabled
- advance burn phases
- feed GridDemand into ReactorCore
- trigger fault events
- track required tasks
- check win/fail conditions
- generate final report
```

State machine:

```text
Brief
PreShift
AwaitingIgnition
ActiveRun
Completed
Failed
```

`BP_ShiftManager` should not calculate reactor physics.

It only controls context, schedule, and progression.

---

## 9. DA_ShiftScenario

Every shift should be data-driven.

Suggested fields:

```text
ScenarioName
ReactorDefinition
LevelMap
StartMode

AccessMask
EnabledSystems
FaultProfile
FuelProfile
InstrumentProfile

bEnablePowerBus
bEnablePumpRoom
bEnableOperatorCondition
bEnableStaffRoom
bEnableRoutineWindows
bEnableClockSchedule

PlayerSpawnTime
ShiftStartTime
RequiredIgnitionTime
RequiredOutputTime
RunDuration

PhaseTimeline
GridDemandCurve
FaultEvents
RequiredTasks
WinConditions
FailConditions
FinalReportRules
```

Example — Shift 1:

```text
DA_Shift_FCU16_01_Baseline
  ReactorDefinition = DA_ReactorDefinition_FCU16
  LevelMap = L_FCU16_Facility
  StartMode = ManualIgniteStartsRun

  AccessMask = ControlBooth

  bEnablePowerBus = false
  bEnablePumpRoom = false
  bEnableOperatorCondition = false
  bEnableStaffRoom = false
  bEnableRoutineWindows = false
  bEnableClockSchedule = false

  PowerProvider = AbstractPowerProvider
  InstrumentProfile = Normal
  FuelProfile = Standard
  FaultProfile = None

  RunDuration = 180 seconds
  GridDemandCurve = Curve_FCU16_GridDemand_L01

  RequiredTasks:
    Ignite reactor
    Reach stable burn
    Follow grid demand
    Avoid protection trip

  FailConditions:
    CoreStressLimitReached
    FuelReserveDepleted
    ContainmentLost
```

Example — Shift 4:

```text
DA_Shift_FCU16_04_FullShiftClock
  StartMode = ScheduledClockStartsShift

  AccessMask = ControlBooth + ServiceCorridor + PowerBusRoom + StaffRoom

  bEnablePowerBus = true
  bEnableOperatorCondition = optional
  bEnableStaffRoom = true
  bEnableRoutineWindows = true
  bEnableClockSchedule = true

  PlayerSpawnTime = 21:59:30
  ShiftStartTime = 22:00:00
  RequiredIgnitionTime = 22:01:00
  RequiredOutputTime = 22:02:00

  RoutineWindows:
    22:02:30-22:03:10
    22:04:40-22:05:20
```

---

## 10. FacilityAccess

Use an access mask to control which rooms are available.

Possible enum:

```text
EFacilityAccess
  ControlBooth
  ServiceCorridor
  PowerBusRoom
  StaffRoom
  PumpRoom
```

Example:

```text
Shift 1:
  Access = ControlBooth

Shift 2:
  Access = ControlBooth

Shift 3:
  Access = ControlBooth

Shift 4:
  Access = ControlBooth + ServiceCorridor + PowerBusRoom + StaffRoom
```

Doors should read the access mask:

```text
if ShiftScenario allows area:
  door unlocked
else:
  door locked / no power / authorization denied
```

This keeps the facility physically consistent while controlling progression.

---

## 11. EnabledSystems and Simplified Early Systems

Early shifts should not use separate fake versions of the entire game.

Instead, complex systems are disabled or replaced with abstract providers.

### Shift 1

```text
ReactorCore = enabled
AbstractPowerProvider = enabled
PowerBus = disabled
PumpSystem = idealized
OperatorCondition = disabled
StaffRoom = disabled
ClockSchedule = disabled
```

`BP_AbstractPowerProvider` always returns:

```text
Control Panel Powered = true
Magnetic Field Powered = true
Coolant Powered = true
Alarm Powered = true
```

### Shift 2

```text
ReactorCore = enabled
InstrumentFaults = enabled
AbstractPowerProvider = enabled
PowerBus = disabled
ClockSchedule = disabled
```

### Shift 3

```text
ReactorCore = enabled
FuelQualityProfile = enabled
AbstractPowerProvider = enabled
PowerBus = disabled
ClockSchedule = disabled
```

### Shift 4

```text
ReactorCore = enabled
PowerBus = enabled
ClockSchedule = enabled
FacilityAccess = expanded
StaffRoom = enabled or partially enabled
```

---

## 12. ReactorCore

### BP_ReactorCoreBase

Base class for reactor systems.

Responsibilities:

```text
- store true reactor state
- accept input channels
- update simulation
- trigger safety state
- expose output channels
- provide alert/status codes
```

Common variables:

```text
bIsIgnited
bIsTripped
CurrentPowerOutput
CurrentCoreStress
CurrentEfficiency
CurrentFuelReserve
CurrentGridDemand
ReactorRunTime
```

Common functions:

```text
Ignite()
Shutdown()
VentPurge()
SetInputByChannel(Channel, Value)
GetOutputByChannel(Channel)
UpdateCore(DeltaTime)
CheckSafetyTrips()
GetAlertState()
```

`ReactorCore` does not know about specific lamps, meshes, sounds, or UI widgets.

---

### BP_ReactorCore_FCU16

Specific logic for the first fusion reactor.

Inputs:

```text
FuelInjection
MagneticField
CoolantFlow
VentPurge
```

Outputs:

```text
PlasmaTemp
ContainmentStability
PowerOutput
CoreStress
ReactionEfficiency
FuelReserve
QuenchRisk
ThermalSoak
CoreStall
```

Possible warning/status codes:

```text
Stable
UnderDemand
OverDemand
HeatSoakRecovering
CoreStallRisk
ReactionStalled
ContainmentWeak
ThermalRunaway
MeltdownImminent
FuelReserveLow
StartupFault
```

Important rule:

```text
ReactorCore stores the true state.
PanelRuntime decides how that state is displayed.
```

---

## 13. ReactorDefinition

One reactor type should have one definition asset.

Example:

```text
DA_ReactorDefinition_FCU16
  CoreClass = BP_ReactorCore_FCU16
  PanelClass = BP_ReactorPanel_FCU16
  PanelRuntimeClass = BP_PanelRuntime_FCU16

  MainInputs:
    FuelInjection
    MagneticField
    CoolantFlow

  MainOutputs:
    PlasmaTemp
    ContainmentStability
    PowerOutput
    CoreStress

  DefaultSafeRanges:
    PlasmaTemp 85-125
    Stability 72-95
    CoreStress < 60

  DefaultCurves:
    TempResponseCurve
    ContainmentResponseCurve
    GridDemandCurve

  DefaultSounds:
    HumLoop
    AlarmLoop
    QuenchSound
```

Future reactors can have their own definitions:

```text
DA_ReactorDefinition_RBMK1000
DA_ReactorDefinition_TokamakX
```

Correct future structure:

```text
One reactor type = one Core + one Panel + one ReactorDefinition.
One shift = one ShiftScenario.
```

Avoid:

```text
BP_CoreFCU16_Level01
BP_CoreFCU16_Level02
BP_CoreFCU16_Level03
```

Use:

```text
BP_ReactorCore_FCU16
  DA_Shift_FCU16_01_Baseline
  DA_Shift_FCU16_02_InstrumentFault
  DA_Shift_FCU16_03_FuelQuality
  DA_Shift_FCU16_04_FullShiftClock
```

---

## 14. ReactorPanel and PanelRuntime

### BP_ReactorPanelBase

Physical panel actor.

Contains:

```text
- levers
- knobs
- switches
- buttons
- gauges
- lamps
- status screens
- panel mesh / labels / decals
```

It should not calculate the reactor.

---

### BP_ReactorPanel_FCU16

Specific FCU-16 panel layout.

Contains:

```text
Fuel Injection lever
Magnetic Field knob
Coolant Flow knob
Ignite button
Vent/Purge button
Plasma Temp gauge
Containment gauge
Power Output gauge
Core Stress gauge
Grid Demand gauge
Warning lamps
StatusScreen
```

---

### BP_PanelRuntimeBase / BP_PanelRuntime_FCU16

`PanelRuntime` is the adapter between real gameplay state and physical instruments.

Responsibilities:

```text
- bind controls to reactor input channels
- bind true reactor values to displayed instrument values
- apply InstrumentProfile distortion
- build StatusScreenModel
- update gauges, lamps, status screen, alarm speakers
```

Example:

```text
Fuel Lever
  -> ReactorCore.SetInputByChannel(FuelInjection)

Temp Gauge
  <- displayed value from PanelRuntime

StatusScreen
  <- StatusScreenModel built by PanelRuntime
```

`PanelRuntime` should not calculate the true reactor physics.

It can calculate display distortion:

```text
True PlasmaTemp = 140 MK
Displayed PlasmaTemp = 122 MK because temp gauge is lagging
```

---

## 15. True State vs Displayed State

This distinction is important for Shift 2.

```text
ReactorCore true values
PanelRuntime displayed values
```

Example:

```text
ReactorCore:
  PlasmaTemp = 140 MK
  CoreStress = 64%

PanelRuntime with faulty gauge:
  TempGaugeDisplayed = 122 MK
  TempGaugeNeedleJitter = true
  StatusScreen row = SENSOR DRIFT / TEMP LAG
```

The reactor should not become “wrong” just because a gauge is faulty.

Faulty instruments live in the display layer.

---

## 16. FaultProfile, FuelProfile, InstrumentProfile

### FaultProfile

Defines scenario-level faults.

Examples:

```text
DA_FaultProfile_None
DA_FaultProfile_InstrumentDrift
DA_FaultProfile_FuelInstability
DA_FaultProfile_PowerBusIntro
```

Instrument drift example:

```text
TempGaugeLag = true
OutputNeedleJitter = true
ContainmentGaugeStickChance = 0.15
StatusScreenSensorWarning = true
```

Fuel instability example:

```text
ReactivitySpikeChance = 0.2
CoreStallRisk = medium
TemperatureNoise = high
FuelEfficiencyVariance = high
```

---

### FuelProfile

Defines fuel behavior.

Examples:

```text
DA_FuelProfile_Standard
DA_FuelProfile_LowGrade
DA_FuelProfile_HighReactivity
DA_FuelProfile_Contaminated
```

Fields:

```text
BaseReactivity
BurnStability
ThermalNoise
StallRisk
EfficiencyMultiplier
StressMultiplier
```

---

### InstrumentProfile

Defines how reliable the panel instruments are.

Examples:

```text
DA_InstrumentProfile_Normal
DA_InstrumentProfile_Drifting
DA_InstrumentProfile_Damaged
```

Fields:

```text
GaugeLag
NeedleNoise
SensorOffset
StickChance
UpdateDelay
ScreenCorruption
WarningLampDelay
```

---

## 17. Interaction System

The player should not care whether they are looking at a lever, button, door, radio, or coffee machine.

All interactable objects should implement:

```text
BPI_Interactable
  OnFocus()
  OnUnfocus()
  OnInteractPressed()
  OnInteractReleased()
  OnScroll(Delta)
  GetInteractionText()
```

`BP_OperatorPawn` handles:

```text
Camera trace
CurrentFocusedInteractable
Input forwarding
RMB lean / zoom
Mouse wheel interaction
```

Flow:

```text
Camera -> Trace -> CurrentInteractable
MouseWheel -> CurrentInteractable.OnScroll(Delta)
LMB Press -> CurrentInteractable.OnInteractPressed()
LMB Release -> CurrentInteractable.OnInteractReleased()
```

This works for:

```text
- levers
- knobs
- buttons
- switches
- breakers
- doors
- shift brief
- radio
- coffee machine
- water dispenser
```

---

## 18. Universal Physical Controls

Do not make a unique Blueprint for every control.

Avoid:

```text
BP_FuelLever
BP_MagneticFieldLever
BP_CoolantLever
BP_BatteryLever
BP_PumpLever
```

Use reusable controls:

```text
BP_Lever
BP_Knob
BP_Button
BP_Switch
BP_Breaker
```

Example `BP_Lever` variables:

```text
DisplayName
MinValue
MaxValue
CurrentValue
Step
ControlChannel
bReturnToCenter
InteractionMode
LeverAngleMin
LeverAngleMax
SoundProfile
```

Instance example:

```text
DisplayName = FUEL INJECTION
ControlChannel = Reactor.Input.FuelInjection
MinValue = 0
MaxValue = 1
Step = 0.01
```

A lever does not know what fuel is. It only sends a value through its assigned channel.

---

## 19. Indicators

Indicators show state. They do not own state.

### BP_DialGauge

Variables:

```text
MinValue
MaxValue
CurrentValue
NeedleMinRotation
NeedleMaxRotation
DangerZoneStart
Label
Smoothing
NeedleNoise
LagAmount
```

Usage:

```text
PanelRuntime -> TempGauge.SetValue(DisplayedPlasmaTemp)
PanelRuntime -> OutputGauge.SetValue(DisplayedPowerOutput)
PanelRuntime -> StressGauge.SetValue(DisplayedCoreStress)
```

---

### BP_WarningLamp

States:

```text
Off
On
BlinkSlow
BlinkFast
Flicker
Failed
```

Variables:

```text
BaseIntensity
FlickerSpeed
FlickerRandomness
FadeTime
EmissiveMultiplier
bPowered
```

A lamp does not decide what an emergency is. It receives a display state.

---

## 20. World-Space Instrument Displays / StatusScreen

`StatusScreen` is not a normal HUD and not an HTML screen.

It is an in-world monitor built into the physical panel.

Current web prototype idea:

```text
canvas -> CanvasTexture -> material -> mesh
```

Unreal equivalent:

```text
Screen Model -> Render Target / Widget Render -> Material Instance -> Mesh screen
```

Main rule:

```text
Simulation does not draw the screen.
Screen does not invent gameplay logic.
PanelRuntime builds the display model.
StatusScreenRenderer only renders it.
```

---

### 20.1 Implementation options

#### Option A — UMG Widget -> Render Target / Widget Component

Good for:

```text
- text rows
- status tables
- localization
- terminal-like screens
- shift reports
```

Pipeline:

```text
WBP_StatusScreen_FCU16
  -> Widget Component or Render Target
  -> screen material
  -> screen mesh
```

Pros:

```text
Easy text layout.
Easier localization.
Easy mode switching.
Good for status rows.
```

Cons:

```text
Can look too much like UI unless the material adds CRT treatment.
Must avoid updating too often.
```

#### Option B — CanvasRenderTarget2D

Closer to the current JS canvas version.

Pipeline:

```text
CanvasRenderTarget2D
  -> draw text / lines / materials
  -> UpdateResource()
  -> material texture parameter
  -> screen mesh
```

Pros:

```text
Very close to canvas workflow.
Good for old CRT/terminal vibe.
Easy to update every 0.35 sec.
```

Cons:

```text
Text layout and localization are more annoying.
Complex UI is harder.
```

Recommended for first Unreal version:

```text
WBP_StatusScreen_FCU16 -> Widget/RenderTarget -> CRT Material -> Mesh
```

But visually keep it canvas-like:

```text
low-res
unlit/emissive
scanlines
noise
rare updates
industrial terminal feel
```

---

### 20.2 StatusScreen classes

#### BP_StatusScreenActor

Physical screen actor/component.

Responsibilities:

```text
- store screen mesh
- create dynamic material instance
- assign render target / widget texture to material
- control brightness, flicker, scanlines, signal loss
- respond to power state
```

Variables:

```text
Brightness
bIsPowered
bHasSignal
bEnableScanlines
bEnableCRTNoise
ScreenTheme
UpdateInterval = 0.35
```

---

#### BP_StatusScreenRenderer

Logical renderer.

Responsibilities:

```text
- accept StatusScreenModel
- update WBP or CanvasRenderTarget
- switch display modes
- update on timer, not every frame
```

Not responsible for:

```text
- calculating reactor danger state
- deciding meltdown
- calculating shift phase
- win/fail conditions
```

---

#### WBP_StatusScreen_FCU16

Visual layout.

Modes:

```text
Standby
Active
StartupFault
TerminalStatus
EmergencyOverlay
Complete
Failed
```

Elements:

```text
Header
Phase line
Timer / remaining
Telemetry rows
Warning rows
Emergency banner
Footer / system code
```

---

### 20.3 StatusScreenModel

The screen should receive a display model, not raw simulation data.

Bad:

```text
StatusScreen receives thermalSoak and coreStress
StatusScreen decides to show MELTDOWN IMMINENT
```

Good:

```text
ReactorCore / PanelRuntime decides AlertCode and Severity
StatusScreen only renders the given alert
```

Example:

```text
FStatusScreenModel
  Mode
  PhaseKey
  RemainingSeconds
  Rows
  Alert
  FooterStatusKey
  bEmergencyBlink
  bSignalNoise
```

Example instance:

```text
Mode = Active
PhaseKey = phase.fieldPrecharge
RemainingSeconds = 124

Rows:
  screen.temp          62 MK     Normal
  screen.containment   91%       Normal
  screen.output        410 MW    Normal
  screen.target        450 MW    Warning
  screen.stress        23%       Normal

Alert:
  Severity = Warning
  Code = HeatSoakRecovering
  TitleKey = screen.alert.heatSoakRecovering
  SubtitleText = TEMP 62 MK / STRESS 23%
```

---

### 20.4 Screen enums / codes

Avoid raw gameplay strings:

```text
"startupFault"
"failed"
"MELTDOWN IMMINENT"
"HEAT SOAK RECOVERING"
```

Use enums/codes:

```text
EStatusScreenMode
  Standby
  Active
  StartupFault
  Terminal
  Complete
  Failed

EAlertSeverity
  None
  Info
  Warning
  Critical
  Fatal

EAlertCode
  None
  HeatSoakRecovering
  CoreStall
  ThermalRunaway
  MeltdownImminent
  ContainmentLost
  FuelReserveDepleted
  StartupFault
```

Text should come from localization keys:

```text
screen.mode.standby
screen.mode.active
screen.alert.heatSoakRecovering
screen.alert.meltdownImminent
screen.row.temperature
screen.row.containment
screen.row.powerOutput
screen.row.gridDemand
```

---

### 20.5 StatusScreen update frequency

Do not update the screen every frame.

Default:

```text
UpdateInterval = 0.35 sec
```

Emergency:

```text
EmergencyUpdateInterval = 0.1 sec
```

Powered off:

```text
No update, black screen or fading phosphor
```

Use timer:

```text
SetTimerByEvent(UpdateStatusScreen, 0.35, looping=true)
```

Skip redraw if the model did not change.

---

### 20.6 Screen material

Use unlit/emissive material.

```text
M_StatusScreen_Unlit
  TextureParameter: ScreenTexture
  ScalarParameter: Brightness
  ScalarParameter: ScanlineStrength
  ScalarParameter: NoiseAmount
  ScalarParameter: Vignette
  ScalarParameter: SignalLoss
```

Material instance:

```text
MI_StatusScreen_FCU16
  ScreenTexture = RT_StatusScreen_FCU16
  Brightness = 1.0
  ScanlineStrength = 0.25
  NoiseAmount = 0.05
```

The screen is part of the world. It should respond to:

```text
power loss
low voltage
brightness changes
signal fault
flicker
CRT noise
```

---

### 20.7 Emergency banner rule

The screen must not invent emergency state.

Bad:

```text
if thermalSoak > 0.8:
  draw "MELTDOWN IMMINENT"
```

This can create contradictory states:

```text
Simulation:
  STATUS = HEAT SOAK RECOVERING
  TEMP = 62 MK
  STRESS = 23%

Screen:
  MELTDOWN IMMINENT
```

Correct:

```text
ReactorCore:
  AlertCode = HeatSoakRecovering
  Severity = Warning

StatusScreen:
  renders warning banner from AlertCode
```

If the screen shows `MELTDOWN IMMINENT`, that code must come explicitly from the gameplay state.

---

## 21. PowerBus

PowerBus starts as an abstract provider in early shifts and becomes real from Shift 4 or later.

Responsibilities:

```text
- battery charge / voltage
- battery output
- battery charging
- Control Bus
- Grid Output Breaker
- internal consumers
- reactor system power
- self supply status
- net output
- waste heat
```

Possible systems:

```text
EMERG LIGHTS
ALARM POWER
INTERIOR LIGHTS
REACTOR CONTROL PANEL POWER
REACTOR GENERAL
MAGNETIC FIELD SUPPLY
COOLANT PUMP A
PUMP B
FUEL FEED PUMP
VENT/PURGE SYSTEM
```

Important outputs:

```text
GRID DEMAND
NET OUTPUT
WASTE HEAT
SELF SUPPLY OK
BACKUP BAT VOLTAGE
QUICK DISCHARGE
```

PowerBus can affect ReactorCore through power availability:

```text
IsMagneticFieldPowered?
IsCoolantPumpPowered?
IsControlPanelPowered?
```

ReactorCore should not directly own battery logic.

---

## 22. OperatorCondition

Starts later, not in the first baseline shifts.

Component:

```text
BP_OperatorConditionComponent
```

Variables:

```text
Stress
Fatigue
Thirst
Caffeine
```

Effects:

```text
Stress   -> camera/cursor tremor, distortion, breathing, sound muffling
Fatigue  -> blur, heavy camera, slower cursor/focus
Thirst   -> vignette, loss of clarity
Caffeine -> lowers fatigue, improves focus, too much causes tremor
```

Important rule:

```text
Effects should create pressure, not make the game unfair or uncontrollable.
Small controls need generous hitboxes.
```

Staff Room interactions:

```text
Coffee Machine -> reduce fatigue, add caffeine
Water Dispenser -> reduce thirst, slightly reduce stress
Chair/Sofa -> reduce stress/fatigue, but time continues
Radio/TV -> atmosphere, information, maybe stress reduction if system is stable
```

---

## 23. Hint and Subtitle Systems

Tutorial feedback is split into two channels.

### Hints

System control hints.

Examples:

```text
hints.movement.wasd
hints.input.zoom
hints.input.mouse_wheel
hints.input.interact
```

Purpose:

```text
Teach controls briefly.
Do not block movement after the Shift Brief.
Do not solve the reactor for the player.
```

### Subtitles

Protagonist thoughts/reactions.

Examples:

```text
subtitles.operator.need_start_reactor
subtitles.operator.something_is_lagging
subtitles.operator.heat_rising_fast
```

Purpose:

```text
Describe symptoms, emotions, or observations.
Do not give exact instructions like “first raise magnetic field.”
```

Localization rule:

```text
Every new hint and subtitle must have EN and RU keys.
Hints use namespace hints.*
Subtitles use namespace subtitles.*
Do not mix them.
```

---

## 24. Communication Between Systems

Use Event Dispatchers and interfaces instead of hard references everywhere.

ReactorCore dispatchers:

```text
OnReactorStateChanged
OnAlarmTriggered
OnTripTriggered
OnIgnitionFailed
OnIgnitionSucceeded
OnDemandMismatch
```

Example flow:

```text
ReactorCore detects CoreStress > danger
  -> OnAlarmTriggered(CoreStressHigh)
  -> PanelRuntime updates warning lamp
  -> Alarm speaker starts
  -> SubtitleSystem shows reaction
  -> ShiftManager records incident
```

ReactorCore should not directly turn on a specific lamp or play a specific sound.

---

## 25. What Not To Do

Do not put core gameplay logic in Level Blueprint.

Do not make `BP_ReactorPanel` calculate the whole game.

Do not make each lever a unique custom Blueprint.

Do not let StatusScreen calculate meltdown or invent alert logic.

Do not hardcode English display text inside rendering functions.

Do not make different copies of the same ReactorCore for each shift.

Do not add PowerBus, Staff Room, Pump Room, and OperatorCondition before the basic panel is fun.

Do not build architecture for seven future reactors so deeply that the first reactor never becomes playable.

---

# Near-Term Goals

The closest goal is not the full facility. The closest goal is a strong, playable FCU-16 control booth experience.

## Milestone 0 — Clean Project Base

Goal: create the minimal structure without gameplay chaos.

Make:

```text
Folder structure
BP_GameMode_Operator
BP_PlayerController_Operator
BP_OperatorPawn
BP_ShiftManager
BPI_Interactable
BP_BaseInteractable
```

Result:

```text
Player can walk around, look at objects, and receive focus/unfocus feedback.
```

---

## Milestone 1 — Interaction Feel

Goal: make physical interaction with the panel feel good.

Make:

```text
BP_Lever
BP_Knob
BP_Button
BP_Switch
Mouse wheel input
RMB lean/zoom to panel
Hover/focus feedback
Generous hitboxes
Click/rotation sounds
```

Result:

```text
Player can look at a lever, scroll the mouse wheel, and the lever moves physically.
Buttons click.
Switches snap.
This should already feel satisfying without reactor logic.
```

Quality bar:

```text
Just touching the panel should feel good.
```

---

## Milestone 2 — Universal Indicators

Goal: build the visual language of the panel.

Make:

```text
BP_DialGauge
BP_WarningLamp
BP_IndicatorLight
Base emissive lamp material
Flicker parameters
Gauge smoothing
Needle jitter option
```

Result:

```text
A gauge can be manually fed a value and the needle moves nicely.
A lamp can be set to Off / On / Blink / Flicker / Failed.
```

---

## Milestone 3 — ReactorCore_FCU16 Prototype

Goal: build the first real reactor simulation without a polished panel.

Make:

```text
BP_ReactorCoreBase
BP_ReactorCore_FCU16
Inputs:
  FuelInjection
  MagneticField
  CoolantFlow
Outputs:
  PlasmaTemp
  ContainmentStability
  PowerOutput
  CoreStress
  FuelReserve
Ignite
Vent/Purge
Trip conditions
Basic alert codes
```

Result:

```text
Reactor can start.
Three inputs influence the system.
There is understandable failure from overheating, containment loss, or stress.
```

Quality bar:

```text
With debug sliders alone, the simulation already makes sense:
fuel heats, field stabilizes, coolant cools but can suppress reaction.
```

---

## Milestone 4 — First FCU-16 Panel Vertical Slice

Goal: connect physical controls to the reactor.

Make:

```text
BP_ReactorPanel_FCU16
BP_PanelRuntime_FCU16
Fuel Injection lever
Magnetic Field knob
Coolant Flow knob
Ignite button
Vent/Purge button
Temp gauge
Stability gauge
Output gauge
Stress gauge
Grid Demand gauge
Warning lamps
```

Result:

```text
Player can operate the reactor through the physical panel.
Gauges and lamps show the reactor state.
```

This is the main vertical slice.

---

## Milestone 5 — StatusScreen Level 1

Goal: recreate the current web StatusScreen as an in-world Unreal instrument display.

Make:

```text
WBP_StatusScreen_FCU16
BP_StatusScreenActor
M_StatusScreen_Unlit
MI_StatusScreen_FCU16
StatusScreenModel struct
Basic CRT material pass
0.35 sec update timer
```

Required modes:

```text
Standby
Active
StartupFault
Complete
Failed
EmergencyOverlay
```

Required rows:

```text
Phase
Time remaining
Plasma Temp
Containment
Power Output
Grid Demand
Core Stress
```

Important rule:

```text
StatusScreen only renders AlertCode from the model.
It does not invent MELTDOWN IMMINENT from raw thermalSoak.
```

Result:

```text
The screen feels like a world-space industrial CRT/terminal, not a HUD.
```

---

## Milestone 6 — Shift 1 Baseline

Goal: build the first complete 180-second run.

Make:

```text
DA_Shift_FCU16_01_Baseline
ManualIgniteStartsRun
180-second burn sequence
GridDemand curve
Win/fail conditions
Basic final report
```

Phases:

```text
FIELD PRECHARGE
PLASMA IGNITION
STABLE BURN
DEMAND SURGE
SUSTAINED HIGH LOAD
```

Result:

```text
Player can complete Shift 1 from Shift Brief to final report.
The run starts after Ignite.
Before Ignite, the player is not punished by time.
```

Quality bar:

```text
A playtester understands the fantasy:
I am an operator reading instruments and holding the reactor near demand.
```

---

## Milestone 7 — Tutorial UX

Goal: explain controls without turning the game into a wall of text.

Make:

```text
WBP_Hint
WBP_Subtitle
BP_HintSystem
BP_SubtitleSystem
DT_Hints_EN_RU
DT_Subtitles_EN_RU
```

Starter hints:

```text
hints.movement.wasd
hints.input.zoom
hints.input.mouse_wheel
hints.input.interact
```

Starter subtitles:

```text
subtitles.operator.need_start_reactor
subtitles.operator.reactor_responding
subtitles.operator.too_hot
```

Result:

```text
Hints teach controls.
Subtitles describe thoughts/symptoms.
Neither gives the exact solution.
```

---

## Milestone 8 — Shift 1 Polish Pass

Goal: make the baseline shift feel like a small real game, not a debug demo.

Make:

```text
Reactor hum loop
Control click/switch sounds
Alarm sounds
Camera micro shake on stress
Light flicker on danger
Ignition fail feedback
Readable panel labels
Shift Brief
Final Shift Report
Basic localization keys
```

Result:

```text
Shift 1 can be shown to another person for a real playtest.
```

---

## Milestone 9 — Shift 2 Instrument Fault

Goal: make the same panel more suspicious and diagnostic.

Make:

```text
DA_Shift_FCU16_02_InstrumentFault
DA_InstrumentProfile_Drifting
Temp gauge lag
Output needle jitter
Containment stick chance
StatusScreen SENSOR DRIFT state
Warning lamp delay
```

Result:

```text
Player learns to cross-read instruments instead of trusting one value.
```

---

## Milestone 10 — Shift 3 Fuel Quality

Goal: make the reactor behavior itself less predictable.

Make:

```text
DA_Shift_FCU16_03_FuelQuality
DA_FuelProfile_LowGrade or HighReactivity
Temperature noise
Reactivity spikes
Core stall risk
Unstable burn status codes
```

Result:

```text
Player learns to adapt to unstable fuel/reactivity conditions.
```

---

## Milestone 11 — Shift 4 Facility + Clock

Goal: start turning the game from panel simulator into full operator shift.

Make:

```text
AccessMask expands to corridor + PowerBusRoom
Door locking/unlocking
ShiftClock
Scheduled output windows
PowerBus intro
Battery / breakers
Grid Output Breaker
Basic routine window
```

Result:

```text
Player spawns before shift start, follows the wall clock, prepares systems, starts reactor, and begins output on schedule.
```

---

# Immediate Next Actions

The next practical order:

```text
1. Create project folder structure.
2. Build BPI_Interactable and BP_OperatorPawn trace.
3. Build BP_Lever, BP_Button, BP_Knob, BP_Switch.
4. Build BP_DialGauge and BP_WarningLamp.
5. Build BP_ReactorCore_FCU16 with debug inputs.
6. Build BP_ReactorPanel_FCU16 and BP_PanelRuntime_FCU16.
7. Build StatusScreenModel and WBP_StatusScreen_FCU16.
8. Build DA_Shift_FCU16_01_Baseline.
9. Make Shift 1 playable.
10. Only then start Shift 2 faults, Shift 3 fuel, Shift 4 facility/clock.
```

Current focus:

```text
Not PowerBus yet.
Not Staff Room yet.
Not seven reactors yet.
Not giant design doc expansion.

First:
pleasant physical panel + working FCU-16 + readable StatusScreen + first 180-second run.
```

If the base panel is not fun, all later rooms are just decoration.

If the base panel is fun, later systems will naturally multiply tension and depth.
