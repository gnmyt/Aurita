import {authHeader, upsertAccount} from './client';

export const quickConnectEnabled = async (server) => {
    try {
        const r = await fetch(`${server.url}/QuickConnect/Enabled`, {
            headers: {'X-Emby-Authorization': authHeader(null)},
        });
        if (!r.ok) return false;
        return (await r.json()) === true;
    } catch {
        return false;
    }
}

export const quickConnectInitiate = async (server) => {
    const r = await fetch(`${server.url}/QuickConnect/Initiate`, {
        method: 'POST',
        headers: {'X-Emby-Authorization': authHeader(null)},
    });
    if (!r.ok) throw new Error('Quick Connect konnte nicht gestartet werden (' + r.status + ')');
    return r.json();
}

export const quickConnectPoll = async (server, secret) => {
    const r = await fetch(`${server.url}/QuickConnect/Connect?secret=${encodeURIComponent(secret)}`, {
        headers: {'X-Emby-Authorization': authHeader(null)},
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Quick Connect Fehler (' + r.status + ')');
    return r.json();
}

export const authenticateWithQuickConnect = async (server, secret) => {
    const r = await fetch(`${server.url}/Users/AuthenticateWithQuickConnect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Emby-Authorization': authHeader(null),
        },
        body: JSON.stringify({Secret: secret}),
    });
    if (!r.ok) throw new Error('Anmeldung fehlgeschlagen (' + r.status + ')');
    const data = await r.json();
    upsertAccount({
        userId: data.User.Id,
        token: data.AccessToken,
        name: data.User.Name,
        imageTag: data.User.PrimaryImageTag || null,
        serverId: server.id,
    });
    return data.User;
}
