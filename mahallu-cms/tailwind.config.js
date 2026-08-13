/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        secondary: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
      },
      fontFamily: {
        // Noto Sans Malayalam sits behind Inter so Malayalam glyphs render
        // properly everywhere without changing Latin text.
        sans: ['Inter', 'Noto Sans Malayalam', 'system-ui', 'sans-serif'],
        malayalam: ['Noto Sans Malayalam', 'sans-serif'],
        // Poppins carries no Malayalam glyphs, so mixed text falls through to
        // Noto Sans Malayalam per-glyph — English in Poppins, Malayalam in Noto.
        body: ['Poppins', 'Noto Sans Malayalam', 'system-ui', 'sans-serif'],
        title: ['Anek Malayalam', 'Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

