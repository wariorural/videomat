import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // manifest + ikoner ligger allerede i public/ — ikke generer nye
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
        globIgnores: ["**/og.png"], // kun for delekort, trengs ikke offline
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // plakater fra Letterboxds bildeserver — opake svar (no-cors),
            // derfor må status 0 være cacheable
            urlPattern: /^https:\/\/a\.ltrbxd\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "posters",
              cacheableResponse: { statuses: [0, 200] },
              // opake plakater kvote-paddes hardt av nettleseren — hold antallet
              // lavt og tøm hele cachen hvis kvoten sprenges (ellers feiler alt)
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600, purgeOnQuotaError: true },
            },
          },
          {
            urlPattern: /\/api\/film/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "film-details",
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
          {
            urlPattern: /\/api\/watchlist/,
            handler: "NetworkFirst",
            options: {
              cacheName: "watchlists",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 8, maxAgeSeconds: 24 * 3600 },
            },
          },
        ],
      },
    }),
  ],
});
