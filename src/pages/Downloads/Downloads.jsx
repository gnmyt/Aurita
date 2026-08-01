import './styles.sass';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {CheckCircle2, Download as DownloadIcon, Trash2, TriangleAlert} from 'lucide-react';
import SettingRow from '@/common/components/SettingRow';
import {useAutoFocusFirst} from '@/common/contexts/SpatialNav';
import {useOpenItem} from '@/common/utils/navigation';
import {downloadsSupported, onDownloads, removeDownload} from '@/common/utils/downloads';

const STATE_RUNNING = 0;
const STATE_DONE = 1;

const titleFor = (item, fallback) => {
    if (!item) return fallback;
    if (item.Type === 'Episode') {
        const code = item.ParentIndexNumber != null && item.IndexNumber != null
            ? `S${item.ParentIndexNumber}E${item.IndexNumber} · ` : '';
        return `${item.SeriesName || item.Name} — ${code}${item.Name}`;
    }
    return item.Name;
}

export const Downloads = () => {
    const {t} = useTranslation();
    const openItem = useOpenItem();
    const [items, setItems] = useState([]);

    useEffect(() => onDownloads(setItems), []);

    useAutoFocusFirst(items.length > 0);

    if (!downloadsSupported()) {
        return (
            <div className="page">
                <h1 className="settings-head">{t('downloads.title')}</h1>
                <p className="settings-note">{t('downloads.unsupported')}</p>
            </div>
        );
    }

    return (
        <div className="page">
            <h1 className="settings-head">{t('downloads.title')}</h1>

            <div className="settings-card">
                {items.length === 0 ? (
                    <SettingRow
                        icon={<DownloadIcon size={26}/>}
                        title={t('downloads.empty')}
                        subtitle={t('downloads.emptySub')}
                    />
                ) : items.map((d, i) => {
                    const percent = Math.round((d.progress || 0) * 100);
                    const icon = d.state === STATE_DONE
                        ? <CheckCircle2 size={26}/>
                        : d.state === STATE_RUNNING ? <DownloadIcon size={26}/> : <TriangleAlert size={26}/>;
                    const subtitle = d.state === STATE_DONE
                        ? t('downloads.ready')
                        : d.state === STATE_RUNNING
                            ? t('downloads.progress', {percent})
                            : t('downloads.failed');
                    return (
                        <SettingRow
                            key={d.itemId}
                            focusKey={i === 0 ? 'dl-first' : undefined}
                            icon={icon}
                            title={titleFor(d.item, d.itemId)}
                            subtitle={subtitle}
                            value={<Trash2 size={20}/>}
                            chevron={false}
                            onSelect={() => (d.state === STATE_DONE && d.item
                                ? openItem(d.item)
                                : removeDownload(d.itemId))}
                        />
                    );
                })}
            </div>

            {items.length > 0 && <p className="settings-note">{t('downloads.hint')}</p>}
        </div>
    );
}
