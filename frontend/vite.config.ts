import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5']
	},
	server: {
		port: 5173,
		proxy: {
			'/api': {
				target: 'http://localhost:8080',
				changeOrigin: true
			}
		}
	},
	test: {
		environment: 'node',
		include: ['src/**/*.spec.ts']
	}
});
