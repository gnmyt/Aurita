package dev.gnm.aurita

import android.content.Context
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class JfItem(
    val id: String,
    val name: String,
    val type: String,
    val seriesName: String?,
    val year: Int?,
    val runtimeMs: Long,
    val positionMs: Long,

    val wideImage: String?,

    val posterImage: String?,
)

object JellyfinClient {
    private const val PREFS = "jt_native_auth"
    private const val FIELDS = "ProductionYear,RunTimeTicks,SeriesName,UserData"

    data class Auth(val server: String, val userId: String, val token: String)

    fun saveAuth(context: Context, server: String?, userId: String?, token: String?) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("server", (server ?: "").trimEnd('/'))
            .putString("userId", userId ?: "")
            .putString("token", token ?: "")
            .apply()
    }

    fun auth(context: Context): Auth? {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val s = p.getString("server", "").orEmpty()
        val u = p.getString("userId", "").orEmpty()
        val t = p.getString("token", "").orEmpty()
        if (s.isEmpty() || u.isEmpty() || t.isEmpty()) return null
        return Auth(s, u, t)
    }

    fun resume(context: Context): List<JfItem> {
        val a = auth(context) ?: return emptyList()
        val json = get(a, "/Users/${a.userId}/Items/Resume?Limit=24&MediaTypes=Video&Recursive=true" +
            "&Fields=$FIELDS&EnableImageTypes=Primary,Backdrop,Thumb") ?: return emptyList()
        return parse(a, json)
    }

    fun search(context: Context, term: String): List<JfItem> {
        val a = auth(context) ?: return emptyList()
        val json = get(a, "/Users/${a.userId}/Items?SearchTerm=${enc(term)}&Recursive=true" +
            "&IncludeItemTypes=Movie,Series,Episode&Limit=20&Fields=$FIELDS" +
            "&EnableImageTypes=Primary,Backdrop,Thumb") ?: return emptyList()
        return parse(a, json)
    }

    private fun get(a: Auth, path: String): JSONObject? {
        val conn = (URL(a.server + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10000
            readTimeout = 15000
            setRequestProperty("X-Emby-Token", a.token)
            setRequestProperty("X-Emby-Authorization",
                "MediaBrowser Client=\"Aurita-TV\", Device=\"AndroidTV\", DeviceId=\"aurita-native\", Version=\"1.0\"")
            setRequestProperty("Accept", "application/json")
        }
        return try {
            if (conn.responseCode / 100 != 2) null
            else JSONObject(conn.inputStream.bufferedReader().use(BufferedReader::readText))
        } catch (e: Exception) {
            null
        } finally {
            conn.disconnect()
        }
    }

    private fun parse(a: Auth, json: JSONObject): List<JfItem> {
        val arr = json.optJSONArray("Items") ?: return emptyList()
        val out = ArrayList<JfItem>(arr.length())
        for (i in 0 until arr.length()) {
            val it = arr.optJSONObject(i) ?: continue
            val id = it.optString("Id"); if (id.isEmpty()) continue
            val ud = it.optJSONObject("UserData")
            out.add(JfItem(
                id = id,
                name = it.optString("Name"),
                type = it.optString("Type"),
                seriesName = it.optString("SeriesName").ifEmpty { null },
                year = if (it.has("ProductionYear")) it.optInt("ProductionYear") else null,
                runtimeMs = it.optLong("RunTimeTicks", 0L) / 10_000,
                positionMs = (ud?.optLong("PlaybackPositionTicks", 0L) ?: 0L) / 10_000,
                wideImage = wide(a, it),
                posterImage = primary(a, it),
            ))
        }
        return out
    }

    private fun img(a: Auth, id: String, type: String, tag: String, w: Int) =
        "${a.server}/Items/$id/Images/$type?tag=$tag&quality=90&maxWidth=$w"

    private fun primary(a: Auth, it: JSONObject): String? {
        val tag = it.optJSONObject("ImageTags")?.optString("Primary").orEmpty()
        return if (tag.isEmpty()) null else img(a, it.optString("Id"), "Primary", tag, 400)
    }

    private fun wide(a: Auth, it: JSONObject): String? {
        val id = it.optString("Id")
        val tags = it.optJSONObject("ImageTags")
        if (it.optString("Type") == "Episode" && (tags?.optString("Primary").orEmpty()).isNotEmpty())
            return img(a, id, "Primary", tags!!.getString("Primary"), 600)
        if ((tags?.optString("Thumb").orEmpty()).isNotEmpty())
            return img(a, id, "Thumb", tags!!.getString("Thumb"), 600)
        it.optJSONArray("BackdropImageTags")?.let { if (it.length() > 0) return img(a, id, "Backdrop", it.getString(0), 600) }
        val ptTag = it.optString("ParentThumbImageTag"); val ptId = it.optString("ParentThumbItemId")
        if (ptTag.isNotEmpty() && ptId.isNotEmpty()) return img(a, ptId, "Thumb", ptTag, 600)
        val pbId = it.optString("ParentBackdropItemId")
        it.optJSONArray("ParentBackdropImageTags")?.let { if (it.length() > 0 && pbId.isNotEmpty()) return img(a, pbId, "Backdrop", it.getString(0), 600) }
        return primary(a, it)
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
}
