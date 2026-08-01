import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import HttpApi from 'i18next-http-backend';

export const languages = [
    {name: 'English', code: 'en'},
];

i18n.use(initReactI18next).use(HttpApi).init({
    lng: navigator.language.replace('-', '_'),
    supportedLngs: languages.map((lang) => lang.code),
    fallbackLng: 'en',
    backend: {
        loadPath: `${import.meta.env.BASE_URL}assets/locales/{{lng}}.json`,
    },
    interpolation: {escapeValue: false},
});

export default i18n;
