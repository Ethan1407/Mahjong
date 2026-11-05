/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 相對路徑，讓建置結果可以直接放到 GitHub Pages 等任何靜態主機的子路徑
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
  },
})
