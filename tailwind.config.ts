import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14171F",
        muted: "#64726D",
        surface: "#FFFFFF",
        canvas: "#EFF4F0",
        hairline: "#DDE6E1",
        brand: {
          50: "#EAF4F1",
          100: "#D2E7E1",
          400: "#2E8A76",
          500: "#0F6E5C",
          600: "#0C5B4C",
          700: "#0A4A3E",
        },
        // soft background tints for stat cards and highlights
        tint: {
          mint: "#E3F1EB",
          sand: "#F7EFDD",
          sky: "#E3EEF7",
          blush: "#F8E8E4",
        },
        positive: "#1E8E5A",
        pending: "#B8860B",
        danger: "#C0352B",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16, 70, 58, 0.05), 0 6px 20px rgba(16, 70, 58, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
