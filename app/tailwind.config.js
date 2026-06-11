/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#15171a",
        panel: "#f7f4ee",
        line: "#d8d2c6",
        moss: "#3f6f63",
        coral: "#b85f56",
        amber: "#c88a2d"
      }
    }
  },
  plugins: []
};

