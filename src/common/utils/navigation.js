import {useNavigate} from 'react-router-dom';

export const useOpenItem = () => {
    const navigate = useNavigate();
    return (item) => {
        if (item.Type === 'Episode') navigate(`/play/${item.Id}`);
        else if (item.IsFolder && item.Type !== 'Series' && item.Type !== 'Season') navigate(`/library/${item.Id}`);
        else navigate(`/detail/${item.Id}`);
    };
}
