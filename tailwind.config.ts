import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        muted: "#64748B",
        surface: "#FFFFFF",
        canvas: "#F4F6FB",
        hairline: "#E6E9F2",
        // indigo accent: buttons, links, active nav, focus rings
        brand: {
          50: "#EEF0FF",
          100: "#E0E4FF",
          200: "#C7CDFE",
          400: "#7C82F7",
          500: "#5B5FEF",
          600: "#4A4AD6",
          700: "#3A39AE",
          900: "#1E1B4B",
        },
        // deep navy for the sidebar and dark surfaces
        night: {
          800: "#18203D",
          900: "#0E1430",
          950: "#090D22",
        },
        // soft background tints for icon chips and highlights
        tint: {
          mint: "#E6F7F0",
          sand: "#FEF3E2",
          sky: "#E7F0FE",
          blush: "#FDECF0",
          violet: "#EFEEFF",
        },
        positive: "#0E9F6E",
        pending: "#D97706",
        danger: "#E11D48",
      },
      fontFamily: {
        display: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.05)",
        lift: "0 10px 30px -12px rgba(74, 74, 214, 0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
