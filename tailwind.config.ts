import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#001e40",
        "on-primary": "#ffffff",
        "primary-container": "#003366",
        "on-primary-container": "#799dd6",
        "primary-fixed": "#d5e3ff",
        "primary-fixed-dim": "#a7c8ff",
        "on-primary-fixed": "#001b3c",
        "on-primary-fixed-variant": "#1f477b",
        "inverse-primary": "#a7c8ff",

        "secondary": "#7f5700",
        "on-secondary": "#ffffff",
        "secondary-container": "#feb316",
        "on-secondary-container": "#6a4800",
        "secondary-fixed": "#ffdead",
        "secondary-fixed-dim": "#ffba3b",
        "on-secondary-fixed": "#281900",
        "on-secondary-fixed-variant": "#604100",

        "tertiary": "#141f2f",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#293446",
        "on-tertiary-container": "#919cb2",
        "tertiary-fixed": "#d8e3fa",
        "tertiary-fixed-dim": "#bcc7dd",
        "on-tertiary-fixed": "#111c2c",
        "on-tertiary-fixed-variant": "#3c475a",

        "surface": "#f7f9fb",
        "surface-dim": "#d8dadc",
        "surface-bright": "#f7f9fb",
        "surface-variant": "#e0e3e5",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f6",
        "surface-container": "#eceef0",
        "surface-container-high": "#e6e8ea",
        "surface-container-highest": "#e0e3e5",
        "surface-tint": "#3a5f94",
        "on-surface": "#191c1e",
        "on-surface-variant": "#43474f",
        "inverse-surface": "#2d3133",
        "inverse-on-surface": "#eff1f3",

        "outline": "#737780",
        "outline-variant": "#c3c6d1",

        "error": "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",

        "background": "#f7f9fb",
        "on-background": "#191c1e",

        // Institutional status colors
        "status-signed": "#059669",
        "status-warning": "#d97706",
        "status-error": "#dc2626",
        "status-info": "#2563eb",
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "sm": "0.125rem",
        "md": "0.375rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px",
      },
      spacing: {
        "unit": "4px",
        "gutter": "24px",
        "margin-mobile": "16px",
        "margin-desktop": "32px",
        "container-max": "1440px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "institutional": "0px 1px 3px rgba(0, 0, 0, 0.05), 0px 1px 2px rgba(0, 0, 0, 0.03)",
        "institutional-hover": "0px 4px 6px -1px rgba(0, 0, 0, 0.08), 0px 2px 4px -1px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
