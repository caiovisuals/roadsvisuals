import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'RoadsVisuals',
				short_name: 'RoadsVisuals',
				start_url: '/',
				display: 'standalone',
				background_color: '#F4F2ED',
				theme_color: '#343c3e',
				icons: [
				{
					src: 'icons/icon-192.png',
					sizes: '192x192',
					type: 'image/png',
				},
				{
					src: 'icons/icon-512.png',
					sizes: '512x512',
					type: 'image/png',
				},
				],
			},
			workbox: {
				cleanupOutdatedCaches: true,
			},
    	}),
	]
});
