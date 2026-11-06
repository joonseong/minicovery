import tailwindCommonConfig from '@repo/tailwind/tailwind.common.config';
import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [tailwindCommonConfig],
  content: ['./src/**/*.{js,ts,jsx,tsx}', '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /** Fuse 디자인 캔버스(미니커버리 홈 · Fuse 스타일 시안)의 색 */
        fuse: {
          ink: '#0B0B0C',
          sub: '#8E8E93',
          faint: '#A1A1A6',
          mute: '#B9B9BE',
          chev: '#AEAEB2',
          line: '#F0F0F2',
          edge: '#E3E3E6',
          card: '#FAFAFB',
          track: '#EFEFF1',
          pill: '#F2F2F4',
          hot: '#FF4D6D',
        },
      },
      borderRadius: {
        card: '22px',
      },
    },
  },
  plugins: [],
};
export default config;
