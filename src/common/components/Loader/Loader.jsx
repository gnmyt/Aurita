export const Loader = ({label = 'Lädt…'}) => {
    return (
        <div className="page-loader">
            <div className="spinner"/>
            {label && <div className="page-loader-text">{label}</div>}
        </div>
    );
}
