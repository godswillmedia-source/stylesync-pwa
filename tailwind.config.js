/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2596be', // Lime Green
        secondary: '#1a7a99', // Darker Lime Green
        accent: '#2596be', // Lime Green
      },
    },
  },
  plugins: [],
};
