import i18n from '@/i18n';

export const TICKS_PER_SEC = 10000000;
const ticksToSec = (ticks) => (ticks || 0) / TICKS_PER_SEC;

export const fmtClock = (sec) => {
    if (!isFinite(sec)) return '0:00';
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export const fmtDuration = (ticks) => (ticks ? fmtClock(ticksToSec(ticks)) : null);

export const fmtRuntime = (ticks) => {
    if (!ticks) return null;
    const min = Math.round(ticksToSec(ticks) / 60);
    if (min < 60) return i18n.t('media.runtime.minutes', {count: min});
    return i18n.t('media.runtime.hoursMinutes', {hours: Math.floor(min / 60), minutes: min % 60});
}
