export const SUB_SIZES = [
    {key: 'small', labelKey: 'media.subtitleSize.small', px: '24px'},
    {key: 'normal', labelKey: 'media.subtitleSize.normal', px: '30px'},
    {key: 'large', labelKey: 'media.subtitleSize.large', px: '40px'},
];

export const getSubSize = () => {
    return localStorage.getItem('jf_subSize') || 'normal';
}

export const getSubBg = () => {
    return (localStorage.getItem('jf_subBg') || 'on') === 'on';
}

export const applySubtitleStyle = () => {
    const size = SUB_SIZES.find((s) => s.key === getSubSize()) || SUB_SIZES[1];
    const root = document.documentElement.style;
    root.setProperty('--sub-size', size.px);
    root.setProperty('--sub-bg', getSubBg() ? 'rgba(0,0,0,.75)' : 'transparent');
}

export const setSubSize = (key) => {
    localStorage.setItem('jf_subSize', key);
    applySubtitleStyle();
}

export const setSubBg = (on) => {
    localStorage.setItem('jf_subBg', on ? 'on' : 'off');
    applySubtitleStyle();
}

const BOOL_DEFAULTS = {
    autoplayNext: true,
    autoSkipSegments: false,
    autoplayPreviews: true,
    screensaver: true,
    showClock: true,
};

export const getPref = (key) => {
    const v = localStorage.getItem('jf_pref_' + key);
    return v === null ? BOOL_DEFAULTS[key] : v === '1';
}

export const setPref = (key, on) => {
    localStorage.setItem('jf_pref_' + key, on ? '1' : '0');
}

export const getQuality = () => {
    return localStorage.getItem('jf_quality') || 'auto';
}

export const setQuality = (key) => {
    localStorage.setItem('jf_quality', key);
}

export const getAudioLang = () => {
    return localStorage.getItem('jf_audioLang');
}

export const setAudioLang = (lang) => {
    if (lang != null) localStorage.setItem('jf_audioLang', lang);
}

export const getSubLang = () => {
    return localStorage.getItem('jf_subLang');
}

export const setSubLang = (lang) => {
    localStorage.setItem('jf_subLang', lang || 'off');
}
