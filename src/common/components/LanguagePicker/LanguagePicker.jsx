import "./styles.sass";
import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Check} from 'lucide-react';
import {isBackKey, useFocusable, useKeyTrap, useSpatial} from '@/common/contexts/SpatialNav';
import i18n, {languages, setLang} from '@/i18n';

const LanguageOption = ({language, active, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className="lang-opt" {...handlers}>
            <span className="lang-opt-check">{active && <Check size={20} strokeWidth={3}/>}</span>
            <span className="lang-opt-name">{language.name}</span>
        </div>
    );
}

export const LanguagePicker = ({onClose}) => {
    const {t} = useTranslation();
    const spatial = useSpatial();

    useEffect(() => {
        const active = languages.findIndex((l) => l.code === i18n.resolvedLanguage);
        const timer = setTimeout(() => spatial.focusId(`lang-${Math.max(0, active)}`), 0);
        return () => clearTimeout(timer);
    }, [spatial]);

    useKeyTrap((e) => {
        if (isBackKey(e)) {
            e.preventDefault();
            e.stopPropagation();
            onClose();
        }
    });

    return (
        <div className="langpicker" data-modal>
            <div className="lang-panel">
                <div className="lang-title">{t('settings.languageTitle')}</div>
                <div className="lang-list">
                    {languages.map((language, i) => (
                        <LanguageOption
                            key={language.code}
                            language={language}
                            active={language.code === i18n.resolvedLanguage}
                            focusKey={`lang-${i}`}
                            onSelect={() => {
                                if (language.code === i18n.resolvedLanguage) onClose();
                                else setLang(language.code);
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
