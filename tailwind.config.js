// Tailwind CSS v3 設定：用來重新產生 tailwind.css（指令見 CLAUDE.md）
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html'],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'Noto Sans TC', 'sans-serif'],
            },
            colors: {
                brand: {
                    50: '#f5f3ff',
                    100: '#ede9fe',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    700: '#6d28d9',
                    900: '#4c1d95',
                },
                android: {
                    darkBg: '#0f0e13',
                    darkSurface: '#18171d',
                    darkSurfaceVariant: '#24222a',
                }
            }
        }
    }
};
