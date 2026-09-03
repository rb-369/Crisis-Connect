/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Mission Control & Shell
        slate: {
          950: '#020617',
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F1F5F9',
          50: '#F8FAFC',
        },
        // Dedicated Crisis Triage Action Colors
        triage: {
          approveText: '#15803D',
          approveBg: '#DCFCE7',
          approveBtn: '#16A34A',
          rejectText: '#B91C1C',
          rejectBg: '#FEE2E2',
          rejectBtn: '#DC2626',
          flagText: '#B45309',
          flagBg: '#FEF3C7',
          flagBtn: '#D97706',
          neutralText: '#475569',
          neutralBg: '#F1F5F9',
        },
        // Distinct Category Palette
        cat: {
          rescueIcon: '#991B1B',
          rescueBg: '#FEE2E2',
          rescueBorder: '#FECACA',
          bloodIcon: '#DC2626',
          bloodBg: '#FFE4E6',
          bloodBorder: '#FECDD3',
          oxygenIcon: '#0891B2',
          oxygenBg: '#CFFAFE',
          oxygenBorder: '#A5F3FC',
          medicineIcon: '#2563EB',
          medicineBg: '#DBEAFE',
          medicineBorder: '#BFDBFE',
          foodIcon: '#D97706',
          foodBg: '#FEF3C7',
          foodBorder: '#FDE68A',
          shelterIcon: '#7C3AED',
          shelterBg: '#EDE9FE',
          shelterBorder: '#DDD6FE',
          transportIcon: '#0D9488',
          transportBg: '#CCFBF1',
          transportBorder: '#99F6E4',
        },
        // Reassurance Status Colors
        reassurance: {
          searchingText: '#D97706',
          searchingBg: '#FEF3C7',
          searchingBorder: '#FDE68A',
          matchedText: '#0284C7',
          matchedBg: '#E0F2FE',
          matchedBorder: '#BAE6FD',
          arrivedText: '#16A34A',
          arrivedBg: '#DCFCE7',
          arrivedBorder: '#BBF7D0',
          verifiedText: '#15803D',
        },
        // GIS Map & Badges
        gis: {
          volunteerPin: '#4338CA',
          urgentPin: '#DC2626',
          mlBadgeText: '#6D28D9',
          mlBadgeBg: '#EDE9FE',
          orgBadgeText: '#0284C7',
          orgBadgeBg: '#E0F2FE',
        },
      },
      animation: {
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}
