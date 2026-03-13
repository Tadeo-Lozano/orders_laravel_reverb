import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const port = Number(env.VITE_DEV_SERVER_PORT || 5173);
    const hmrHost = env.VITE_HMR_HOST || undefined;
    const hmrClientPort = env.VITE_HMR_CLIENT_PORT
        ? Number(env.VITE_HMR_CLIENT_PORT)
        : undefined;

    return {
        plugins: [
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.js'],
                refresh: true,
            }),
            tailwindcss(),
        ],
        server: {
            host: env.VITE_DEV_SERVER_HOST || '0.0.0.0',
            port,
            strictPort: true,
            hmr: hmrHost
                ? {
                      host: hmrHost,
                      protocol: env.VITE_HMR_PROTOCOL || 'ws',
                      clientPort: hmrClientPort,
                  }
                : undefined,
            watch: {
                ignored: ['**/storage/framework/views/**'],
            },
        },
    };
});
