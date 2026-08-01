import {api, getDeviceId, getToken, SERVER_URL} from '@/common/utils/jellyfin';

const listeners = {
    playstate: new Set(),
    general: new Set(),
    play: new Set(),
    syncplaycommand: new Set(),
    syncplaygroup: new Set(),
};

export const onRemote = (type, fn) => {
    listeners[type].add(fn);
    return () => listeners[type].delete(fn);
}

const emit = (type, data) => {
    (listeners[type] || []).forEach((fn) => {
        try {
            fn(data);
        } catch {
        }
    });
}

let ws = null;
let kaTimer = null;
let reconnectTimer = null;
let reconnectDelay = 4000;
let manualClose = false;

const reportCapabilities = () => {
    return api('/Sessions/Capabilities/Full', {}, {
        method: 'POST',
        body: JSON.stringify({
            PlayableMediaTypes: ['Video', 'Audio'],
            SupportedCommands: [
                'DisplayMessage', 'DisplayContent', 'GoHome', 'GoToSearch', 'GoToSettings',
                'Mute', 'Unmute', 'ToggleMute', 'SetVolume', 'VolumeUp', 'VolumeDown',
                'SetAudioStreamIndex', 'SetSubtitleStreamIndex', 'PlayState', 'PlayNext',
            ],
            SupportsMediaControl: true,
            SupportsPersistentIdentifier: true,
        }),
    }).catch(() => {
    });
}

const sendKeepAlive = () => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({MessageType: 'KeepAlive'}));
}

const startKeepAlive = (seconds) => {
    clearInterval(kaTimer);
    kaTimer = setInterval(sendKeepAlive, Math.max(10, (seconds || 60) / 2) * 1000);
    sendKeepAlive();
}

export const connectRemote = () => {
    if (!getToken()) return;
    manualClose = false;
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
    reportCapabilities();
    const host = SERVER_URL.replace(/^https?:\/\//, '');
    const proto = SERVER_URL.startsWith('https') ? 'wss' : 'ws';
    try {
        ws = new WebSocket(`${proto}://${host}/socket?api_key=${getToken()}&deviceId=${encodeURIComponent(getDeviceId())}`);
    } catch {
        scheduleReconnect();
        return;
    }
    ws.onopen = () => {
        reconnectDelay = 4000;
        sendKeepAlive();
    };
    ws.onmessage = (e) => {
        let m;
        try {
            m = JSON.parse(e.data);
        } catch {
            return;
        }
        handle(m);
    };
    ws.onclose = () => {
        clearInterval(kaTimer);
        if (!manualClose) scheduleReconnect();
    };
    ws.onerror = () => {
        try {
            ws.close();
        } catch {
        }
    };
}

export const disconnectRemote = () => {
    manualClose = true;
    clearTimeout(reconnectTimer);
    clearInterval(kaTimer);
    if (ws) {
        try {
            ws.close();
        } catch {
        }
        ws = null;
    }
}

const scheduleReconnect = () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectRemote, reconnectDelay);
    reconnectDelay = Math.min(60000, reconnectDelay * 2);
}

const handle = (m) => {
    switch (m.MessageType) {
        case 'ForceKeepAlive':
            startKeepAlive(m.Data);
            break;
        case 'KeepAlive':
            break;
        case 'Playstate':
            emit('playstate', m.Data);
            break;
        case 'GeneralCommand':
            emit('general', m.Data);
            break;
        case 'Play':
            emit('play', m.Data);
            break;
        case 'SyncPlayCommand':
            emit('syncplaycommand', m.Data);
            break;
        case 'SyncPlayGroupUpdate':
            emit('syncplaygroup', m.Data);
            break;
        default:
            break;
    }
}
