import Echo from 'laravel-echo';

import Pusher from 'pusher-js';
window.Pusher = Pusher;

const configuredHost = import.meta.env.VITE_REVERB_HOST;
const currentHost = window.location.hostname;
const currentScheme = window.location.protocol === 'https:' ? 'https' : 'http';
const reverbScheme = import.meta.env.VITE_REVERB_SCHEME ?? currentScheme;
const reverbPort = Number.parseInt(import.meta.env.VITE_REVERB_PORT ?? '', 10);

const isLoopbackHost = (host) => ['127.0.0.1', 'localhost', '0.0.0.0', '[::1]'].includes(host);

const wsHost = configuredHost && !(isLoopbackHost(configuredHost) && !isLoopbackHost(currentHost))
    ? configuredHost
    : currentHost;

const wsPort = Number.isNaN(reverbPort)
    ? (reverbScheme === 'https' ? 443 : 80)
    : reverbPort;

window.Echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost,
    wsPort,
    wssPort: wsPort,
    forceTLS: reverbScheme === 'https',
    enabledTransports: ['ws', 'wss'],
});
