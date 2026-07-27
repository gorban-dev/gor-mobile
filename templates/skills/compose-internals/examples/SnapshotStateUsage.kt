// Companion to references/snapshot-state.md — photo-upload domain, own scenarios.
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.snapshots.Snapshot
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

// Rule: observable data must live in snapshot state.

// BAD: plain field — a write creates no state record and never invalidates a RecomposeScope
class UploadQueueBad { var pendingCount = 0 }

// GOOD: every read is tracked, every write invalidates exactly the scopes that read it
class UploadQueue {
    val pendingCount = mutableStateOf(0)
    val items = mutableStateListOf<String>()
}

// Rule: a read is a subscription only inside an observed scope.

class UploadSession { val isCancelled = mutableStateOf(false) }
fun abortTransfers() {}

fun watchCancellationBad(scope: CoroutineScope, session: UploadSession) {
    // BAD: one-shot read in a coroutine — nothing re-runs when the flag flips later
    scope.launch { if (session.isCancelled.value) abortTransfers() }
}

fun watchCancellationGood(scope: CoroutineScope, session: UploadSession) {
    // GOOD: snapshotFlow records the read and re-emits on every write to that state
    scope.launch {
        snapshotFlow { session.isCancelled.value }.first { it }
        abortTransfers()
    }
}

// Rule: group related writes so they publish atomically.

class AlbumTotals {
    val photoCount = mutableStateOf(0)
    val byteCount = mutableStateOf(0L)
}

fun registerUploadBad(totals: AlbumTotals, sizeBytes: Long) {
    // BAD: two independent global writes — a reader can see the new count with the old bytes
    totals.photoCount.value++
    totals.byteCount.value += sizeBytes
}

fun registerUploadGood(totals: AlbumTotals, sizeBytes: Long) {
    // GOOD: both writes land in one atomic apply — all-or-nothing for every other snapshot
    Snapshot.withMutableSnapshot {
        totals.photoCount.value++
        totals.byteCount.value += sizeBytes
    }
}

// Rule: any thread may write, but the default policy cannot merge collisions.

fun countFinishedBad(scope: CoroutineScope, finished: MutableState<Int>) {
    // BAD: four workers bump one default-policy state — colliding applies throw, not sum
    repeat(4) { scope.launch { finished.value++ } }
}

// GOOD: a policy with a well-defined merge combines concurrent deltas deterministically
// (additiveCountPolicy: a custom SnapshotMutationPolicy whose merge sums both deltas)
val finishedMergeable = mutableStateOf(0, additiveCountPolicy())

// Rule: explicit snapshots have a lifecycle — always dispose.

class Gallery
fun rasterize(gallery: Gallery) {}

fun renderThumbnailBad(gallery: Gallery) {
    // BAD: never disposed — the snapshot pins its state versions forever
    val still = Snapshot.takeSnapshot()
    still.enter { rasterize(gallery) }
}

fun renderThumbnailGood(gallery: Gallery) {
    // GOOD: bounded lifespan — pinned records are released on dispose
    val still = Snapshot.takeSnapshot()
    try { still.enter { rasterize(gallery) } } finally { still.dispose() }
}

// Rule: background reads of several objects go through a read-only snapshot.

class PhotoMeta {
    val title = mutableStateOf("")
    val location = mutableStateOf("")
}

fun exportMetaBad(meta: PhotoMeta): Pair<String, String> {
    // BAD: two unscoped reads — the UI may write between them, mixing state versions
    return meta.title.value to meta.location.value
}

fun exportMetaGood(meta: PhotoMeta): Pair<String, String> {
    // GOOD: enter gives every read in the block the same point-in-time version
    val snap = Snapshot.takeSnapshot()
    try {
        return snap.enter { meta.title.value to meta.location.value }
    } finally {
        snap.dispose()
    }
}
