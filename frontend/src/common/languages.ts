import flagiran from "../assets/images/flags/ir.svg";
import flagus from "../assets/images/flags/us.svg";

const languages = {
    fa: {
        label: "فارسی",
        flag: flagiran,
    },
    en: {
        label: "English",
        flag: flagus,
    },
} as const;

export default languages;
