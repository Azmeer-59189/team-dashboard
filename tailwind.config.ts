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
        muted: "#6B7280",
        surface: "#FFFFFF",
        canvas: "#F6F7F5",
        hairline: "#E4E7EC",
        brand: {
          50: "#EAF4F1",
          100: "#D2E7E1",
          400: "#2E8A76",
          500: "#0F6E5C",
          600: "#0C5B4C",
          700: "#0A4A3E",
        },
        positive: "#1E8E5A",
        pending: "#B8860B",
        danger: "#C0352B",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
