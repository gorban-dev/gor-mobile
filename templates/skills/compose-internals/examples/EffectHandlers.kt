// Companion to references/side-effects.md — weather-station domain, own scenarios.
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.launch

data class Forecast(val cityId: String, val tempC: Int)
class ForecastRepo {
    fun blockingLoad(cityId: String): Forecast = Forecast(cityId, 0)
    suspend fun loadForecast(cityId: String): Forecast = Forecast(cityId, 0)
    suspend fun refreshAll() {}
}

// Rule: never run a side effect in the composable body.

// BAD: fetch fires on EVERY recomposition, from any thread, never cancelled
@Composable
fun ForecastPaneBad(repo: ForecastRepo, cityId: String) {
    val forecast = repo.blockingLoad(cityId)
    ForecastCard(forecast)
}

// GOOD: the composition owns the load — started on enter, cancelled on leave, relaunched per city
@Composable
fun ForecastPaneGood(repo: ForecastRepo, cityId: String) {
    var forecast by remember { mutableStateOf<Forecast?>(null) }
    LaunchedEffect(repo, cityId) { forecast = repo.loadForecast(cityId) }
    ForecastCard(forecast)
}

// Rule: subscriptions go through DisposableEffect; onDispose is mandatory.

class StormAlertBus { fun subscribe(onAlert: (String) -> Unit): Subscription = Subscription() }
class Subscription { fun cancel() {} }

// BAD: subscribes in the body — resubscribes every pass and the callback leaks past the composable
@Composable
fun StormBannerBad(bus: StormAlertBus) {
    bus.subscribe { /* show banner */ }
}

// GOOD: subscribed on enter and on key change, cancelled when the composable leaves
@Composable
fun StormBannerGood(bus: StormAlertBus) {
    DisposableEffect(bus) {
        val sub = bus.subscribe { /* show banner */ }
        onDispose { sub.cancel() }
    }
}

// Rule: publish composed state to non-Compose objects via SideEffect.

class LegacyRadarView { var sweepEnabled = false }

@Composable
fun RadarPanel(legacyRadar: LegacyRadarView, tracking: Boolean) {
    // BAD: publishes from a composition that may still be thrown away
    legacyRadar.sweepEnabled = tracking
    // GOOD: runs only after the composition applies successfully
    SideEffect { legacyRadar.sweepEnabled = tracking }
}

// Rule: interaction-started coroutines use rememberCoroutineScope, not LaunchedEffect.

// BAD: a state flag smuggles a click into composition-owned work — wrong owner for the job
@Composable
fun RefreshButtonBad(repo: ForecastRepo) {
    var refreshTick by remember { mutableStateOf(0) }
    LaunchedEffect(refreshTick) { if (refreshTick > 0) repo.refreshAll() }
    Button(onClick = { refreshTick++ }) { Text("Refresh") }
}

// GOOD: a composition-scoped scope callable from plain callbacks; jobs die with the composable
@Composable
fun RefreshButtonGood(repo: ForecastRepo) {
    val scope = rememberCoroutineScope()
    Button(onClick = { scope.launch { repo.refreshAll() } }) { Text("Refresh") }
}

// Rule: every varying input the effect body uses must be a key.

class WindFeed { suspend fun awaitSpeed(stationId: String): Int = 0 }

@Composable
fun WindBadge(feed: WindFeed, stationId: String) {
    // BAD: no key means keyed on Unit — a station switch never restarts the producer
    val staleSpeed by produceState(initialValue = 0) { value = feed.awaitSpeed(stationId) }
    // GOOD: producer cancelled and relaunched when the station changes
    val speed by produceState(initialValue = 0, feed, stationId) { value = feed.awaitSpeed(stationId) }
    Text("$speed m/s")
}

// Rule: bridge snapshot state into coroutines with snapshotFlow.

class UnitPrefs { val unit = mutableStateOf("C") }

@Composable
fun UnitChangeReporter(prefs: UnitPrefs, analytics: (String) -> Unit) {
    // BAD: one-shot read — later unit changes never reach analytics
    LaunchedEffect(Unit) { analytics(prefs.unit.value) }
    // GOOD: re-runs its block and emits whenever any state read inside it changes
    LaunchedEffect(prefs, analytics) {
        snapshotFlow { prefs.unit.value }.collect { analytics(it) }
    }
}

@Composable fun ForecastCard(forecast: Forecast?) { Text(forecast?.cityId ?: "…") }
