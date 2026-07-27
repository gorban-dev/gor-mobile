// Companion to references/state-hoisting.md — smart-home domain, own scenarios.
import androidx.compose.material3.Button
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.collections.immutable.ImmutableList

// Rule: state down, events up.

// BAD: the child writes state it does not own — an uncontrolled cross-scope side effect
@Composable
fun BrightnessRowBad(brightness: MutableState<Float>) {
    Slider(value = brightness.value, onValueChange = { brightness.value = it })
}

// GOOD: value in, event out — only the owner decides what a change means
@Composable
fun BrightnessRow(brightness: Float, onBrightnessChange: (Float) -> Unit) {
    Slider(value = brightness, onValueChange = onBrightnessChange)
}

// Rule: state lives in the smallest common scope.

data class Room(val name: String)

// BAD: filter hoisted to the dashboard root — every keystroke re-runs the whole screen body
@Composable
fun DashboardBad(rooms: List<Room>) {
    var filter by remember { mutableStateOf("") }
    RoomFilterRow(filter, onFilterChange = { filter = it })
    SceneShortcuts()
}

// GOOD: the only reader/writer owns the state — invalidation stays inside that scope
@Composable
fun Dashboard(rooms: ImmutableList<Room>) {
    RoomFilterRow()   // stateful wrapper owns the filter (next rule)
    SceneShortcuts()
}

// Rule: stateless by default; a thin stateful wrapper only at the boundary.

// BAD: state baked in — callers can never supply, observe, or persist the filter
@Composable
fun RoomFilterRowBad() {
    var filter by remember { mutableStateOf("") }
    Text("Filter: $filter")
}

// GOOD: stateless core — reusable, skippable on parameters alone
@Composable
fun RoomFilterRow(filter: String, onFilterChange: (String) -> Unit) {
    Text("Filter: $filter") // real code: a text field bound to filter/onFilterChange
}

// GOOD: wrapper adds ownership only, no extra logic
@Composable
fun RoomFilterRow() {
    var filter by remember { mutableStateOf("") }
    RoomFilterRow(filter, onFilterChange = { filter = it })
}

// Rule: never pass ViewModel or MutableState<T> down the tree.

class ThermostatViewModel { fun setTarget(tempC: Float) {} }

// BAD: every descendant gains write access and an opaque, unskippable input
@Composable
fun ThermostatDialBad(viewModel: ThermostatViewModel) { /* ... */ }

// GOOD: plain values and callbacks — output follows from parameters alone, so skipping works
@Composable
fun ThermostatDial(targetTempC: Float, onTargetChange: (Float) -> Unit) { /* ... */ }

// Rule: defer fast-changing reads with a lambda provider.

class PowerMeter { val watts = mutableStateOf(0f) }

@Composable
fun EnergyPanelBad(meter: PowerMeter) {
    // BAD: .value read in this scope — the whole panel re-runs on every meter tick
    ConsumptionGauge(watts = meter.watts.value)
}

@Composable
fun EnergyPanelGood(meter: PowerMeter) {
    // GOOD: read deferred into the consumer — only the scope invoking the lambda registers it
    DeferredConsumptionGauge(watts = { meter.watts.value })
}

// Rule: mutate state only in event callbacks, never during composition.

@Composable
fun SceneCounterBad() {
    var activations by remember { mutableStateOf(0) }
    // BAD: write while composing — non-idempotent, invalidates the very scope being composed
    activations++
    Text("Scenes run: $activations")
}

@Composable
fun SceneCounterGood() {
    var activations by remember { mutableStateOf(0) }
    // GOOD: writes happen on events; composition only reads
    Button(onClick = { activations++ }) { Text("Scenes run: $activations") }
}

@Composable fun SceneShortcuts() {}
@Composable fun ConsumptionGauge(watts: Float) { Text("$watts W") }
@Composable fun DeferredConsumptionGauge(watts: () -> Float) { Text("${watts()} W") }
