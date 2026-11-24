const configuredBase = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const path = window.location.pathname;

export const APP_BASENAME = path === '/punkrecord' || path.startsWith('/punkrecord/')
    ? '/punkrecord'
    : configuredBase;

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export const loginPath = `${APP_BASENAME}/login`;
