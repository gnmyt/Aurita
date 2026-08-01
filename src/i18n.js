import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import HttpApi from 'i18next-http-backend';

export const languages = [
    {name: 'English', code: 'en'},
    {name: 'العربية', code: 'ar_SA'},
    {name: 'বাংলা', code: 'bn_BD'},
    {name: 'Deutsch', code: 'de_DE'},
    {name: 'Español', code: 'es_ES'},
    {name: 'Français', code: 'fr_FR'},
    {name: 'हिन्दी', code: 'hi_IN'},
    {name: 'Bahasa Indonesia', code: 'id_ID'},
    {name: 'Italiano', code: 'it_IT'},
    {name: '日本語', code: 'ja_JP'},
    {name: '한국어', code: 'ko_KR'},
    {name: 'Nederlands', code: 'nl_NL'},
    {name: 'Polski', code: 'pl_PL'},
    {name: 'Português (Brasil)', code: 'pt_BR'},
    {name: 'Русский', code: 'ru_RU'},
    {name: 'Svenska', code: 'sv_SE'},
    {name: 'Türkçe', code: 'tr_TR'},
    {name: 'Українська', code: 'uk_UA'},
    {name: 'Tiếng Việt', code: 'vi_VN'},
    {name: '简体中文', code: 'zh_CN'},
];

const STORAGE_KEY = 'jf_lang';
const RTL = new Set(['ar', 'fa', 'he', 'ur']);

const getLang = () => {
    return localStorage.getItem(STORAGE_KEY);
}

const baseOf = (code) => code.split(/[-_]/)[0].toLowerCase();

const resolveCode = (tag) => {
    if (!tag) return null;
    const normalized = tag.replace('-', '_').toLowerCase();
    const exact = languages.find((lang) => lang.code.toLowerCase() === normalized);
    if (exact) return exact.code;
    return languages.find((lang) => baseOf(lang.code) === baseOf(tag))?.code || null;
}

export const setLang = (code) => {
    localStorage.setItem(STORAGE_KEY, code);
    window.location.reload();
}

const applyDocumentLang = (code) => {
    const el = document.documentElement;
    el.lang = code.replace('_', '-');
    el.dir = RTL.has(code.split('_')[0]) ? 'rtl' : 'ltr';
}

i18n.use(initReactI18next).use(HttpApi).init({
    lng: resolveCode(getLang()) || resolveCode(navigator.language) || 'en',
    supportedLngs: languages.map((lang) => lang.code),
    fallbackLng: 'en',
    backend: {
        loadPath: `${import.meta.env.BASE_URL}assets/locales/{{lng}}.json`,
    },
    interpolation: {escapeValue: false},
});

i18n.on('languageChanged', applyDocumentLang);

export default i18n;
