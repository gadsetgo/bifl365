import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core palette
        charcoal: "#121212",
        "charcoal-700": "#1e1e1e",
        "charcoal-600": "#2a2a2a",
        "charcoal-400": "#555555",
        "charcoal-200": "#999999",
        orange: {
          DEFAULT: "#FF5733",
          hover: "#E64D2B",
          pale: "#FFF1EE",
          muted: "#FFB3A3",
        },
        paper: "#FAF9F6",
        "paper-dark": "#F0EFE9",
        ink: "#121212",
        ghost: "#E8E6E1",
        // Legacy compat
        smoke: "#666666",
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderColor: {
        DEFAULT: "#E8E6E1",
        strong: "#121212",
        orange: "#FF5733",
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        // Brutalist: no soft shadows — only hard offsets
        card: "2px 2px 0px 0px #121212",
        "card-hover": "4px 4px 0px 0px #121212",
        "card-orange": "2px 2px 0px 0px #FF5733",
        "card-orange-hover": "4px 4px 0px 0px #FF5733",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "border-draw": "borderDraw 0.3s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        borderDraw: {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
