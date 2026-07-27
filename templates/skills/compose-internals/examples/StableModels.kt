// Companion to references/stability.md — flight-booking domain, own scenarios.
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import kotlinx.collections.immutable.ImmutableList

// Rule: model composable inputs as all-val data classes of stable types.

// BAD: one var breaks the notify-on-change promise — every composable taking this stops skipping
data class SeatSelectionBad(var seatNumber: String, val cabinClass: String)

// GOOD: read-only fields of stable types — inference proves stability; mutate via copy()
data class SeatSelection(val seatNumber: String, val cabinClass: String)

// Rule: never take stdlib collections as composable parameters.

data class Flight(val code: String, val departsAtMin: Int)

// BAD: List is an interface — a mutable ArrayList can hide behind it, so it is assumed unstable
@Composable
fun ItineraryBad(legs: List<Flight>) { legs.forEach { Text(it.code) } }

// GOOD: provably immutable collection type restores skippability
@Composable
fun Itinerary(legs: ImmutableList<Flight>) { legs.forEach { Text(it.code) } }

// GOOD: alternative — a wrapper whose stability you vouch for
@Immutable
data class FlightLegs(val legs: List<Flight>)

// Rule: @Immutable only when nothing public ever changes after construction.

// BAD: the val points at a list the booking engine mutates later — skipped UI shows stale data
@Immutable
class BoardingGroupBad(val passengers: MutableList<String>)

// GOOD: deep immutability — primitives and immutable members only
@Immutable
data class BoardingPass(val gate: String, val seq: Int)

// Rule: @Stable for types mutable inside but stable from outside.

// GOOD: an interface-typed parameter would be assumed unstable — the annotation
// imposes the three stability promises on every implementor
@Stable
interface CheckInUiState {
    val passengerName: String?
    val boardingBlocked: Boolean
}
// Do NOT annotate plain all-val data classes: inference already covers them and cannot go stale.

// Rule: no custom getters that recompute on stable model types.

object FareEngine { fun surcharge(routeCode: String): Int = 0 }

// BAD: each read consults external state — equal instances can compare differently over time
data class FareBad(val baseCents: Int, val routeCode: String) {
    val totalCents: Int get() = baseCents + FareEngine.surcharge(routeCode)
}

// GOOD: plain stored value; publish changes by emitting a new instance
data class Fare(val baseCents: Int, val totalCents: Int)

// Rule: lambdas passed to composables must capture only stable values.

class BookingController { fun rebook(flightCode: String) {} } // assumed unstable

@Composable
fun RebookRow(controller: BookingController, flightCode: String) {
    // BAD: unstable capture switches lambda memoization off — a fresh instance per pass
    RebookButton(onRebook = { controller.rebook(flightCode) })
    // GOOD: remember on explicit stable keys — same instance until flightCode changes
    val onRebook = remember(flightCode) { { rebookByCode(flightCode) } }
    RebookButton(onRebook = onRebook)
}

fun rebookByCode(code: String) {}
@Composable fun RebookButton(onRebook: () -> Unit) {}
