import {fmtRuntime} from './time';

export const BLANK_POSTER = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

export const itemMetaLine = (item, {maxGenres = 2, runtime = false} = {}) => {
    const meta = [];
    if (item.ProductionYear) meta.push(item.ProductionYear);
    if (item.OfficialRating) meta.push(item.OfficialRating);
    if (runtime) {
        const rt = fmtRuntime(item.RunTimeTicks);
        if (rt) meta.push(rt);
    }
    if (item.Genres?.length) meta.push(item.Genres.slice(0, maxGenres).join(', '));
    return meta;
}
