/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50:"#faf8f6",100:"#f3efe9",200:"#e6ddd3",300:"#d4c5b5",400:"#b8a48e",
          500:"#9c8368",600:"#7d6750",700:"#5e4d3b",800:"#3f3328",900:"#231c16",
        },
        neutral: {
          0:"#ffffff",50:"#fafaf9",100:"#f5f5f4",200:"#e7e5e4",300:"#d6d3d1",400:"#a8a29e",
          500:"#78716c",600:"#57534e",700:"#44403c",800:"#292524",900:"#1c1917",
        },
        error:"#dc2626","error-light":"#fef2f2",
        success:"#16a34a","success-light":"#f0fdf4",
        warning:"#d97706","warning-light":"#fffbeb",
        info:"#2563eb","info-light":"#eff6ff",
        "type-voice":"#7c3aed","type-document":"#2563eb","type-text":"#0d9488",
      },
      fontFamily: {
        serif: ["Lora_600SemiBold"],
        "serif-bold": ["Lora_700Bold"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        mono: ["JetBrainsMono_400Regular"],
      },
      borderRadius: { sm:"4px", md:"8px", lg:"12px", xl:"16px", full:"9999px" },
    },
  },
  plugins: [],
};
