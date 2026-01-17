/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#cdf545', // Lime Green
        secondary: '#b8e030', // Darker Lime Green
        accent: '#cdf545', // Lime Green
      },
    },
  },
  plugins: [],
};
