package dev.gnm.aurita

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.tvprovider.media.tv.PreviewChannelHelper
import androidx.tvprovider.media.tv.TvContractCompat
import androidx.tvprovider.media.tv.WatchNextProgram

object TvSync {
    private const val TAG = "AuritaTvSync"

    fun syncWatchNext(context: Context) {
        val items = JellyfinClient.resume(context)
        Log.i(TAG, "resume returned ${items.size} item(s)")
        val helper = PreviewChannelHelper(context)

        val existing = HashMap<String, Long>()
        try {
            context.contentResolver.query(
                TvContractCompat.WatchNextPrograms.CONTENT_URI,
                arrayOf(
                    TvContractCompat.WatchNextPrograms._ID,
                    TvContractCompat.WatchNextPrograms.COLUMN_INTERNAL_PROVIDER_ID,
                ),
                null, null, null,
            )?.use { c ->
                while (c.moveToNext()) {
                    val ipid = c.getString(1) ?: continue
                    existing[ipid] = c.getLong(0)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "querying Watch Next failed", e)
        }

        val keep = HashSet<String>()
        for (item in items) {
            if (item.runtimeMs <= 0) continue
            keep.add(item.id)
            val program = WatchNextProgram.Builder()
                .setType(
                    if (item.type == "Episode") TvContractCompat.WatchNextPrograms.TYPE_TV_EPISODE
                    else TvContractCompat.WatchNextPrograms.TYPE_MOVIE
                )
                .setWatchNextType(TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_CONTINUE)
                .setTitle(if (item.seriesName != null) "${item.seriesName}: ${item.name}" else item.name)
                .setDurationMillis(item.runtimeMs.toInt())
                .setLastPlaybackPositionMillis(item.positionMs.toInt())
                .setLastEngagementTimeUtcMillis(System.currentTimeMillis())
                .setInternalProviderId(item.id)
                .setIntentUri(Uri.parse("aurita://open/play/${item.id}"))
                .also { b ->
                    item.wideImage?.let {
                        b.setPosterArtUri(Uri.parse(it))
                        b.setPosterArtAspectRatio(TvContractCompat.WatchNextPrograms.ASPECT_RATIO_16_9)
                    }
                }
                .build()
            try {
                val rowId = existing[item.id]
                if (rowId != null) {
                    helper.updateWatchNextProgram(program, rowId)
                    Log.i(TAG, "updated ${item.id} (row $rowId)")
                } else {
                    val newId = helper.publishWatchNextProgram(program)
                    Log.i(TAG, "published ${item.id} -> row $newId")
                }
            } catch (e: Throwable) {
                Log.w(TAG, "publishing ${item.id} failed: ${e.message}", e)
            }
        }

        for ((ipid, rowId) in existing) {
            if (ipid !in keep) {
                try {
                    context.contentResolver.delete(
                        TvContractCompat.buildWatchNextProgramUri(rowId), null, null
                    )
                } catch (_: Exception) {
                }
            }
        }
        Log.i(TAG, "Watch Next synced: ${keep.size} item(s)")
    }
}
