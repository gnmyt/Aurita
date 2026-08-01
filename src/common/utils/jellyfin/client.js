import {clearCache} from '@/common/utils/cache';
import {getServer, removeServerEntry} from './servers';

const DEVICE_ID = 'aurita-' + (localStorage.getItem('deviceId') || (() => {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('deviceId', id);
    return id;
})());

const CLIENT = 'Aurita';
const VERSION = '1.0.0';

export const authHeader = (token) => {
    let h = `MediaBrowser Client="${CLIENT}", Device="LivingRoomTV", DeviceId="${DEVICE_ID}", Version="${VERSION}"`;
    if (token) h += `, Token="${token}"`;
    return h;
}

const loadAccounts = () => {
    try {
        return JSON.parse(localStorage.getItem('jf_accounts') || '[]');
    } catch {
        return [];
    }
}

let _accounts = loadAccounts();
let _token = null;
let _userId = null;

const BOOT_ACCOUNT = (() => {
    const savedId = localStorage.getItem('jf_activeUserId');
    return _accounts.find((a) => a.userId === savedId) || _accounts[0] || null;
})();
const SERVER = getServer(BOOT_ACCOUNT?.serverId)?.url || '';

export const SERVER_URL = SERVER;

export const getUserId = () => {
    return _userId;
}

export const getToken = () => {
    return _token;
}

export const getDeviceId = () => {
    return DEVICE_ID;
}

export const getAccounts = () => {
    return _accounts.slice();
}

export const getActiveAccount = () => {
    return _accounts.find((a) => a.userId === _userId) || null;
}

const mirrorNativeAuth = () => {
    const url = getServer(getActiveAccount()?.serverId)?.url || SERVER;
    try {
        window.AuritaNative?.setAuth?.(url, _userId || '', _token || '');
    } catch {
    }
}

const saveAccounts = () => {
    localStorage.setItem('jf_accounts', JSON.stringify(_accounts));
}

const activate = (acc) => {
    const newUser = acc?.userId || null;
    const owner = localStorage.getItem('jf_cacheOwner');
    if (newUser && owner && owner !== newUser) clearCache();
    if (newUser) localStorage.setItem('jf_cacheOwner', newUser);

    _token = acc?.token || null;
    _userId = acc?.userId || null;
    if (_userId) localStorage.setItem('jf_activeUserId', _userId);
    else localStorage.removeItem('jf_activeUserId');
    mirrorNativeAuth();
}

if (BOOT_ACCOUNT) activate(BOOT_ACCOUNT);

export const upsertAccount = ({userId, token, name, imageTag, serverId}) => {
    const existing = _accounts.find((a) => a.userId === userId);
    if (existing) {
        existing.token = token;
        if (name) existing.name = name;
        if (imageTag !== undefined) existing.imageTag = imageTag;
    } else {
        _accounts.push({userId, token, name: name || 'Profil', imageTag: imageTag ?? null, serverId});
    }
    saveAccounts();
    activate(_accounts.find((a) => a.userId === userId));
}

export const switchAccount = (userId) => {
    const acc = _accounts.find((a) => a.userId === userId);
    if (!acc) return false;
    if (acc.userId === _userId) return true;
    activate(acc);
    return true;
}

export const removeAccount = (userId) => {
    const acc = _accounts.find((a) => a.userId === userId);
    _accounts = _accounts.filter((a) => a.userId !== userId);
    saveAccounts();
    if (acc && !_accounts.some((a) => a.serverId === acc.serverId)) removeServerEntry(acc.serverId);
    if (_userId === userId) activate(_accounts[0] || null);
    return _accounts.length;
}

export const accountHasPin = (userId) => {
    return !!_accounts.find((a) => a.userId === userId)?.pin;
}

export const getAccountPin = (userId) => {
    return _accounts.find((a) => a.userId === userId)?.pin || null;
}

export const setAccountPin = (userId, pin) => {
    const a = _accounts.find((x) => x.userId === userId);
    if (a) {
        a.pin = pin;
        saveAccounts();
        markProfileUnlocked(userId);
    }
}

export const clearAccountPin = (userId) => {
    const a = _accounts.find((x) => x.userId === userId);
    if (a?.pin) {
        delete a.pin;
        saveAccounts();
    }
    try {
        sessionStorage.removeItem('jf_unlocked_' + userId);
    } catch {
    }
}

export const isProfileUnlocked = (userId) => {
    if (!accountHasPin(userId)) return true;
    try {
        return sessionStorage.getItem('jf_unlocked_' + userId) === '1';
    } catch {
        return true;
    }
}

export const markProfileUnlocked = (userId) => {
    try {
        sessionStorage.setItem('jf_unlocked_' + userId, '1');
    } catch {
    }
}

export const markProfilePicked = () => {
    try {
        sessionStorage.setItem('jf_picked', '1');
    } catch {
    }
}

export const wasProfilePicked = () => {
    try {
        return sessionStorage.getItem('jf_picked') === '1';
    } catch {
        return true;
    }
}

export const clearProfilePicked = () => {
    try {
        sessionStorage.removeItem('jf_picked');
    } catch {
    }
}

export const signOut = () => {
    const left = removeAccount(_userId);
    clearCache();
    if (!left) import('@/common/utils/remote').then((m) => m.disconnectRemote()).catch(() => {
    });
    return left;
}

export const refreshActiveAccount = async () => {
    if (!_userId) return;
    try {
        const u = await api(`/Users/${_userId}`);
        if (u?.Id) upsertAccount({userId: u.Id, token: _token, name: u.Name, imageTag: u.PrimaryImageTag || null});
    } catch {
    }
}

export const restoreSession = async () => {
    while (_token && _userId) {
        let r;
        try {
            r = await fetch(`${SERVER}/Users/${_userId}`, {
                headers: {'X-Emby-Authorization': authHeader(_token), 'X-Emby-Token': _token},
                signal: AbortSignal.timeout(8000),
            });
        } catch {
            return false;
        }
        if (r.ok) {
            mirrorNativeAuth();
            return true;
        }
        if (r.status >= 500) return false;
        removeAccount(_userId);
        if (getActiveAccount() && getServer(getActiveAccount().serverId)?.url !== SERVER) {
            window.location.reload();
            return false;
        }
    }
    return false;
}

export const api = async (path, params = {}, opts = {}) => {
    const url = new URL(SERVER + path);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
    const res = await fetch(url, {
        ...opts,
        headers: {
            'X-Emby-Token': _token,
            'X-Emby-Authorization': authHeader(_token),
            ...(opts.body ? {'Content-Type': 'application/json'} : {}),
            ...opts.headers,
        },
    });
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}
