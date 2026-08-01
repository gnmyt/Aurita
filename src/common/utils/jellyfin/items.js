import {api, getToken, getUserId, SERVER_URL} from './client';
import {backdropUrl} from './images';
import {youTubeId} from '@/common/utils/youtube';

const FIELDS = 'PrimaryImageAspectRatio,Overview,Genres,UserData,ParentId,ProductionYear,RunTimeTicks,SeriesName,Status';
const STD = {Fields: FIELDS, EnableImageTypes: 'Primary,Backdrop,Thumb'};

export const getViews = () => {
    return api(`/Users/${getUserId()}/Views`).then((d) => d.Items);
}

export const getResume = () => {
    return api(`/Users/${getUserId()}/Items/Resume`, {
        Limit: 24, MediaTypes: 'Video', Recursive: true, ...STD,
    }).then((d) => d.Items);
}

export const getNextUp = () => {
    return api(`/Shows/NextUp`, {
        UserId: getUserId(), Limit: 24, ...STD,
    }).then((d) => d.Items);
}

export const getLatest = (parentId, limit = 20) => {
    return api(`/Users/${getUserId()}/Items/Latest`, {
        ParentId: parentId, Limit: limit, ...STD,
    });
}

export const getItems = (params = {}) => {
    return api(`/Users/${getUserId()}/Items`, {
        ...STD,
        ...params,
    });
}

export const getItem = (id) => {
    return api(`/Users/${getUserId()}/Items/${id}`, {Fields: FIELDS + ',MediaSources,MediaStreams,People,Studios,Trickplay,RemoteTrailers,Chapters'});
}

export const trickplayInfo = (item, mediaSourceId) => {
    const tp = item?.Trickplay;
    if (!tp) return null;
    const forSource = tp[mediaSourceId] || tp[Object.keys(tp)[0]];
    if (!forSource) return null;
    const widths = Object.keys(forSource).map(Number).sort((a, b) => a - b);
    const w = widths.at(-1);
    const info = forSource[String(w)];
    return info ? {...info, width: w, itemId: item.Id} : null;
}

export const trickplayTileUrl = (info, tileIndex) => {
    return `${SERVER_URL}/Videos/${info.itemId}/Trickplay/${info.width}/${tileIndex}.jpg?api_key=${getToken()}`;
}

export const getSeasons = (seriesId) => {
    return api(`/Shows/${seriesId}/Seasons`, {UserId: getUserId(), Fields: FIELDS, EnableImageTypes: 'Primary'})
        .then((d) => d.Items);
}

export const getEpisodes = (seriesId, seasonId) => {
    return api(`/Shows/${seriesId}/Episodes`, {
        UserId: getUserId(), SeasonId: seasonId, Fields: FIELDS,
        EnableImageTypes: 'Primary,Thumb',
    }).then((d) => d.Items);
}

export const getNextEpisode = async (seriesId, episodeId) => {
    if (!seriesId) return null;
    const d = await api(`/Shows/${seriesId}/Episodes`, {
        UserId: getUserId(), AdjacentTo: episodeId, Fields: FIELDS,
        EnableImageTypes: 'Primary,Thumb',
    }).catch(() => null);
    const items = d?.Items || [];
    const idx = items.findIndex((e) => e.Id === episodeId);
    if (idx >= 0 && items[idx + 1]) return items[idx + 1];
    return null;
}

export const playbackQueueIds = async (item) => {
    if (item?.Type !== 'Episode' || !item.SeriesId) return [item.Id];
    const eps = await getEpisodes(item.SeriesId).catch(() => null);
    const idx = eps?.findIndex((e) => e.Id === item.Id) ?? -1;
    if (idx < 0) return [item.Id];
    return eps.slice(idx).map((e) => e.Id);
}

const _folderCache = new Map();

const fetchFolder = (id) => {
    if (_folderCache.has(id)) return _folderCache.get(id);
    const p = api(`/Users/${getUserId()}/Items/${id}`).catch(() => null);
    _folderCache.set(id, p);
    return p;
}

const isMovieFolder = (folder, items) => {
    const base = (folder?.Name || '').toLowerCase();
    return !!base && items.every((x) => (x.Name || '').toLowerCase().startsWith(base));
}

export const search = async (term) => {
    const d = await api(`/Users/${getUserId()}/Items`, {
        SearchTerm: term, Recursive: true,
        IncludeItemTypes: 'Movie,Series,Person',
        Limit: 60, ...STD,
    });
    const items = d.Items || [];
    const byParent = new Map();
    for (const it of items) {
        if (it.Type !== 'Movie' || !it.ParentId) continue;
        if (!byParent.has(it.ParentId)) byParent.set(it.ParentId, []);
        byParent.get(it.ParentId).push(it);
    }
    const drop = new Set();
    await Promise.all([...byParent.entries()].map(async ([pid, arr]) => {
        if (arr.length < 2) return;
        const folder = await fetchFolder(pid);
        if (!isMovieFolder(folder, arr)) return;
        const [, ...extras] = [...arr].sort((x, y) => x.Name.length - y.Name.length);
        extras.forEach((x) => drop.add(x.Id));
    }));
    return items.filter((i) => !drop.has(i.Id));
}

export const getMovieExtras = async (item) => {
    if (item?.Type !== 'Movie' || !item.ParentId) return [];
    const folder = await fetchFolder(item.ParentId);
    if (!folder || (folder.ChildCount || 0) > 20) return [];
    const d = await api(`/Users/${getUserId()}/Items`, {
        ParentId: item.ParentId, IncludeItemTypes: 'Movie', Limit: 24, ...STD,
    }).catch(() => null);
    const kids = d?.Items || [];
    if (!isMovieFolder(folder, kids)) return [];
    return kids.filter((k) => k.Id !== item.Id);
}

export const setPlayed = (itemId, played) => {
    return api(`/UserPlayedItems/${itemId}`, {userId: getUserId()}, {method: played ? 'POST' : 'DELETE'});
}

export const setFavorite = (itemId, favorite) => {
    return api(`/UserFavoriteItems/${itemId}`, {userId: getUserId()}, {method: favorite ? 'POST' : 'DELETE'});
}

export const removeFromResume = async (itemId) => {
    const body = JSON.stringify({PlaybackPositionTicks: 0});
    try {
        return await api(`/UserItems/${itemId}/UserData`, {userId: getUserId()}, {method: 'POST', body});
    } catch {
        return api(`/Users/${getUserId()}/Items/${itemId}/UserData`, {}, {method: 'POST', body}).catch(() => {
        });
    }
}

export const getFavorites = (limit = 24) => {
    return api(`/Users/${getUserId()}/Items`, {
        Filters: 'IsFavorite', Recursive: true,
        IncludeItemTypes: 'Movie,Series',
        SortBy: 'SortName', Limit: limit, Fields: FIELDS,
        EnableImageTypes: 'Primary,Backdrop,Thumb,Logo',
    }).then((d) => d.Items);
}

export const getTrailerMovies = (limit = 40) => {
    return api(`/Users/${getUserId()}/Items`, {
        IncludeItemTypes: 'Movie', Recursive: true, hasTrailer: true,
        SortBy: 'Random', Limit: limit,
        Fields: 'RemoteTrailers,Overview,Genres,ProductionYear,CommunityRating',
        EnableImageTypes: 'Backdrop,Primary',
    }).then((d) => (d.Items || [])
        .map((it) => ({
            id: it.Id,
            name: it.Name,
            overview: it.Overview,
            year: it.ProductionYear,
            genres: it.Genres || [],
            rating: it.CommunityRating,
            backdrop: backdropUrl(it, 1280),
            youtubeId: youTubeId(it.RemoteTrailers?.[0]?.Url),
        }))
        .filter((t) => t.youtubeId),
    ).catch(() => []);
}

export const getSuggestions = (limit = 20) => {
    return api('/Items/Suggestions', {
        userId: getUserId(), limit, type: 'Movie,Series',
        enableTotalRecordCount: false,
    }).then((d) => d.Items || []).catch(() => []);
}

export const getSimilar = (itemId, limit = 16) => {
    return api(`/Items/${itemId}/Similar`, {
        userId: getUserId(), limit, fields: FIELDS,
    }).then((d) => d.Items || []).catch(() => []);
}

export const getSpotlight = (limit = 6) => {
    return api(`/Users/${getUserId()}/Items`, {
        Recursive: true, IncludeItemTypes: 'Movie,Series',
        SortBy: 'Random', Limit: limit * 3, Fields: FIELDS,
        ImageTypes: 'Backdrop',
        EnableImageTypes: 'Backdrop,Logo,Primary',
    }).then((d) => (d.Items || []).filter((i) => i.BackdropImageTags?.length).slice(0, limit));
}

export const getGenres = (parentId) => {
    return api('/Genres', {
        userId: getUserId(), parentId, SortBy: 'SortName',
    }).then((d) => d.Items || []).catch(() => []);
}

export const getMediaSegments = (itemId) => {
    return api(`/MediaSegments/${itemId}`, {includeSegmentTypes: 'Intro,Outro'})
        .then((d) => d.Items || []).catch(() => []);
}
