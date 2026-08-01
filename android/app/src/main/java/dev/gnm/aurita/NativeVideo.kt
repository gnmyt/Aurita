package dev.gnm.aurita

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.view.SurfaceView
import android.webkit.WebView
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import org.json.JSONObject

@UnstableApi
class NativeVideo(
    private val activity: Activity,
    private val surfaceView: SurfaceView,
    private val webView: WebView,
) {
    private var player: ExoPlayer? = null
    private var ticker: Runnable? = null

    private fun ensurePlayer(): ExoPlayer {
        player?.let { return it }

        val renderers = DefaultRenderersFactory(activity)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)
            .setEnableDecoderFallback(true)

        val trackSelector = DefaultTrackSelector(activity).apply {
            parameters = buildUponParameters()
                .setTunnelingEnabled(true)
                .build()
        }

        val loadControl = buildLoadControl()

        return ExoPlayer.Builder(activity, renderers)
            .setTrackSelector(trackSelector)
            .setLoadControl(loadControl)
            .build()
            .also { exo ->
                exo.setAudioAttributes(exo.audioAttributes, true)
                exo.setVideoSurfaceView(surfaceView)
                exo.addListener(listener)
                player = exo
            }
    }

    private fun buildLoadControl(): DefaultLoadControl {
        val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        val memInfo = ActivityManager.MemoryInfo().also { am?.getMemoryInfo(it) }

        val heapMb = am?.largeMemoryClass ?: 128
        val availableMb = (memInfo.availMem / (1024L * 1024L)).toInt()

        val targetMb = minOf(heapMb / 2, availableMb / 4).coerceIn(32, 512)
        val targetBytes = targetMb * 1024 * 1024

        val maxBufferMs = if (targetMb >= 256) 600_000 else if (targetMb >= 96) 300_000 else 120_000

        android.util.Log.i(
            "Aurita",
            "buffer: heap=${heapMb}MB avail=${availableMb}MB target=${targetMb}MB window=${maxBufferMs / 1000}s",
        )

        return DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                /* minBufferMs = */ 30_000,
                /* maxBufferMs = */ maxBufferMs,
                /* bufferForPlaybackMs = */ 2_000,
                /* bufferForPlaybackAfterRebufferMs = */ 8_000,
            )
            .setTargetBufferBytes(targetBytes)
            .setBackBuffer(30_000, true)
            .setPrioritizeTimeOverSizeThresholds(false)
            .build()
    }

    fun load(url: String, positionSeconds: Double, isHls: Boolean, token: String?) {
        activity.runOnUiThread {
            val exo = ensurePlayer()
            val http = DefaultHttpDataSource.Factory()
                .setAllowCrossProtocolRedirects(true)
                .apply {
                    if (!token.isNullOrEmpty()) {
                        setDefaultRequestProperties(mapOf("X-Emby-Token" to token))
                    }
                }

            val item = MediaItem.Builder().setUri(url)
                .apply { if (isHls) setMimeType(MimeTypes.APPLICATION_M3U8) }
                .build()

            val source: MediaSource = if (isHls) {
                HlsMediaSource.Factory(http).setAllowChunklessPreparation(true).createMediaSource(item)
            } else {
                DefaultMediaSourceFactory(http).createMediaSource(item)
            }

            surfaceView.visibility = SurfaceView.VISIBLE
            exo.setMediaSource(source)
            if (positionSeconds > 0) exo.seekTo((positionSeconds * 1000).toLong())
            exo.prepare()
            exo.playWhenReady = true
            startTicker()
        }
    }

    fun play() = activity.runOnUiThread { player?.playWhenReady = true }

    fun pause() = activity.runOnUiThread { player?.playWhenReady = false }

    fun seek(seconds: Double) = activity.runOnUiThread {
        player?.seekTo((seconds * 1000).toLong().coerceAtLeast(0))
    }

    fun setPlaybackRate(rate: Float) = activity.runOnUiThread {
        player?.setPlaybackSpeed(rate.coerceIn(0.25f, 4f))
    }

    fun setVolume(volume: Float) = activity.runOnUiThread {
        player?.volume = volume.coerceIn(0f, 1f)
    }

    fun release() = activity.runOnUiThread {
        stopTicker()
        surfaceView.visibility = SurfaceView.GONE
        player?.removeListener(listener)
        player?.setVideoSurfaceView(null)
        player?.release()
        player = null
    }

    private val listener = object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
            when (state) {
                Player.STATE_BUFFERING -> emit("waiting")
                Player.STATE_READY -> {
                    emit("loadedmetadata")
                    emit(if (player?.playWhenReady == true) "playing" else "pause")
                }
                Player.STATE_ENDED -> emit("ended")
                else -> {}
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            emit(if (isPlaying) "playing" else "pause")
        }

        override fun onPlayerError(error: PlaybackException) {
            emit("error", JSONObject().put("message", error.errorCodeName))
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int,
        ) {
            if (reason == Player.DISCONTINUITY_REASON_SEEK) emit("seeked")
        }
    }

    private fun startTicker() {
        stopTicker()
        val r = object : Runnable {
            override fun run() {
                emit("timeupdate")
                webView.postDelayed(this, 250)
            }
        }
        ticker = r
        webView.postDelayed(r, 250)
    }

    private fun stopTicker() {
        ticker?.let { webView.removeCallbacks(it) }
        ticker = null
    }

    private fun emit(type: String, extra: JSONObject? = null) {
        val exo = player ?: return
        val payload = (extra ?: JSONObject()).apply {
            put("type", type)
            put("currentTime", exo.currentPosition / 1000.0)
            put("duration", if (exo.duration > 0) exo.duration / 1000.0 else 0.0)
            put("paused", !exo.playWhenReady)
            put("buffered", exo.bufferedPosition / 1000.0)
            put("ready", exo.playbackState == Player.STATE_READY)
        }
        val js = "window.__auritaNativeVideoEvent && window.__auritaNativeVideoEvent($payload)"
        webView.evaluateJavascript(js, null)
    }
}
