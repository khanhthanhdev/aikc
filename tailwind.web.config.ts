import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
import plugin from "tailwindcss/plugin";

export default {
  darkMode: "class",
  content: [
    "./components/common/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/web/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/*.{js,ts,jsx,tsx,mdx}",
    "./app/(web)/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/streamdown/dist/*.js",
  ],

  theme: {
    extend: {
      colors: {
        background: "hsl(var(--color-background) / <alpha-value>)",
        foreground: "hsl(var(--color-foreground) / <alpha-value>)",
        accent: "hsl(var(--color-accent) / <alpha-value>)",
      },

      letterSpacing: {
        micro: "-0.0125em",
      },

      borderColor: {
        DEFAULT: "hsl(var(--color-border))",
      },

      fontFamily: {
        sans: ["var(--font-geist-sans)", ...fontFamily.sans],
        display: ["var(--font-uncut-sans)", ...fontFamily.sans],
      },

      gridColumns: {
        DEFAULT: "16rem",
        xxs: "10rem",
        xs: "12rem",
        sm: "14rem",
        md: "16rem",
        lg: "18rem",
        xl: "20rem",
      },

      scale: {
        flip: "-1",
      },

      transitionTimingFunction: {
        "in-expo": "cubic-bezier(0.95, 0.05, 0.795, 0.035)",
        "out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
      },

      keyframes: {
        shimmer: {
          from: { left: "-90%" },
          to: { left: "90%" },
        },

        movingBanner: {
          to: {
            backgroundPosition: "100% 0",
          },
        },
      },

      animation: {
        shimmer: "shimmer 1.25s cubic-bezier(0.5, 0.25, 0.25, 0.5) infinite",
        movingBanner: "movingBanner 16s linear infinite",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("tailwindcss-animate"),
    plugin(({ matchUtilities, theme }) => {
      matchUtilities(
        {
          "grid-auto-fill": (value) => ({
            gridTemplateColumns: `repeat(auto-fill, minmax(${value}, 1fr))`,
          }),
          "grid-auto-fit": (value) => ({
            gridTemplateColumns: `repeat(auto-fit, minmax(${value}, 1fr))`,
          }),
        },
        { values: theme("gridColumns") }
      );
    }),
  ],
} satisfies Config;
