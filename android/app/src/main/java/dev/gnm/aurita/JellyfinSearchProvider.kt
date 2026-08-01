package dev.gnm.aurita

import android.app.SearchManager
import android.content.ContentProvider
import android.content.ContentValues
import android.content.UriMatcher
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.provider.BaseColumns

class JellyfinSearchProvider : ContentProvider() {
    private val matcher = UriMatcher(UriMatcher.NO_MATCH).apply {
        addURI(AUTHORITY, SearchManager.SUGGEST_URI_PATH_QUERY, SEARCH)
        addURI(AUTHORITY, "${SearchManager.SUGGEST_URI_PATH_QUERY}/*", SEARCH)
    }

    override fun onCreate() = true

    override fun query(
        uri: Uri, projection: Array<String>?, selection: String?,
        selectionArgs: Array<String>?, sortOrder: String?,
    ): Cursor {
        val c = empty()
        if (matcher.match(uri) != SEARCH) return c
        val term = (selectionArgs?.firstOrNull() ?: uri.lastPathSegment).orEmpty().trim()
        if (term.isEmpty() || term == SearchManager.SUGGEST_URI_PATH_QUERY) return c
        val ctx = context ?: return c

        val items = try { JellyfinClient.search(ctx, term) } catch (e: Exception) { emptyList() }
        for (it in items) {
            val route = if (it.type == "Episode") "play/${it.id}" else "detail/${it.id}"

            c.addRow(arrayOf<Any?>(
                it.id,
                it.name,
                it.seriesName ?: it.type,
                it.posterImage ?: it.wideImage,
                it.year,
                if (it.runtimeMs > 0) it.runtimeMs else null,
                route,
            ))
        }
        return c
    }

    private fun empty() = MatrixCursor(arrayOf(
        BaseColumns._ID,
        SearchManager.SUGGEST_COLUMN_TEXT_1,
        SearchManager.SUGGEST_COLUMN_TEXT_2,
        SearchManager.SUGGEST_COLUMN_RESULT_CARD_IMAGE,
        SearchManager.SUGGEST_COLUMN_PRODUCTION_YEAR,
        SearchManager.SUGGEST_COLUMN_DURATION,
        SearchManager.SUGGEST_COLUMN_INTENT_DATA_ID,
    ))

    override fun getType(uri: Uri) = SearchManager.SUGGEST_MIME_TYPE
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?) = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<String>?) = 0

    companion object {
        const val AUTHORITY = "dev.gnm.aurita.search"
        private const val SEARCH = 1
    }
}
