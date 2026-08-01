package dev.gnm.aurita

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build

object AudioOutput {

    fun maxChannels(context: Context): Int {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return 2
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return 2

        var best = 2
        val devices = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        for (device in devices) {
            if (!isExternalOrBuiltIn(device.type)) continue

            val counts = device.channelCounts
            if (counts.isNotEmpty()) {
                val max = counts.maxOrNull() ?: 2
                if (max > best) best = max
            }

            if (counts.isEmpty() && isSurroundCapableType(device.type) && best < 6) best = 6
        }
        return best.coerceIn(2, 8)
    }

    private fun isExternalOrBuiltIn(type: Int) = when (type) {
        AudioDeviceInfo.TYPE_HDMI,
        AudioDeviceInfo.TYPE_HDMI_ARC,
        AudioDeviceInfo.TYPE_AUX_LINE,
        AudioDeviceInfo.TYPE_LINE_DIGITAL,
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER,
        AudioDeviceInfo.TYPE_USB_DEVICE -> true
        else -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && type == AudioDeviceInfo.TYPE_HDMI_EARC
    }

    private fun isSurroundCapableType(type: Int) = when (type) {
        AudioDeviceInfo.TYPE_HDMI,
        AudioDeviceInfo.TYPE_HDMI_ARC,
        AudioDeviceInfo.TYPE_LINE_DIGITAL -> true
        else -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && type == AudioDeviceInfo.TYPE_HDMI_EARC
    }
}
