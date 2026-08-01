import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import HttpApi from 'i18next-http-backend';

export const languages = [
    {name: 'English', code: 'en'},
    {name: 'Deutsch', code: 'de_DE'},
];

const STORAGE_KEY = 'jf_lang';
const RTL = new Set(['ar', 'fa', 'he', 'ur']);

const getLang = () => {
    return localStorage.getItem(STORAGE_KEY);
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
    lng: getLang() || navigator.language.replace('-', '_'),
    supportedLngs: languages.map((lang) => lang.code),
    fallbackLng: 'en',
    backend: {
        loadPath: `${import.meta.env.BASE_URL}assets/locales/{{lng}}.json`,
    },
    interpolation: {escapeValue: false},
});

i18n.on('languageChanged', applyDocumentLang);

export default i18n;
