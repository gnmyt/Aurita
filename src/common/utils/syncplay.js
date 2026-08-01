import {api, authHeader, getToken, SERVER_URL} from '@/common/utils/jellyfin';
import {onRemote} from '@/common/utils/remote';
import {BRAND} from '@/common/utils/brand';

const post = (path, body) => api(path, {}, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
}).catch(() => null);

let offset = 0;
let timeSyncTimer = null;

const sampleTime = async () => {
    const t0 = Date.now();
    const res = await fetch(`${SERVER_URL}/GetUtcTime`, {
        headers: {'X-Emby-Token': getToken(), 'X-Emby-Authorization': authHeader(getToken())},
    });
    const t3 = Date.now();
    if (!res.ok) throw new Error(`GetUtcTime failed: ${res.status}`);
    const j = await res.json();
    const t1 = Date.parse(j.RequestReceptionTime);
    const t2 = Date.parse(j.ResponseTransmissionTime);
    return {off: ((t1 - t0) + (t2 - t3)) / 2, rtt: (t3 - t0) - (t2 - t1)};
}

const syncTime = async () => {
    const got = [];
    for (let i = 0; i < 5; i++) {
        try {
            got.push(await sampleTime());
        } catch {
        }
    }
    if (!got.length) return;
    got.sort((a, b) => a.rtt - b.rtt);
    const best = got.slice(0, Math.max(1, Math.ceil(got.length / 2)));
    offset = best.reduce((s, x) => s + x.off, 0) / best.length;
}

export const serverToLocal = (whenIso) => {
    return Date.parse(whenIso) - offset;
}

export const serverNowIso = () => {
    return new Date(Date.now() + offset).toISOString();
}

const startTimeSync = () => {
    syncTime();
    clearInterval(timeSyncTimer);
    timeSyncTimer = setInterval(syncTime, 30000);
}

const stopTimeSync = () => {
    clearInterval(timeSyncTimer);
    timeSyncTimer = null;
}

let group = null;
let playlistItemId = null;
let pendingQueue = null;

const subs = {group: new Set(), queue: new Set(), command: new Set(), state: new Set()};

export const onSync = (type, fn) => {
    subs[type].add(fn);
    return () => subs[type].delete(fn);
}

const emit = (type, d) => {
    subs[type].forEach((f) => {
        try {
            f(d);
        } catch {
        }
    });
}

export const getGroup = () => {
    return group;
}

export const isInGroup = () => {
    return !!group;
}

export const getPlaylistItemId = () => {
    return playlistItemId;
}

export const takePendingQueue = () => {
    return pendingQueue;
}

const refreshGroup = async () => {
    if (!group) return;
    const list = await listGroups();
    const g = list.find((x) => x.GroupId === group.GroupId);
    if (g) {
        group = {...group, ...g};
        emit('group', group);
    }
}

const handleGroupUpdate = (d) => {
    switch (d.Type) {
        case 'GroupJoined':
            group = {...d.Data};
            emit('group', group);
            startTimeSync();
            break;
        case 'GroupLeft':
            group = null;
            playlistItemId = null;
            pendingQueue = null;
            emit('group', null);
            stopTimeSync();
            break;
        case 'UserJoined':
        case 'UserLeft':
            refreshGroup();
            break;
        case 'StateUpdate':
            if (group) {
                group = {...group, State: d.Data.State};
                emit('group', group);
                emit('state', d.Data);
            }
            break;
        case 'PlayQueue': {
            pendingQueue = d.Data;
            const cur = d.Data.Playlist?.[d.Data.PlayingItemIndex] || d.Data.Playlist?.[0];
            playlistItemId = cur?.PlaylistItemId || null;
            emit('queue', d.Data);
            break;
        }
        case 'GroupDoesNotExist':
        case 'NotInGroup':
            group = null;
            emit('group', null);
            stopTimeSync();
            break;
        default:
            break;
    }
}

const handleCommand = (d) => {
    if (d.PlaylistItemId && d.PlaylistItemId !== '00000000000000000000000000000000') playlistItemId = d.PlaylistItemId;
    emit('command', d);
}

let disposeRemote = null;

export const initSyncPlay = () => {
    if (!disposeRemote) {
        const offGroup = onRemote('syncplaygroup', handleGroupUpdate);
        const offCmd = onRemote('syncplaycommand', handleCommand);
        disposeRemote = () => {
            offGroup();
            offCmd();
            stopTimeSync();
            disposeRemote = null;
        };
    }
    return disposeRemote;
}

export const listGroups = () => api('/SyncPlay/List').catch(() => []);
export const newGroup = (name) => post('/SyncPlay/New', {GroupName: name || BRAND});
export const joinGroup = (id) => post('/SyncPlay/Join', {GroupId: id});
export const leaveGroup = () => post('/SyncPlay/Leave');
export const spSetNewQueue = (itemIds, pos = 0, startTicks = 0) =>
    post('/SyncPlay/SetNewQueue', {PlayingQueue: itemIds, PlayingItemPosition: pos, StartPositionTicks: startTicks});
export const spUnpause = () => post('/SyncPlay/Unpause');
export const spPause = () => post('/SyncPlay/Pause');
export const spSeek = (ticks) => post('/SyncPlay/Seek', {PositionTicks: Math.max(0, Math.floor(ticks))});
export const spReady = (p) => post('/SyncPlay/Ready', p);
export const spBuffering = (p) => post('/SyncPlay/Buffering', p);
