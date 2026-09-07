import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#16324f",
        ocean: "#087e8b",
        coral: "#f25f5c",
        mist: "#eef7f6",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        sans: ["Trebuchet MS", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
