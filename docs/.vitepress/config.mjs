import { defineConfig } from "vitepress";

export default defineConfig({
    base: process.env.DOCS_BASE || "/",

    title: "Aurita",
    description: "A highly opinionated TV-friendly frontend for Jellyfin",
    lastUpdated: true,
    cleanUrls: true,
    metaChunk: true,

    head: [
        ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
        ["meta", { name: "theme-color", content: "#f25ca8" }],
        ["meta", { property: "og:type", content: "website" }],
        ["meta", { property: "og:locale", content: "en" }],
        ["meta", { property: "og:title", content: "Aurita | Yet another Jellyfin TV frontend" }],
        ["meta", { property: "og:site_name", content: "Aurita" }],
        ["meta", { property: "og:image", content: "/logo.svg" }],
        ["meta", { property: "twitter:card", content: "summary_large_image" }],
    ],

    themeConfig: {
        logo: "/logo.svg",

        nav: [
            { text: "Home", link: "/" },
            { text: "Install", link: "/installation" },
            { text: "Download", link: "https://github.com/gnmyt/Aurita/releases/latest" },
        ],

        footer: {
            message: "Distributed under the MIT License",
            copyright: "© 2026 Mathias Wagner",
        },

        search: {
            provider: "local",
        },

        sidebar: [
            {
                text: "Documentation",
                items: [
                    { text: "Home", link: "/" },
                    { text: "What is Aurita?", link: "/what-is-aurita" },
                    { text: "Installation", link: "/installation" },
                    { text: "Configuration", link: "/configuration" },
                ],
            },
        ],

        socialLinks: [
            { icon: "github", link: "https://github.com/gnmyt/Aurita" },
        ],
    },
});
