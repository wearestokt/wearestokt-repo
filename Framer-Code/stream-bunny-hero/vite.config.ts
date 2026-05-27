import { resolve } from "path"
import { defineConfig } from "vite"

export default defineConfig({
    base: "./",
    root: ".",
    publicDir: "public",
    build: {
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                embed: resolve(__dirname, "embed.html"),
            },
        },
    },
    server: {
        port: 5174,
        open: true,
    },
})
