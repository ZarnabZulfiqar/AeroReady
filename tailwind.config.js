/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgDark: "#0A0E14",
        cardDark: "#111827",
        accentTeal: "#5EEAD4",
        textBody: "#D1D5DB",
      },
    },
  },
  plugins: [],
}