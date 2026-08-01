package dev.gnm.aurita

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class SyncWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        return try {
            if (JellyfinClient.auth(applicationContext) == null) return Result.success()
            TvSync.syncWatchNext(applicationContext)
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
