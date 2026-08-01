import {SERVER_URL} from './client';
import {getServer} from './servers';

const buildImageUrl = (itemId, type, tag, {width, height} = {}) => {
    if (!SERVER_URL || !itemId || !tag) return null;
    const u = new URL(`${SERVER_URL}/Items/${itemId}/Images/${type}`);
    u.searchParams.set('tag', tag);
    u.searchParams.set('quality', '90');
    if (width) u.searchParams.set('maxWidth', width);
    if (height) u.searchParams.set('maxHeight', height);
    return u.toString();
}

export const userImageUrl = (account, size = 320) => {
    const base = getServer(account?.serverId)?.url;
    if (!base || !account?.imageTag) return null;
    const u = new URL(`${base}/Users/${account.userId}/Images/Primary`);
    u.searchParams.set('tag', account.imageTag);
    u.searchParams.set('quality', '90');
    u.searchParams.set('width', size);
    return u.toString();
}

const AVATAR_COLORS = [
    ['#7b3fe4', '#a05cff'], ['#00b3a4', '#2ee6cf'], ['#3fae29', '#7ed957'],
    ['#d83a3a', '#ff6a6a'], ['#2b7fff', '#5aa0ff'], ['#e8821e', '#ffb04a'],
    ['#d6326b', '#ff6aa0'], ['#1f7fd1', '#5fb2ff'],
];

export const accountColor = (userId) => {
    const s = String(userId || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const itemTag = (item, type) => {
    if (type === 'Primary') return item.ImageTags?.Primary;
    if (type === 'Thumb') return item.ImageTags?.Thumb;
    if (type === 'Backdrop') return item.BackdropImageTags?.[0];
    return null;
}

const imageUrl = (item, {type = 'Primary', maxWidth = 600, maxHeight} = {}) => {
    if (!item) return null;
    return buildImageUrl(item.Id, type, itemTag(item, type), {width: maxWidth, height: maxHeight});
}

export const wideImage = (item, width = 500) => {
    if (!item) return null;
    if (item.Type === 'Episode' && item.ImageTags?.Primary) return imageUrl(item, {type: 'Primary', maxWidth: width});
    if (item.ImageTags?.Thumb) return imageUrl(item, {type: 'Thumb', maxWidth: width});
    if (item.BackdropImageTags?.length) return imageUrl(item, {type: 'Backdrop', maxWidth: width});
    if (item.ParentThumbImageTag) return buildImageUrl(item.ParentThumbItemId, 'Thumb', item.ParentThumbImageTag, {width});
    if (item.ParentBackdropImageTags?.length) {
        return buildImageUrl(item.ParentBackdropItemId, 'Backdrop', item.ParentBackdropImageTags[0], {width});
    }
    return imageUrl(item, {type: 'Primary', maxWidth: width});
}

export const posterImage = (item, width = 400) => {
    if (item?.Type === 'Episode' && item.SeriesId && item.SeriesPrimaryImageTag) {
        return buildImageUrl(item.SeriesId, 'Primary', item.SeriesPrimaryImageTag, {width});
    }
    return imageUrl(item, {type: 'Primary', maxWidth: width});
}

export const logoUrl = (item, width = 600) => {
    if (!item) return null;
    if (item.ImageTags?.Logo) return buildImageUrl(item.Id, 'Logo', item.ImageTags.Logo, {width});
    if (item.ParentLogoImageTag && item.ParentLogoItemId) {
        return buildImageUrl(item.ParentLogoItemId, 'Logo', item.ParentLogoImageTag, {width});
    }
    return null;
}

export const personImage = (person, width = 240) => {
    return buildImageUrl(person?.Id, 'Primary', person?.PrimaryImageTag, {width});
}

export const backdropUrl = (item, width = 1920) => {
    if (!item) return null;
    if (item.BackdropImageTags?.length) return imageUrl(item, {type: 'Backdrop', maxWidth: width});
    if (item.ParentBackdropImageTags?.length) {
        return buildImageUrl(item.ParentBackdropItemId, 'Backdrop', item.ParentBackdropImageTags[0], {width});
    }
    return wideImage(item, width);
}
