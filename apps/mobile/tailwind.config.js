/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ProstCounter brand colors (matching web app)
        brand: {
          DEFAULT: "#FBBF24", // yellow-400
          dark: "#F59E0B", // yellow-500
          darker: "#D97706", // yellow-600
        },
      },
    },
  },
  plugins: [],
};
