
import path from 'path';
import { fileURLToPath } from 'url'; // Added import
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url); // Helper to get current file path
const __dirname = path.dirname(__filename); // Define __dirname

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'), // __dirname is now defined
        }
      }
    };
});
