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
        // Library-inspired color palette
        library: {
          // Warm parchment and cream tones
          cream: {
            50: '#fefcf7',
            100: '#fef9ed',
            200: '#fcf0d2',
            300: '#f9e6b7',
            400: '#f3d284',
            500: '#edbe51',
            600: '#d5a949',
            700: '#b08c3d',
            800: '#8c6f31',
            900: '#725c28',
          },
          // Rich mahogany and leather tones
          mahogany: {
            50: '#faf7f5',
            100: '#f4efeb',
            200: '#e9d7cd',
            300: '#ddbfaf',
            400: '#c68f73',
            500: '#af5f37',
            600: '#9e5632',
            700: '#84482a',
            800: '#693a22',
            900: '#56301c',
          },
          // Deep forest and ink tones
          forest: {
            50: '#f7f8f7',
            100: '#eff1ef',
            200: '#d6dcd7',
            300: '#bdc7bf',
            400: '#8c9d8f',
            500: '#5a735f',
            600: '#516856',
            700: '#435648',
            800: '#36453a',
            900: '#2c3830',
          },
          // Elegant gold accents
          gold: {
            50: '#fffdf7',
            100: '#fffbef',
            200: '#fef4d7',
            300: '#fdedbf',
            400: '#fbde8f',
            500: '#f9cf5f',
            600: '#e0ba56',
            700: '#bb9b48',
            800: '#967c3a',
            900: '#7a6530',
          },
          // Muted sage for secondary elements
          sage: {
            50: '#f8f9f8',
            100: '#f1f3f1',
            200: '#dde1dd',
            300: '#c9cfc9',
            400: '#a1aba1',
            500: '#798779',
            600: '#6d7a6d',
            700: '#5b665b',
            800: '#485248',
            900: '#3b433b',
          },
        },
        // Refined reading colors
        reading: {
          // Text hierarchy
          primary: '#2c3830',    // Deep forest for primary text
          secondary: '#485248',  // Medium forest for secondary text
          muted: '#798779',      // Sage for muted text
          accent: '#af5f37',     // Mahogany for accents
          // Interactive states
          hover: '#5a735f',      // Forest hover
          active: '#f9cf5f',     // Gold active state
          focus: '#edbe51',      // Gold focus ring
        },
        // Surface colors for backgrounds
        surface: {
          paper: '#fefcf7',      // Warm paper white
          parchment: '#fef9ed',  // Slightly warmer
          vellum: '#fcf0d2',     // Cream background
          aged: '#f9e6b7',       // Aged paper
        },
      },
      fontFamily: {
        // Primary scholarly serif font
        serif: ['Iowan Old Style', 'Crimson Text', 'Georgia', 'Times New Roman', 'serif'],
        // Supporting sans-serif for UI elements  
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // Monospace for code
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        // Specific font utilities
        'iowan': ['Iowan Old Style', 'Crimson Text', 'Georgia', 'serif'],
      },
      fontSize: {
        // Typography scale for reading
        'reading-xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.025em' }],
        'reading-sm': ['0.875rem', { lineHeight: '1.6', letterSpacing: '0.02em' }],
        'reading-base': ['1rem', { lineHeight: '1.7', letterSpacing: '0.01em' }],
        'reading-lg': ['1.125rem', { lineHeight: '1.7', letterSpacing: '0.01em' }],
        'reading-xl': ['1.25rem', { lineHeight: '1.6', letterSpacing: '0.005em' }],
        'reading-2xl': ['1.5rem', { lineHeight: '1.5', letterSpacing: '0' }],
        'reading-3xl': ['1.875rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
      },
      spacing: {
        'reading': '24rem',    // Optimal reading column width
        'margin': '1.5rem',    // Consistent margins
        'gutter': '2rem',      // Section gutters
      },
      boxShadow: {
        // Subtle, paper-like shadows
        'paper': '0 1px 3px rgba(60, 64, 67, 0.12), 0 1px 2px rgba(60, 64, 67, 0.24)',
        'book': '0 4px 8px rgba(60, 64, 67, 0.12), 0 2px 4px rgba(60, 64, 67, 0.08)',
        'shelf': '0 8px 16px rgba(60, 64, 67, 0.15), 0 4px 8px rgba(60, 64, 67, 0.1)',
        'deep': '0 12px 24px rgba(60, 64, 67, 0.2), 0 6px 12px rgba(60, 64, 67, 0.15)',
        // Interactive shadows
        'block': '0 0 0 2px rgba(175, 95, 55, 0.3)',
        'block-hover': '0 0 0 3px rgba(175, 95, 55, 0.5)',
        'definition': '0 0 0 2px rgba(249, 207, 95, 0.4)',
        'annotation': '0 0 0 2px rgba(90, 115, 95, 0.4)',
      },
      borderRadius: {
        'paper': '2px',
        'book': '4px',
        'journal': '8px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'page-turn': {
          '0%': { transform: 'perspective(400px) rotateY(0deg)' },
          '50%': { transform: 'perspective(400px) rotateY(-15deg)' },
          '100%': { transform: 'perspective(400px) rotateY(0deg)' },
        },
        'ink-spread': {
          '0%': { transform: 'scale(0)', opacity: '0.8' },
          '100%': { transform: 'scale(1)', opacity: '0.3' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'slide-in': 'slide-in 0.3s ease-out forwards',
        'page-turn': 'page-turn 0.6s ease-in-out',
        'ink-spread': 'ink-spread 0.5s ease-out forwards',
      },
      backdropBlur: {
        'paper': '8px',
      },
    },
  },
  plugins: [],
} satisfies Config;