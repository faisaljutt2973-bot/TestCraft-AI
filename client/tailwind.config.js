/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4fd',
          100: '#e0ebfa',
          200: '#c5d8f6',
          300: '#9bbfef',
          400: '#699de6',
          500: '#437ddc',
          600: '#2d62cf',
          700: '#234db7',
          800: '#1e3f94',
          900: '#1c3677',
          950: '#11224d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
