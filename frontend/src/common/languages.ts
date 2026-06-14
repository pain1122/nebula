// import usFlag from "../assets/images/flags/us.jpg"
// import spain from "../assets/images/flags/spain.jpg"
// import germany from "../assets/images/flags/germany.jpg"
// import italy from "../assets/images/flags/italy.jpg"
// import russia from "../assets/images/flags/russia.jpg"

import flagiran from "../assets/images/flags/ir.svg";
import flagus from "../assets/images/flags/us.svg";
import flagspain from "../assets/images/flags/spain.svg";
import flaggermany from "../assets/images/flags/germany.svg";
import flagitaly from "../assets/images/flags/italy.svg";
import flagrussia from "../assets/images/flags/russia.svg";
import flagchina from "../assets/images/flags/china.svg";
import flagfrench from "../assets/images/flags/french.svg";
import flagarabic from "../assets/images/flags/ae.svg";

const languages = {
    fa: {
        label: "فارسی",
        flag: flagiran,
    },
    sp: {
        label: "Española",
        flag: flagspain,
    },
    gr: {
        label: "Deutsche",
        flag: flaggermany,
    },
    it: {
        label: "Italiana",
        flag: flagitaly,
    },
    rs: {
        label: "русский",
        flag: flagrussia,
    },
    en: {
        label: "English",
        flag: flagus,
    },
    cn: {
        label: "中国人",
        flag: flagchina,
    },
    fr: {
        label: "français",
        flag: flagfrench,
    },
    ar: {
        label: "Arabic",
        flag: flagarabic,
    },
};

export default languages;
