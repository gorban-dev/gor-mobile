// Companion to references/recomposition.md — workout-log domain, own scenarios.
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import kotlinx.collections.immutable.ImmutableList

data class Exercise(val id: String, val name: String, val calories: Int)
class SessionTelemetry { var headerRenders = 0 }
class GpxParser

// Rule: write bodies that survive re-execution; cache derivations with remember(inputs).

// BAD: mutates external state on every pass — the runtime re-invokes bodies N times, N unknown
@Composable
fun SessionHeaderBad(exercises: List<Exercise>, telemetry: SessionTelemetry) {
    telemetry.headerRenders++
    val burned = exercises.sumOf { it.calories }
    Text("Burned: $burned kcal")
}

// GOOD: derivation cached in the slot table, recomputed only when exercises changes
@Composable
fun SessionHeaderGood(exercises: ImmutableList<Exercise>) {
    val burned = remember(exercises) { exercises.sumOf { it.calories } }
    Text("Burned: $burned kcal")
}

// Rule: key(stableId) around items emitted from a loop.

// BAD: identity = call order — inserting at the top shifts every row identity below it
@Composable
fun ExerciseFeedBad(exercises: List<Exercise>) {
    Column {
        for (exercise in exercises) {
            ExerciseRow(exercise)
        }
    }
}

// GOOD: key emits a movable group — identity travels with the data across reorders
@Composable
fun ExerciseFeedGood(exercises: ImmutableList<Exercise>) {
    Column {
        for (exercise in exercises) {
            key(exercise.id) {
                ExerciseRow(exercise)
            }
        }
    }
}

// Rule: remember is a per-call-site slot, not a shared cache.

// BAD: two call sites mean two slots — each screen builds its own parser instance
@Composable
fun RouteImportBad() {
    val parser = remember { GpxParser() }
    RoutePane(parser)
}

@Composable
fun RouteExportBad() {
    val parser = remember { GpxParser() } // different call site, fresh instance
    RoutePane(parser)
}

// GOOD: one owner remembers once; children receive the instance as a parameter
@Composable
fun RouteScreenGood() {
    val parser = remember { GpxParser() }
    RoutePane(parser)
    RoutePane(parser)
}

// Rule: callbacks must capture only stable values.

class SyncEngine { fun syncNow() {} } // no stability promise — assumed unstable

@Composable
fun SyncControls(engine: SyncEngine, onSync: () -> Unit) {
    // BAD: unstable capture — the lambda is rebuilt every pass, so Button never skips
    Button(onClick = { engine.syncNow() }) { Text("Sync") }
    // GOOD: stable function parameter — the compiler memoizes the lambda, Button skips
    Button(onClick = onSync) { Text("Sync") }
}

// Rule: one call site, not one call per branch.

@Composable
fun GoalSection(goalName: String, expanded: Boolean) {
    // BAD: each branch is a replaceable group — toggling discards GoalCard's remembered state
    if (expanded) GoalCard(goalName, detailed = true) else GoalCard(goalName, detailed = false)
    // GOOD: one call site keeps one identity across the toggle
    GoalCard(goalName, detailed = expanded)
}

// Rule: defer fast-changing reads with a lambda.

class LiveSession { val heartRate = mutableStateOf(0) }

@Composable
fun LiveWorkout(session: LiveSession) {
    // BAD: .value read here — this scope and every layer down to the consumer re-run per tick
    HeartRatePanel(bpm = session.heartRate.value)
    // GOOD: passing a lambda is not a read — only the scope that invokes it recomposes
    DeferredHeartRatePanel(bpm = { session.heartRate.value })
}

@Composable fun ExerciseRow(exercise: Exercise) { Text(exercise.name) }
@Composable fun RoutePane(parser: GpxParser) {}
@Composable fun GoalCard(name: String, detailed: Boolean) { Text(name) }
@Composable fun HeartRatePanel(bpm: Int) { Text("$bpm bpm") }
@Composable fun DeferredHeartRatePanel(bpm: () -> Int) { Text("${bpm()} bpm") }
