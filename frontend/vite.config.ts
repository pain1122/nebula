import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");

    return {
        plugins: [react()],
        server: {
            host: "localhost",
            port: 3000,
            strictPort: true,
        },
        preview: {
            host: "localhost",
            port: 3000,
            strictPort: true,
        },
        resolve: {
            tsconfigPaths: true,
        },
        define: {
            global: "globalThis",
            "process.env.PUBLIC_URL": JSON.stringify(env.PUBLIC_URL ?? ""),
            "process.env.REACT_APP_API_URL": JSON.stringify(
                env.REACT_APP_API_URL ?? "http://localhost:8080",
            ),
            "process.env.REACT_APP_DEFAULTAUTH": JSON.stringify(
                env.REACT_APP_DEFAULTAUTH ?? "fake",
            ),
            "process.env.REACT_APP_APIKEY": JSON.stringify(
                env.REACT_APP_APIKEY ?? "",
            ),
            "process.env.REACT_APP_AUTHDOMAIN": JSON.stringify(
                env.REACT_APP_AUTHDOMAIN ?? "",
            ),
            "process.env.REACT_APP_DATABASEURL": JSON.stringify(
                env.REACT_APP_DATABASEURL ?? "",
            ),
            "process.env.REACT_APP_PROJECTID": JSON.stringify(
                env.REACT_APP_PROJECTID ?? "",
            ),
            "process.env.REACT_APP_STORAGEBUCKET": JSON.stringify(
                env.REACT_APP_STORAGEBUCKET ?? "",
            ),
            "process.env.REACT_APP_MESSAGINGSENDERID": JSON.stringify(
                env.REACT_APP_MESSAGINGSENDERID ?? "",
            ),
            "process.env.REACT_APP_APPID": JSON.stringify(
                env.REACT_APP_APPID ?? "",
            ),
            "process.env.REACT_APP_MEASUREMENTID": JSON.stringify(
                env.REACT_APP_MEASUREMENTID ?? "",
            ),
        },
    };
});
