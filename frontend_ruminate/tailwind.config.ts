// In tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // New warm, muted, literary-inspired color palette
        paper: {
          50: '#fcfaf7',
          100: '#f8f5f0',
          200: '#f2ede3',
          300: '#e8e0d0',
          400: '#d8cdb8',
          500: '#c5b8a0',
          600: '#ae9f86',
          700: '#8e7f6a',
          800: '#6e614f',
          900: '#544a3d',
        },
        ink: {
          50: '#f5f5f5',
          100: '#e8e8e8',
          200: '#d1d1d1',
          300: '#adadad',
          400: '#8a8a8a',
          500: '#6c6c6c',
          600: '#545454',
          700: '#3f3f3f',
          800: '#292929',
          900: '#171717',
        },
        terracotta: {
          50: '#fcf7f7',
          100: '#f9efed',
          200: '#f2d9d2',
          300: '#e8b9ab',
          400: '#dc9a84',
          500: '#cd7c62',
          600: '#b95e46',
          700: '#974536',
          800: '#77372e',
          900: '#5e2d27',
        },
        olive: {
          50: '#f7f8f6',
          100: '#edf0ea',
          200: '#dfe4da',
          300: '#c3cbb9',
          400: '#a3b094',
          500: '#849472',
          600: '#697857',
          700: '#535e45',
          800: '#434a38',
          900: '#373d2f',
        },
      },
      fontFamily: {
        sans: ['var(--font-lato)', 'Lato', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Playfair Display', 'serif'],
        'noto-serif': ['var(--font-noto-serif-jp)', 'Noto Serif JP', 'serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floatUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '0.8' },
        },
        handDraw: {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out forwards',
        floatUp: 'floatUp 2s ease-out forwards',
        handDraw: 'handDraw 2s linear forwards',
      },
      backgroundImage: {
        'paper-texture': "url('/paper-texture.svg')",
        'brown-noise': "url('/brown_noise.jpg')",
      },
      spacing: {
        'chat': '384px',
      },
      boxShadow: {
        'block': '0 0 0 2px rgba(174, 159, 134, 0.5)',
        'block-hover': '0 0 0 3px rgba(174, 159, 134, 0.7)',
        'paper': '0 2px 8px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
        'paper-hover': '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.12)',
      }
    },
  },
  plugins: [],
} satisfies Config;