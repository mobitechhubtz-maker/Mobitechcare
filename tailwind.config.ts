import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#15171B",
        accent: "#3346F0"
      }
    }
  },
  plugins: []
};

export default config;
