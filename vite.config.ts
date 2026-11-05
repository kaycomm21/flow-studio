import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 주소(https://kaycomm21.github.io/flow-studio/)에 맞춘 상대 경로.
// './' 로 두면 로컬 파일 열기·Pages 둘 다 동작한다.
export default defineConfig({
  base: './',
  plugins: [react()],
});
