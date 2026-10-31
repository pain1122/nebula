import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import translationFA from "./locales/fa.json";
import translationENG from "./locales/en.json";
import { runtimeConfig } from "./core/runtime/config";
import {
    ProductLocale,
    applyProductLocale,
    initializeProductLocale,
    normalizeProductLocale,
    persistProductLocale,
} from "./modules/checkupino/preferences/localization";

// the translations
const resources = {
    fa: {
        translation: translationFA,
    },
    en: {
        translation: translationENG,
    },
};

const activeLanguage = initializeProductLocale(
    document.documentElement,
    window.localStorage,
    runtimeConfig.defaultLocale,
);

export const syncDocumentLanguage = (language: unknown): ProductLocale => {
    const locale = normalizeProductLocale(language);
    persistProductLocale(window.localStorage, locale);
    applyProductLocale(document.documentElement, locale);
    return locale;
};

i18n.use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        lng: activeLanguage,
        fallbackLng: normalizeProductLocale(runtimeConfig.fallbackLocale, "en"),

        keySeparator: false, // we do not use keys in form messages.welcome

        interpolation: {
            escapeValue: false, // react already safes from xss
        },
    });

i18n.on("languageChanged", syncDocumentLanguage);

export const changeProductLanguage = async (locale: ProductLocale) => {
    syncDocumentLanguage(locale);
    await i18n.changeLanguage(locale);
};

export default i18n;
