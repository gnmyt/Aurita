import {useTranslation} from 'react-i18next';

export const Loader = ({label}) => {
    const {t} = useTranslation();
    const text = label === undefined ? t('common.loader.label') : label;
    return (
        <div className="page-loader">
            <div className="spinner"/>
            {text && <div className="page-loader-text">{text}</div>}
        </div>
    );
}
