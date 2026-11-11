import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1200px" } },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-kannada)", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        verified: { DEFAULT: "hsl(var(--verified))", soft: "hsl(var(--verified-soft))", foreground: "hsl(var(--verified-foreground))" },
        unverified: { DEFAULT: "hsl(var(--unverified))", soft: "hsl(var(--unverified-soft))", foreground: "hsl(var(--unverified-foreground))" },
        unavailable: { DEFAULT: "hsl(var(--unavailable))", soft: "hsl(var(--unavailable-soft))", foreground: "hsl(var(--unavailable-foreground))" },
      },
      keyframes: {
        drive: { from: { transform: "translateX(-34px)" }, to: { transform: "translateX(34px)" } },
        twinkle: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.25" } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        nudge: { "0%, 100%": { transform: "translateX(0)" }, "50%": { transform: "translateX(5px)" } },
        aurora: {
          "0%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(8%, -6%, 0) scale(1.15)" },
          "100%": { transform: "translate3d(-6%, 4%, 0) scale(0.95)" },
        },
        wiggle: { "0%, 100%": { transform: "rotate(0)" }, "25%": { transform: "rotate(-10deg)" }, "75%": { transform: "rotate(8deg)" } },
      },
      animation: {
        drive: "drive 7s ease-in-out infinite alternate",
        twinkle: "twinkle 3s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        nudge: "nudge 1.6s ease-in-out infinite",
        aurora: "aurora 18s ease-in-out infinite alternate",
        wiggle: "wiggle 0.5s ease-in-out",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
};

export default config;
