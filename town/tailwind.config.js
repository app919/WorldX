/** 奶油软陶色板：中性审美，保留上海砖红 / 梧桐绿 / 石库门灰 / 咖啡木色 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#FFFDF8', 100: '#FBF6EC', 200: '#F4EBDA', 300: '#E9DCC3' },
        almond: { 300: '#F2D99B', 400: '#E8C77A', 500: '#D9AE55' },
        sage: { 300: '#C5D6BE', 400: '#A9C2A0', 500: '#86A57C', 700: '#56704F' },
        sakura: { 200: '#F7DCDD', 300: '#F0C4C6', 400: '#E6A3A7' },
        haze: { 200: '#DCE6EE', 300: '#C2D3E0', 400: '#9DB6CA', 600: '#5E7D96' },
        brick: { 300: '#D9A08B', 400: '#C98068', 500: '#B5654E' },
        stone: { 400: '#A9A39A', 600: '#6F6A63' },
        cocoa: { 400: '#A47B5B', 600: '#7A5539', 800: '#4A3426' },
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"HarmonyOS Sans SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { blob: '1.75rem' },
      boxShadow: {
        soft: '0 6px 20px -6px rgba(74,52,38,0.25)',
        jelly: 'inset 0 -4px 0 rgba(0,0,0,0.08), 0 4px 12px -4px rgba(74,52,38,0.3)',
      },
    },
  },
  plugins: [],
};
