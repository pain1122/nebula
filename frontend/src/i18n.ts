import i18n from "i18next";
import detector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import translationFA from "./locales/fa.json";
import translationGr from "./locales/gr.json";
import translationIT from "./locales/it.json";
import translationRS from "./locales/ru.json";
import translationSP from "./locales/sp.json";
import translationENG from "./locales/en.json";
import translationCN from "./locales/ch.json";
import translationFR from "./locales/fr.json";
import translationAR from "./locales/ar.json";

// the translations
const resources = {
    fa: {
        translation: translationFA,
    },
    gr: {
        translation: translationGr,
    },
    it: {
        translation: translationIT,
    },
    rs: {
        translation: translationRS,
    },
    sp: {
        translation: translationSP,
    },
    en: {
        translation: translationENG,
    },
    cn: {
        translation: translationCN,
    },
    fr: {
        translation: translationFR,
    },
    ar: {
        translation: translationAR,
    },
};

const language = localStorage.getItem("I18N_LANGUAGE");
if (!language) {
    localStorage.setItem("I18N_LANGUAGE", "fa");
}

export const syncDocumentLanguage = (language: string) => {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
};

const activeLanguage = localStorage.getItem("I18N_LANGUAGE") || "fa";

syncDocumentLanguage(activeLanguage);

i18n.use(detector)
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        lng: activeLanguage,
        fallbackLng: "en", // use en if detected lng is not available

        keySeparator: false, // we do not use keys in form messages.welcome

        interpolation: {
            escapeValue: false, // react already safes from xss
        },
    });

i18n.on("languageChanged", syncDocumentLanguage);

export default i18n;
