import {useCallback, useEffect, useRef, useState} from 'react';
import {LogOut, Plus, Users} from 'lucide-react';
import {useAutoFocusFirst} from '@/common/contexts/SpatialNav';
import {getGroup, joinGroup, leaveGroup, listGroups, newGroup, onSync} from '@/common/utils/syncplay';
import SettingRow from '@/common/components/SettingRow';
import {BRAND} from '@/common/utils/brand';

export const SyncPlay = () => {
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
            <h1 className="settings-head">Gemeinsam ansehen</h1>

            {group ? (
                <>
                    <div className="settings-section">Deine Gruppe</div>
                    <div className="settings-card">
                        <SettingRow
                            icon={<Users size={26}/>}
                            title={group.GroupName}
                            subtitle={`Mitglieder: ${(group.Participants || []).join(', ') || '-'} · Status: ${group.State}`}
                        />
                        <SettingRow
                            icon={<LogOut size={26}/>}
                            title="Gruppe verlassen"
                            subtitle="Wiedergabe wird nicht mehr synchronisiert"
                            chevron
                            danger
                            focusKey="sp-first"
                            onSelect={() => leaveGroup()}
                        />
                    </div>
                    <p className="settings-note">
                        Starte einen Film oder eine Folge: die Wiedergabe wird mit allen in der Gruppe
                        synchronisiert. Pause, Wiedergabe und Spulen gelten für alle.
                    </p>
                </>
            ) : (
                <>
                    <div className="settings-section">Aktionen</div>
                    <div className="settings-card">
                        <SettingRow
                            icon={<Plus size={26}/>}
                            title="Neue Gruppe erstellen"
                            subtitle="Eröffne eine Wohnzimmer-Gruppe zum gemeinsamen Schauen"
                            chevron
                            focusKey="sp-first"
                            onSelect={() => newGroup(`${BRAND} Wohnzimmer`)}
                        />
                    </div>

                    <div className="settings-section">Verfügbare Gruppen</div>
                    <div className="settings-card">
                        {loading ? (
                            <SettingRow title="Lädt…"/>
                        ) : groups.length === 0 ? (
                            <SettingRow
                                title="Keine offenen Gruppen"
                                subtitle="Erstelle eine neue Gruppe, um gemeinsam zu schauen."
                            />
                        ) : (
                            groups.map((g) => (
                                <SettingRow
                                    key={g.GroupId}
                                    icon={<Users size={26}/>}
                                    title={g.GroupName}
                                    subtitle={`${(g.Participants || []).join(', ') || 'Leer'} · ${g.State}`}
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
