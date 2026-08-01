import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {LogOut, Plus, Users} from 'lucide-react';
import {useAutoFocusFirst} from '@/common/contexts/SpatialNav';
import {getGroup, joinGroup, leaveGroup, listGroups, newGroup, onSync} from '@/common/utils/syncplay';
import SettingRow from '@/common/components/SettingRow';
import {BRAND} from '@/common/utils/brand';

export const SyncPlay = () => {
    const {t} = useTranslation();
    const [groups, setGroups] = useState([]);
    const [group, setGroupState] = useState(getGroup());
    const [loading, setLoading] = useState(true);

    const alive = useRef(true);
    useEffect(() => () => {
        alive.current = false;
    }, []);

    const refresh = useCallback((silent = false) => {
        if (!silent) setLoading(true);
        listGroups().then((g) => {
            if (!alive.current) return;
            setGroups(g || []);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        refresh();
        const off = onSync('group', (g) => {
            setGroupState(g);
            refresh(true);
        });
        const iv = setInterval(() => refresh(true), 5000);
        return () => {
            off();
            clearInterval(iv);
        };
    }, [refresh]);

    useAutoFocusFirst(!loading);

    return (
        <div className="settings">
            <h1 className="settings-head">{t('syncPlay.title')}</h1>

            {group ? (
                <>
                    <div className="settings-section">{t('syncPlay.yourGroup')}</div>
                    <div className="settings-card">
                        <SettingRow
                            icon={<Users size={26}/>}
                            title={group.GroupName}
                            subtitle={t('syncPlay.members', {
                                members: (group.Participants || []).join(', ') || t('syncPlay.noMembers'),
                                state: group.State,
                            })}
                        />
                        <SettingRow
                            icon={<LogOut size={26}/>}
                            title={t('syncPlay.leaveGroup')}
                            subtitle={t('syncPlay.leaveGroupSub')}
                            chevron
                            danger
                            focusKey="sp-first"
                            onSelect={() => leaveGroup()}
                        />
                    </div>
                    <p className="settings-note">{t('syncPlay.groupNote')}</p>
                </>
            ) : (
                <>
                    <div className="settings-section">{t('syncPlay.actions')}</div>
                    <div className="settings-card">
                        <SettingRow
                            icon={<Plus size={26}/>}
                            title={t('syncPlay.createGroup')}
                            subtitle={t('syncPlay.createGroupSub')}
                            chevron
                            focusKey="sp-first"
                            onSelect={() => newGroup(t('syncPlay.defaultGroupName', {brand: BRAND}))}
                        />
                    </div>

                    <div className="settings-section">{t('syncPlay.availableGroups')}</div>
                    <div className="settings-card">
                        {loading ? (
                            <SettingRow title={t('syncPlay.loading')}/>
                        ) : groups.length === 0 ? (
                            <SettingRow
                                title={t('syncPlay.noGroups')}
                                subtitle={t('syncPlay.noGroupsSub')}
                            />
                        ) : (
                            groups.map((g) => (
                                <SettingRow
                                    key={g.GroupId}
                                    icon={<Users size={26}/>}
                                    title={g.GroupName}
                                    subtitle={t('syncPlay.groupSummary', {
                                        members: (g.Participants || []).join(', ') || t('syncPlay.empty'),
                                        state: g.State,
                                    })}
                                    chevron
                                    onSelect={() => joinGroup(g.GroupId)}
                                />
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
