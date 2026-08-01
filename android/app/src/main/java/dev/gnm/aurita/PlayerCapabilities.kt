package dev.gnm.aurita

import android.content.Context
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaFormat
import android.os.Build
import android.view.Display
import org.json.JSONArray
import org.json.JSONObject

object PlayerCapabilities {

    private data class Codec(val name: String, val mime: String)

    private val VIDEO = listOf(
        Codec("h264", MediaFormat.MIMETYPE_VIDEO_AVC),
        Codec("hevc", MediaFormat.MIMETYPE_VIDEO_HEVC),
        Codec("vp9", MediaFormat.MIMETYPE_VIDEO_VP9),
        Codec("av1", MediaFormat.MIMETYPE_VIDEO_AV1),
        Codec("vp8", MediaFormat.MIMETYPE_VIDEO_VP8),
        Codec("mpeg2video", MediaFormat.MIMETYPE_VIDEO_MPEG2),
    )

    private val AUDIO = listOf(
        Codec("aac", MediaFormat.MIMETYPE_AUDIO_AAC),
        Codec("mp3", MediaFormat.MIMETYPE_AUDIO_MPEG),
        Codec("ac3", MediaFormat.MIMETYPE_AUDIO_AC3),
        Codec("eac3", MediaFormat.MIMETYPE_AUDIO_EAC3),
        Codec("truehd", "audio/true-hd"),
        Codec("dts", "audio/vnd.dts"),
        Codec("flac", MediaFormat.MIMETYPE_AUDIO_FLAC),
        Codec("opus", MediaFormat.MIMETYPE_AUDIO_OPUS),
        Codec("vorbis", MediaFormat.MIMETYPE_AUDIO_VORBIS),
        Codec("pcm", MediaFormat.MIMETYPE_AUDIO_RAW),
    )

    private val codecList by lazy { MediaCodecList(MediaCodecList.REGULAR_CODECS) }

    private fun decoderFor(mime: String): MediaCodecInfo? = codecList.codecInfos.firstOrNull {
        !it.isEncoder && it.supportedTypes.any { t -> t.equals(mime, ignoreCase = true) }
    }

    private fun supports(mime: String) = decoderFor(mime) != null

    private fun supportsTenBit(mime: String, tenBitProfiles: Set<Int>): Boolean {
        val info = decoderFor(mime) ?: return false
        return try {
            info.getCapabilitiesForType(mime).profileLevels.any { it.profile in tenBitProfiles }
        } catch (e: IllegalArgumentException) {
            false
        }
    }

    private fun maxVideoWidth(mime: String): Int {
        val info = decoderFor(mime) ?: return 1920
        return try {
            info.getCapabilitiesForType(mime).videoCapabilities?.supportedWidths?.upper ?: 1920
        } catch (e: IllegalArgumentException) {
            1920
        }
    }

    private fun hdrTypes(context: Context): Set<Int> {
        val display: Display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            context.display
        } else {
            @Suppress("DEPRECATION")
            (context.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager).defaultDisplay
        } ?: return emptySet()

        @Suppress("DEPRECATION")
        val caps = display.hdrCapabilities ?: return emptySet()
        return caps.supportedHdrTypes.toSet()
    }

    fun toJson(context: Context): String {
        val video = JSONArray()
        VIDEO.filter { supports(it.mime) }.forEach { video.put(it.name) }
        if (video.length() == 0) video.put("h264")

        val audio = JSONArray()
        AUDIO.filter { supports(it.mime) }.forEach { audio.put(it.name) }

        val hdr = hdrTypes(context)
        val hdr10 = hdr.contains(1) || hdr.contains(2) // DOLBY_VISION=1, HDR10=2
        val hlg = hdr.contains(3)
        val dolbyVision = hdr.contains(1)
        val hdr10Plus = hdr.contains(4)

        val hevc10 = supportsTenBit(
            MediaFormat.MIMETYPE_VIDEO_HEVC,
            setOf(MediaCodecInfo.CodecProfileLevel.HEVCProfileMain10,
                MediaCodecInfo.CodecProfileLevel.HEVCProfileMain10HDR10),
        )
        val vp910 = supportsTenBit(
            MediaFormat.MIMETYPE_VIDEO_VP9,
            setOf(MediaCodecInfo.CodecProfileLevel.VP9Profile2,
                MediaCodecInfo.CodecProfileLevel.VP9Profile2HDR),
        )
        val av110 = supportsTenBit(
            MediaFormat.MIMETYPE_VIDEO_AV1,
            setOf(MediaCodecInfo.CodecProfileLevel.AV1ProfileMain10),
        )

         val maxChannels = AudioOutput.maxChannels(context)

        return JSONObject().apply {
            put("videoCodecs", video)
            put("audioCodecs", audio)
            put("maxAudioChannels", maxChannels)
            put("hdr10", hdr10 || hdr10Plus)
            put("hlg", hlg)
            put("dolbyVision", dolbyVision)
            put("hevc10", hevc10)
            put("vp910", vp910)
            put("av110", av110)
            put("maxWidth", maxVideoWidth(MediaFormat.MIMETYPE_VIDEO_HEVC)
                .coerceAtLeast(maxVideoWidth(MediaFormat.MIMETYPE_VIDEO_AVC)))
        }.toString()
    }
}
