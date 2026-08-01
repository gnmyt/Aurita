import {getCapabilities, platform} from './capabilities';

const VIDEO_CONTAINERS = ['mp4', 'm4v', 'mov'];

const videoRangeTypes = (codec, caps) => {
    const {hdr} = caps;
    const types = ['SDR'];
    if (codec === 'h264') return types.join('|');
    if (hdr.hdr10) types.push('HDR10', 'HDR10Plus');
    if (hdr.hlg) types.push('HLG');
    if (codec === 'hevc' && hdr.dolbyVision) {
        types.push('DOVI', 'DOVIWithHDR10', 'DOVIWithHLG', 'DOVIWithSDR');
    } else if (codec === 'hevc' && hdr.hdr10) {
        types.push('DOVIWithHDR10', 'DOVIWithSDR');
    }
    return types.join('|');
}

const directPlayProfiles = (caps, forceTranscode) => {
    if (forceTranscode) return [];
    const video = caps.videoCodecs.join(',');
    const audio = caps.audioCodecs.join(',');
    const profiles = [
        {Container: VIDEO_CONTAINERS.join(','), Type: 'Video', VideoCodec: video, AudioCodec: audio},
    ];
    if (caps.containers.mkv) {
        profiles.push({Container: 'mkv', Type: 'Video', VideoCodec: video, AudioCodec: audio});
    }
    if (caps.containers.webm) {
        profiles.push({Container: 'webm', Type: 'Video', VideoCodec: 'vp8,vp9,av1', AudioCodec: 'vorbis,opus'});
    }
    if (caps.containers.ts) {
        profiles.push({Container: 'ts,mpegts', Type: 'Video', VideoCodec: video, AudioCodec: audio});
    }
    profiles.push({Container: 'mp3', Type: 'Audio'});
    profiles.push({Container: 'aac', Type: 'Audio'});
    if (caps.audioCodecs.includes('flac')) profiles.push({Container: 'flac', Type: 'Audio'});
    if (caps.audioCodecs.includes('opus')) profiles.push({Container: 'opus', Type: 'Audio'});
    return profiles;
}

const codecProfiles = (caps) => {
    const out = [];
    const max = caps.maxResolution;

    out.push({
        Type: 'Video',
        Codec: 'h264',
        Conditions: [
            {Condition: 'NotEquals', Property: 'IsAnamorphic', Value: 'true', IsRequired: false},
            {Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'high|main|baseline|constrained baseline', IsRequired: false},
            {Condition: 'EqualsAny', Property: 'VideoRangeType', Value: videoRangeTypes('h264', caps), IsRequired: false},
            {Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '52', IsRequired: false},
            {Condition: 'LessThanEqual', Property: 'Width', Value: String(max), IsRequired: false},
        ],
    });

    if (caps.videoCodecs.includes('hevc')) {
        const profiles = caps.tenBit.hevc ? 'main|main 10' : 'main';
        out.push({
            Type: 'Video',
            Codec: 'hevc',
            Conditions: [
                {Condition: 'NotEquals', Property: 'IsAnamorphic', Value: 'true', IsRequired: false},
                {Condition: 'EqualsAny', Property: 'VideoProfile', Value: profiles, IsRequired: false},
                {Condition: 'EqualsAny', Property: 'VideoRangeType', Value: videoRangeTypes('hevc', caps), IsRequired: false},
                {Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '183', IsRequired: false},
                {Condition: 'LessThanEqual', Property: 'Width', Value: String(max), IsRequired: false},
            ],
        });
    }

    if (caps.videoCodecs.includes('vp9')) {
        out.push({
            Type: 'Video',
            Codec: 'vp9',
            Conditions: [
                {Condition: 'EqualsAny', Property: 'VideoRangeType', Value: videoRangeTypes('vp9', caps), IsRequired: false},
                {Condition: 'LessThanEqual', Property: 'Width', Value: String(max), IsRequired: false},
            ],
        });
    }

    if (caps.videoCodecs.includes('av1')) {
        const profiles = caps.tenBit.av1 ? 'main' : 'main';
        out.push({
            Type: 'Video',
            Codec: 'av1',
            Conditions: [
                {Condition: 'EqualsAny', Property: 'VideoProfile', Value: profiles, IsRequired: false},
                {Condition: 'EqualsAny', Property: 'VideoRangeType', Value: videoRangeTypes('av1', caps), IsRequired: false},
                {Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '19', IsRequired: false},
                {Condition: 'LessThanEqual', Property: 'Width', Value: String(max), IsRequired: false},
            ],
        });
    }

    out.push({
        Type: 'VideoAudio',
        Conditions: [
            {Condition: 'LessThanEqual', Property: 'AudioChannels', Value: String(caps.maxAudioChannels), IsRequired: false},
        ],
    });

    return out;
}

const transcodingProfiles = (caps) => {
    const out = [];
    const hlsAudio = ['aac'];
    if (caps.audioCodecs.includes('ac3') && caps.maxAudioChannels > 2) hlsAudio.push('ac3');
    if (caps.audioCodecs.includes('eac3') && caps.maxAudioChannels > 2) hlsAudio.push('eac3');
    hlsAudio.push('mp3');

    if (caps.videoCodecs.includes('hevc') && caps.native) {
        out.push({
            Container: 'mp4', Type: 'Video', VideoCodec: 'hevc,h264', AudioCodec: hlsAudio.join(','),
            Protocol: 'hls', Context: 'Streaming', MinSegments: 1, BreakOnNonKeyFrames: false,
            MaxAudioChannels: String(caps.maxAudioChannels),
        });
    }

    out.push({
        Container: 'ts', Type: 'Video', VideoCodec: 'h264', AudioCodec: hlsAudio.join(','),
        Protocol: 'hls', Context: 'Streaming', MinSegments: 1, BreakOnNonKeyFrames: true,
        MaxAudioChannels: String(caps.maxAudioChannels),
    });

    out.push({
        Container: 'mp4', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac',
        Protocol: 'http', Context: 'Static', MaxAudioChannels: String(caps.maxAudioChannels),
    });

    out.push({Container: 'mp3', Type: 'Audio', AudioCodec: 'mp3', Context: 'Streaming', Protocol: 'http'});
    out.push({Container: 'aac', Type: 'Audio', AudioCodec: 'aac', Context: 'Streaming', Protocol: 'http'});

    return out;
}

const subtitleProfiles = () => [
    {Format: 'vtt', Method: 'External'},
    {Format: 'srt', Method: 'External'},
    {Format: 'subrip', Method: 'External'},
    {Format: 'ass', Method: 'External'},
    {Format: 'ssa', Method: 'External'},
    {Format: 'pgssub', Method: 'Encode'},
    {Format: 'dvdsub', Method: 'Encode'},
    {Format: 'dvbsub', Method: 'Encode'},
];

export const buildDeviceProfile = (maxBitrate, {forceTranscode = false} = {}) => {
    const caps = getCapabilities();
    return {
        MaxStreamingBitrate: maxBitrate,
        MaxStaticBitrate: maxBitrate,
        MusicStreamingTranscodingBitrate: 384000,
        DirectPlayProfiles: directPlayProfiles(caps, forceTranscode),
        TranscodingProfiles: transcodingProfiles(caps),
        CodecProfiles: codecProfiles(caps),
        SubtitleProfiles: subtitleProfiles(),
        ResponseProfiles: [
            {Type: 'Video', Container: 'm4v', MimeType: 'video/mp4'},
        ],
    };
}

export const describeCapabilities = () => {
    const caps = getCapabilities();
    return {
        player: caps.native ? 'native' : 'browser',
        platform: platform.tizen ? 'tizen' : platform.webos ? 'webos'
            : platform.webview ? 'android-webview' : platform.androidTv ? 'android-tv' : 'browser',
        video: caps.videoCodecs,
        audio: caps.audioCodecs,
        channels: caps.maxAudioChannels,
        hdr: Object.entries(caps.hdr).filter(([, v]) => v).map(([k]) => k),
        maxResolution: caps.maxResolution,
        containers: Object.entries(caps.containers).filter(([, v]) => v).map(([k]) => k),
    };
}
