import "./styles.sass";
import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {Delete, Space, X} from 'lucide-react';
import Card from '@/common/components/Card';
import PersonCard from '@/common/components/PersonCard';
import {useAutoFocusFirst, useFocusable} from '@/common/contexts/SpatialNav';
import {useOpenItem} from '@/common/utils/navigation';
import {search} from '@/common/utils/jellyfin';

const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

const Key = ({label, Icon, wide, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className={`key${wide ? ' wide' : ''}`} {...handlers}>
            {Icon && <Icon size={20} strokeWidth={2}/>}
            {label && <span>{label}</span>}
        </div>
    );
}

export const Search = () => {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const openItem = useOpenItem();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searched, setSearched] = useState(false);
    const queryRef = useRef(query);
    queryRef.current = query;
    useAutoFocusFirst(true);

    useEffect(() => {
        const onKey = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key.length === 1 && /[\p{L}\p{N} ]/u.test(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                setQuery((q) => q + e.key.toUpperCase());
            } else if (e.key === 'Backspace' && queryRef.current) {
                e.preventDefault();
                e.stopPropagation();
                setQuery((q) => q.slice(0, -1));
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    useEffect(() => {
        if (query.trim().length < 1) {
            setResults([]);
            setSearched(false);
            return undefined;
        }
        let alive = true;
        const t = setTimeout(async () => {
            const r = await search(query.trim());
            if (!alive) return;
            setResults(r || []);
            setSearched(true);
        }, 350);
        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, [query]);

    const people = results.filter((r) => r.Type === 'Person');
    const media = results.filter((r) => r.Type !== 'Person');

    return (
        <div className="search-page">
            <div className="keyboard">
                <div className="search-box">
                    {query
                        ? <span>{query}</span>
                        : <span className="ph">{t('search.placeholder')}</span>}
                    <span className="cursor"/>
                </div>
                <div className="kb-grid">
                    {KEYS.map((k, i) => (
                        <Key key={k} label={k} focusKey={i === 0 ? 'search-first' : undefined}
                             onSelect={() => setQuery((q) => q + k)}/>
                    ))}
                    <Key Icon={Space} label={t('search.space')} wide onSelect={() => setQuery((q) => q + ' ')}/>
                    <Key Icon={Delete} label={t('search.delete')} wide onSelect={() => setQuery((q) => q.slice(0, -1))}/>
                    <Key Icon={X} label={t('search.clear')} wide onSelect={() => setQuery('')}/>
                </div>
            </div>
            <div className="search-results">
                {searched && results.length === 0 ? (
                    <div className="empty">{t('search.noResults', {query})}</div>
                ) : (
                    <>
                        {people.length > 0 && (
                            <div className="row" style={{marginBottom: 18}}>
                                <div className="row-title" style={{padding: '0 0 8px'}}>{t('search.people')}</div>
                                <div className="row-track" style={{padding: '8px 0'}}>
                                    {people.map((p) => (
                                        <PersonCard key={p.Id} person={p}
                                                    onSelect={() => navigate(`/person/${p.Id}/${encodeURIComponent(p.Name)}`)}/>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="grid" style={{padding: 0}}>
                            {media.map((item) => (
                                <Card key={item.Id} item={item} onSelect={() => openItem(item)}/>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
