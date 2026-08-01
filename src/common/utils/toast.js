const bus = typeof window !== 'undefined' ? new EventTarget() : null;

let nextId = 0;

export const toast = (message, {header, duration} = {}) => {
    bus?.dispatchEvent(new CustomEvent('toast', {detail: {id: ++nextId, text: message, header, duration}}));
}

export const onToast = (fn) => {
    if (!bus) return () => {
    };
    const h = (e) => fn(e.detail);
    bus.addEventListener('toast', h);
    return () => bus.removeEventListener('toast', h);
}
