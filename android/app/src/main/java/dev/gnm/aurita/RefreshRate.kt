package dev.gnm.aurita

import android.app.Activity
import android.os.Build
import android.view.Display
import kotlin.math.abs

object RefreshRate {

    private var originalModeId: Int? = null

    private fun candidates(display: Display, width: Int, height: Int): List<Display.Mode> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return emptyList()
        return display.supportedModes.filter {
            it.physicalWidth == width && it.physicalHeight == height
        }
    }

    private fun error(displayHz: Float, contentFps: Float): Float {
        if (contentFps <= 0f) return Float.MAX_VALUE
        val multiple = (displayHz / contentFps).let { Math.round(it) }
        if (multiple < 1) return Float.MAX_VALUE
        return abs(displayHz - contentFps * multiple)
    }

    fun apply(activity: Activity, contentFps: Float) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        if (contentFps <= 0f || contentFps.isNaN()) return

        val display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activity.display
        } else {
            @Suppress("DEPRECATION")
            activity.windowManager.defaultDisplay
        } ?: return

        val current = display.mode ?: return
        if (originalModeId == null) originalModeId = current.modeId

        val options = candidates(display, current.physicalWidth, current.physicalHeight)
        if (options.isEmpty()) return

        val best = options
            .filter { error(it.refreshRate, contentFps) < 0.15f }
            .minByOrNull { it.refreshRate }
            ?: options.minByOrNull { error(it.refreshRate, contentFps) }
            ?: return

        if (best.modeId == current.modeId) return

        android.util.Log.i(
            "Aurita",
            "refresh rate: content=${contentFps}fps display=${current.refreshRate}Hz -> ${best.refreshRate}Hz",
        )

        activity.runOnUiThread {
            activity.window.attributes = activity.window.attributes.apply {
                preferredDisplayModeId = best.modeId
            }
        }
    }

    fun restore(activity: Activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val id = originalModeId ?: return
        originalModeId = null
        activity.runOnUiThread {
            activity.window.attributes = activity.window.attributes.apply {
                preferredDisplayModeId = id
            }
        }
    }
}
