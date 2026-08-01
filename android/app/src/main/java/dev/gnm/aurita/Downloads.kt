package dev.gnm.aurita

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object Downloads {

    private const val PREFS = "aurita_downloads"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun manager(context: Context) =
        context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

    private fun root(context: Context): File =
        File(context.getExternalFilesDir(Environment.DIRECTORY_MOVIES), "downloads")

    fun folderFor(context: Context, itemId: String): File = File(root(context), itemId)

    private fun readAll(context: Context): JSONObject {
        val raw = prefs(context).getString("items", "{}") ?: "{}"
        return runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
    }

    private fun writeAll(context: Context, all: JSONObject) {
        prefs(context).edit().putString("items", all.toString()).apply()
    }

    fun enqueue(
        context: Context,
        itemId: String,
        url: String,
        posterUrl: String?,
        itemJson: String,
        container: String,
    ) {
        val all = readAll(context)
        if (all.has(itemId) && all.getJSONObject(itemId).optInt("state", 0) != STATE_FAILED) return

        val folder = folderFor(context, itemId)
        folder.mkdirs()
        File(folder, "item.json").writeText(itemJson)

        val ext = container.ifBlank { "mp4" }
        val mediaFile = File(folder, "media.$ext")

        val request = DownloadManager.Request(Uri.parse(url))
            .setDestinationUri(Uri.fromFile(mediaFile))
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(false)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_HIDDEN)
        val downloadId = manager(context).enqueue(request)

        var posterId = -1L
        if (!posterUrl.isNullOrBlank()) {
            val posterFile = File(folder, "poster.jpg")
            posterId = runCatching {
                manager(context).enqueue(
                    DownloadManager.Request(Uri.parse(posterUrl))
                        .setDestinationUri(Uri.fromFile(posterFile))
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_HIDDEN),
                )
            }.getOrDefault(-1L)
        }

        all.put(itemId, JSONObject().apply {
            put("downloadId", downloadId)
            put("posterId", posterId)
            put("file", mediaFile.absolutePath)
            put("state", STATE_RUNNING)
        })
        writeAll(context, all)
    }

    fun remove(context: Context, itemId: String) {
        val all = readAll(context)
        val entry = all.optJSONObject(itemId) ?: return
        runCatching { manager(context).remove(entry.optLong("downloadId", -1)) }
        runCatching { manager(context).remove(entry.optLong("posterId", -1)) }
        folderFor(context, itemId).deleteRecursively()
        all.remove(itemId)
        writeAll(context, all)
    }

    fun status(context: Context): String {
        val all = readAll(context)
        val out = JSONArray()
        var dirty = false

        for (itemId in all.keys().asSequence().toList()) {
            val entry = all.getJSONObject(itemId)
            val file = File(entry.optString("file"))
            val row = JSONObject().put("itemId", itemId)

            val query = DownloadManager.Query().setFilterById(entry.optLong("downloadId", -1))
            var state = entry.optInt("state", STATE_RUNNING)
            var progress = 0.0

            manager(context).query(query).use { c ->
                if (c != null && c.moveToFirst()) {
                    val statusCol = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                    val soFar = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                    val total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                    if (total > 0) progress = soFar.toDouble() / total
                    state = when (statusCol) {
                        DownloadManager.STATUS_SUCCESSFUL -> STATE_DONE
                        DownloadManager.STATUS_FAILED -> STATE_FAILED
                        else -> STATE_RUNNING
                    }
                } else if (file.exists()) {
                    state = STATE_DONE
                    progress = 1.0
                } else {
                    state = STATE_FAILED
                }
            }

            if (state == STATE_DONE && !file.exists()) state = STATE_FAILED
            if (state != entry.optInt("state", -1)) {
                entry.put("state", state)
                dirty = true
            }

            row.put("state", state)
            row.put("progress", if (state == STATE_DONE) 1.0 else progress)
            row.put("path", if (state == STATE_DONE) file.absolutePath else null)
            val poster = File(folderFor(context, itemId), "poster.jpg")
            row.put("poster", if (poster.exists()) poster.absolutePath else null)
            val meta = File(folderFor(context, itemId), "item.json")
            row.put("item", if (meta.exists()) runCatching { meta.readText() }.getOrNull() else null)
            out.put(row)
        }

        if (dirty) writeAll(context, all)
        return out.toString()
    }

    const val STATE_RUNNING = 0
    const val STATE_DONE = 1
    const val STATE_FAILED = 2
}
