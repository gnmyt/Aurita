import i18n from '@/i18n';

const PINNED = (window.AURITA_CONFIG?.serverUrl || '').replace(/\/+$/, '');
const PINNED_SERVER = PINNED ? {id: 'pinned', url: PINNED, name: ''} : null;

const loadServers = () => {
    try {
        return JSON.parse(localStorage.getItem('jf_servers') || '[]');
    } catch {
        return [];
    }
}

let _servers = loadServers();

const saveServers = () => {
    localStorage.setItem('jf_servers', JSON.stringify(_servers));
}

export const isServerPinned = () => {
    return !!PINNED;
}

export const getServers = () => {
    if (PINNED_SERVER) return [PINNED_SERVER];
    return _servers.slice();
}

export const getServer = (id) => {
    if (PINNED_SERVER) return PINNED_SERVER;
    return _servers.find((s) => s.id === id) || null;
}

const normalizeServerUrl = (input) => {
    let url = (input || '').trim().replace(/\/+$/, '');
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    return url;
}

const checkServer = async (url) => {
    const res = await fetch(`${url}/System/Info/Public`, {signal: AbortSignal.timeout(8000)});
    if (!res.ok) throw new Error(`Server antwortet mit Status ${res.status}`);
    const info = await res.json();
    if (!info?.Id) throw new Error(i18n.t('errors.noJellyfinServer'));
    return info;
}

export const addServer = async (input) => {
    const base = normalizeServerUrl(input);
    const candidates = [base, `${base}/jellyfin`, `${base}/stable`];
    let url = base;
    let info = null;
    let lastErr = null;
    for (const candidate of candidates) {
        try {
            info = await checkServer(candidate);
            url = candidate;
            break;
        } catch (e) {
            lastErr = lastErr || e;
        }
    }
    if (!info) throw lastErr;
    const server = {id: info.Id, url, name: info.ServerName || url.replace(/^https?:\/\//, '')};
    const existing = _servers.find((s) => s.id === server.id);
    if (existing) Object.assign(existing, server);
    else _servers.push(server);
    saveServers();
    return server;
}

export const removeServerEntry = (id) => {
    _servers = _servers.filter((s) => s.id !== id);
    saveServers();
    return _servers.length;
}
