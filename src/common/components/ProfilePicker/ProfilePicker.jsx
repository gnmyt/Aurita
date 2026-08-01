import "./styles.sass";
import {useEffect, useState} from 'react';
import {Check, Pencil, Plus, Settings, X} from 'lucide-react';
import {isBackKey, useFocusable, useKeyTrap, useSpatial} from '@/common/contexts/SpatialNav';
import {
  getAccountPin,
  getAccounts,
  getServer,
  isProfileUnlocked,
  markProfileUnlocked,
  removeAccount
} from '@/common/utils/jellyfin';
import Avatar from '@/common/components/Avatar';
import PinPad from '@/common/components/PinPad';
import ConfirmDialog from '@/common/components/ConfirmDialog';

const ProfileTile = ({account, serverLabel, manage, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className={`profile-tile${manage ? ' manage' : ''}`} {...handlers}>
            <div className="profile-avatar-wrap">
                <Avatar account={account} size={160}/>
                {manage && <div className="profile-remove"><X size={26} strokeWidth={3}/></div>}
            </div>
            <span className="profile-name">{account.name}</span>
            {serverLabel && <span className="profile-server">{serverLabel}</span>}
        </div>
    );
}

const AddTile = ({onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className="profile-tile add" {...handlers}>
            <div className="profile-avatar-wrap">
                <div className="avatar add"><Plus size={56} strokeWidth={2.5}/></div>
            </div>
            <span className="profile-name">Profil hinzufügen</span>
        </div>
    );
}

export const ProfilePicker = ({onPick, onAdd, onClose, onEmpty, onSettings}) => {
    const [accounts, setAccounts] = useState(getAccounts);
    const [manage, setManage] = useState(false);
    const [pinFor, setPinFor] = useState(null);
    const [confirmDel, setConfirmDel] = useState(null);
    const spatial = useSpatial();

    const multiServer = new Set(accounts.map((a) => a.serverId)).size > 1;
    const serverLabel = (a) => {
        if (!multiServer) return null;
        const s = getServer(a.serverId);
        return s?.name || s?.url?.replace(/^https?:\/\//, '') || null;
    };

    useEffect(() => {
        if (pinFor) return undefined;
        const t = setTimeout(() => spatial.focusId('profile-0'), 0);
        return () => clearTimeout(t);
    }, [spatial, pinFor]);

    useKeyTrap((e) => {
        if (pinFor || confirmDel) return;
        if (isBackKey(e)) {
            e.preventDefault();
            e.stopPropagation();
            if (manage) setManage(false);
            else onClose();
        }
    }, !!onClose);

    const doRemove = (id) => {
        const left = removeAccount(id);
        const next = getAccounts();
        setAccounts(next);
        setConfirmDel(null);
        if (left === 0) {
            onEmpty?.();
            return;
        }
        if (next.length < 2) setManage(false);
        setTimeout(() => spatial.focusId('profile-manage'), 0);
    };

    const handleTile = (id) => {
        if (manage) {
            setConfirmDel(accounts.find((a) => a.userId === id));
            return;
        }
        const acc = accounts.find((a) => a.userId === id);
        if (acc?.pin && !isProfileUnlocked(id)) {
            setPinFor(acc);
            return;
        }
        onPick(id);
    };

    if (pinFor) {
        return (
            <PinPad
                mode="verify"
                eyebrow={pinFor.name}
                expected={getAccountPin(pinFor.userId)}
                onSuccess={() => {
                    const id = pinFor.userId;
                    markProfileUnlocked(id);
                    setPinFor(null);
                    onPick(id);
                }}
                onCancel={() => {
                    setPinFor(null);
                    setTimeout(() => spatial.focusId('profile-0'), 0);
                }}
            />
        );
    }

    return (
        <div className="picker">
            <div className="wizard-bg"/>
            <h1 className="picker-title">Wer schaut?</h1>
            <div className="picker-grid">
                {accounts.map((a, i) => (
                    <ProfileTile
                        key={a.userId}
                        account={a}
                        serverLabel={serverLabel(a)}
                        manage={manage}
                        focusKey={`profile-${i}`}
                        onSelect={() => handleTile(a.userId)}
                    />
                ))}
                {!manage && <AddTile focusKey="profile-add" onSelect={onAdd}/>}
            </div>
            <div className="picker-foot">
                <ManageButton manage={manage} onSelect={() => setManage((m) => !m)}/>
                {onSettings && !manage && (
                    <FootButton icon={<Settings size={18}/>} label="Einstellungen"
                                focusKey="profile-settings" onSelect={onSettings}/>
                )}
            </div>
            {confirmDel && (
                <ConfirmDialog
                    title="Profil entfernen?"
                    message={`„${confirmDel.name}" wird von diesem Gerät entfernt.`}
                    confirmLabel="Entfernen"
                    danger
                    onConfirm={() => doRemove(confirmDel.userId)}
                    onCancel={() => {
                        setConfirmDel(null);
                        setTimeout(() => spatial.focusId('profile-0'), 0);
                    }}
                />
            )}
        </div>
    );
}

const FootButton = ({icon, label, onSelect, focusKey}) => {
    const {handlers} = useFocusable({onSelect, focusKey});
    return (
        <div className="picker-manage" {...handlers}>
            {icon}
            <span>{label}</span>
        </div>
    );
}

const ManageButton = ({manage, onSelect}) => {
    return (
        <FootButton
            focusKey="profile-manage"
            icon={manage ? <Check size={18}/> : <Pencil size={18}/>}
            label={manage ? 'Fertig' : 'Profile verwalten'}
            onSelect={onSelect}
        />
    );
}
