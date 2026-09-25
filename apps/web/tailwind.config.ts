import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefaf7",
          100: "#d3f1ea",
          200: "#a7e3d6",
          300: "#74cebc",
          400: "#47b3a1",
          500: "#2c9385",
          600: "#20756b",
          700: "#1d5e57",
          800: "#1b4b46",
          900: "#0d736c",
          950: "#0a2e2b",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
