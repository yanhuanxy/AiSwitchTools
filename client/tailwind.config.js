/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0066FF',
          hover: '#005CE6', // Darken 8% approx
          active: '#0052CC', // Darken 12% approx
          light: '#F0F6FF', // Secondary/Background
        },
        danger: {
          DEFAULT: '#FF4D4F',
        },
        gray: {
          border: '#E5E6EB',
          text: '#1D2129', // Coze usually uses semi-black for text
        }
      },
      fontFamily: {
        sans: ['"Source Han Sans"', '"Noto Sans SC"', 'sans-serif'],
      },
      borderRadius: {
        'coze': '8px',
      },
      boxShadow: {
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.08)',
      },
      spacing: {
        '4.5': '1.125rem', // 18px
      }
    },
  },
  plugins: [],
}
