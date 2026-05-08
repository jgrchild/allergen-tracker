import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#27322f",
        calm: "#f7faf7",
        moss: "#50766a",
        leaf: "#7aa38f",
        honey: "#f0c86c",
        rose: "#d96b6b",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(39, 50, 47, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
