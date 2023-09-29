// eslint-disable-next-line @typescript-eslint/no-var-requires
const forms = require('@tailwindcss/forms');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'media',
  plugins: [forms],
  theme: {
    extend: {},
  },
}
