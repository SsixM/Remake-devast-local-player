import { defineConfig } from 'vite';
import obfuscator from 'vite-plugin-javascript-obfuscator';

export default defineConfig({
  base: './', // Чтобы пути к ассетам не ломались
  plugins: [
    obfuscator({
      // Настройки защиты (сбалансированные, чтобы не падал FPS)
      compact: true,
      controlFlowFlattening: true, // Тот самый лабиринт из switch-кейсов
      controlFlowFlatteningThreshold: 0.75, // Применять к 75% кода
      numbersToExpressions: true, // Превратит твои 49 хп в выражения вроде (0x1a + 0x17)
      simplify: true,
      stringArray: true, // Спрячет все строки (названия предметов, картинок) в массив
      stringArrayThreshold: 0.8
    })
  ],
  build: {
    minify: 'terser', // Дополнительное сжатие кода
    outDir: 'dist' // Папка, куда соберется защищенная игра
  }
});