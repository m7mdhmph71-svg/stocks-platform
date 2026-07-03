import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        // لوحة المنصة: أخضر التوافق، أحمر عدم التوافق، كهرماني للمختلط
        brand: {
          50: "#eefbf4",
          100: "#d6f5e3",
          200: "#b0eacb",
          300: "#7cd9ad",
          400: "#46c18b",
          500: "#22a672",
          600: "#15855c",
          700: "#116a4b",
          800: "#10543d",
          900: "#0e4534",
          950: "#07271d",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-arabic)",
          "Tajawal",
          "Segoe UI",
          "Tahoma",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
