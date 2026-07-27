// Companion to references/modifiers-phases.md + layout-semantics.md — agenda/calendar domain.
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.collections.immutable.ImmutableList

val Lavender = Color(0xFF9A8CF0)
fun openEvent() {}
// Rule: chain order is behavior — each modifier applies to what the chain left it.
// BAD: padding first — only the inset area is colored and tappable
val eventChipBad = Modifier.padding(10.dp).background(Lavender).clickable(onClick = ::openEvent)
// GOOD: color and click cover the full bounds; padding insets the content
val eventChip = Modifier.background(Lavender).clickable(onClick = ::openEvent).padding(10.dp)

// Rule: one modifier parameter, applied to the outermost emitted layout.
// BAD: the caller's chain lands on an inner child — the parent cannot size or place the badge
@Composable
fun DayBadgeBad(day: String, modifier: Modifier = Modifier) {
    Row { Text("•"); Text(day, modifier) }
}
// GOOD: the chain decorates the root node the caller sees
@Composable
fun DayBadge(day: String, modifier: Modifier = Modifier) {
    Row(modifier) { Text("•"); Text(day) }
}

// Rule: read per-frame values in lambda modifiers, not in composition.
@Composable
fun ReminderDot(pulse: State<Float>) {
    // BAD: read in composition — the whole scope recomposes on every animation frame
    Dot(Modifier.graphicsLayer(scaleX = pulse.value, scaleY = pulse.value))
    // GOOD: read inside the draw-phase lambda — only that layer updates
    Dot(Modifier.graphicsLayer { scaleX = pulse.value; scaleY = pulse.value })
}

// Rule: keep chains stable across recompositions.
val slotBase = Modifier.padding(6.dp)
val todayBorder = Modifier.border(1.dp, Lavender)

@Composable
fun AgendaSlot(isToday: Boolean, onPick: () -> Unit) {
    // BAD: structurally new chain each pass — unmatched wrappers rebuilt, node re-attached
    Row((if (isToday) Modifier.border(1.dp, Lavender) else Modifier)
        .padding(6.dp).clickable(onClick = onPick)) { Text("Slot") }
    // GOOD: stable base — only the varying element swaps, the rest reuses cached wrappers
    Row(slotBase.then(if (isToday) todayBorder else Modifier)
        .clickable(onClick = onPick)) { Text("Slot") }
}

// Rule: custom arrangement = Layout + measure policy — measure each child exactly once,
// report a size inside the constraints, place from real measured sizes (no offset guessing).
@Composable
fun TimelineColumn(entries: ImmutableList<String>, modifier: Modifier = Modifier) {
    Layout({ entries.forEach { Text(it) } }, modifier) { measurables, constraints ->
        // BAD: probe-measure then measure again — a second measure of the same child throws
        // val probes = measurables.map { it.measure(constraints) }; measurables.map { it.measure(...) }
        // GOOD: one measure per child; chosen size coerced into min..max before reporting
        val rows = measurables.map { it.measure(constraints.copy(minHeight = 0)) }
        val width = (rows.maxOfOrNull { it.width } ?: 0).coerceIn(constraints.minWidth, constraints.maxWidth)
        val height = rows.sumOf { it.height }.coerceIn(constraints.minHeight, constraints.maxHeight)
        layout(width, height) {
            var y = 0
            rows.forEach { row -> row.place(0, y); y += row.height }
        }
    }
}

// Rule: don't fill the unbounded axis of a scrollable parent.
@Composable
fun MonthFeed() {
    // BAD: LazyColumn measures items with infinite height — fillMaxHeight degrades to wrap
    LazyColumn { item { MonthHero(Modifier.fillMaxHeight()) } }
    // GOOD: explicit size on the scroll axis
    LazyColumn { item { MonthHero(Modifier.height(180.dp)) } }
}

// Rule: every drawn control declares its semantics.
@Composable
fun SnoozeControl(onSnooze: () -> Unit) {
    // BAD: invisible to TalkBack and to the test framework
    Canvas(Modifier.size(44.dp).clickable(onClick = onSnooze)) { drawSnoozeGlyph() }
    // GOOD: description for accessibility, tag for UI tests
    Canvas(
        Modifier.size(44.dp).clickable(onClick = onSnooze)
            .semantics { contentDescription = "Snooze" }
            .testTag("agenda_snooze")
    ) { drawSnoozeGlyph() }
}

// Rule: merge composite rows so they read as one.
@Composable
fun AgendaRow(title: String, time: String, room: String) {
    // BAD: TalkBack stops on title, time, and room separately in every row
    Row { Text(title); Text(time); Text(room) }
    // GOOD: the merged tree announces the row as a single unit
    Row(Modifier.semantics(mergeDescendants = true) {}) { Text(title); Text(time); Text(room) }
}

@Composable fun Dot(modifier: Modifier) {}
@Composable fun MonthHero(modifier: Modifier) {}
fun DrawScope.drawSnoozeGlyph() {}
