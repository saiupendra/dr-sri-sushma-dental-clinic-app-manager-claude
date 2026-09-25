import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Skipped for the e2e ("test") build: the Playwright suite exercises app
    // behaviour, not the service worker/precache layer, and a SW controlling
    // the page adds cross-run timing (install/activate, stale precache) that
    // has nothing to do with what those tests check.
    ...(mode === "test"
      ? []
      : [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["icons/apple-touch-icon.png"],
            manifest: {
              name: "Dr.Sri Sushma Dental Clinic — Clinic Manager",
              short_name: "Clinic Manager",
              description:
                "Scheduling, dental charts, billing and WhatsApp reminders for Dr.Sri Sushma Multispeciality Dental Clinic.",
              theme_color: "#0d736c",
              background_color: "#ffffff",
              display: "standalone",
              start_url: "/",
              scope: "/",
              icons: [
                { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
                { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
                { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
              ],
            },
            // Only the app shell (JS/CSS/HTML) is precached here. API data offline
            // support is handled by our own IndexedDB cache + outbox (src/offline),
            // not Workbox runtime caching — the two would otherwise fight over the
            // same requests and give confusing, hard-to-debug staleness.
            workbox: {
              navigateFallback: "/index.html",
              navigateFallbackDenylist: [/^\/api\//],
            },
            devOptions: { enabled: false },
          }),
        ]),
  ],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
}));
