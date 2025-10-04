import { createApp } from 'vue';
import App from './App.vue';

// Create and mount the app
const app = createApp(App);
app.mount('#app');

// Dynamically inject xterm-fixes CSS after Vue app and xterm.css have loaded
// This ensures our fixes override the default xterm.js styles
const xtermFixesLink = document.createElement('link');
xtermFixesLink.rel = 'stylesheet';
xtermFixesLink.href = '/css/xterm-fixes.css';
document.head.appendChild(xtermFixesLink);
