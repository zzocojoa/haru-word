import {register} from 'node:module';

// Astryx's Node-only component inspector discovers generated theme CSS imports.
// Browsers/Vite still load the real styles; only the CLI's Node renderer ignores them.
const option='--import='+import.meta.url;
if(!(process.env.NODE_OPTIONS??'').includes(option))process.env.NODE_OPTIONS=[process.env.NODE_OPTIONS,option].filter(Boolean).join(' ');
register('./astryx-css-loader.mjs',import.meta.url);
