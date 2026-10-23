import { Users } from 'lucide-react';
import { useNavigate, NavLink } from 'react-router-dom';
import { Badge, Dropdown } from '@/components/ui';
import { usePresence } from './PresenceProvider';
import styles from './FriendsPresence.module.css';

/**
 * Navbar widget: a friends icon with the count of friends currently online, and
 * a dropdown listing each friend with a live online/offline dot. Reflects
 * `presence:update` events in real time (A6b).
 */
export function FriendsPresence() {
  const navigate = useNavigate();
  const { friends, onlineCount, isLoading } = usePresence();

  const trigger = (
    <span
      className={styles.trigger}
      aria-hidden="true"
    >
      <Users size={20} />
      {onlineCount > 0 && (
        <span className={styles.count}>
          {onlineCount}
        </span>
      )}
    </span>
  );

  if (friends.length === 0) {
    return (
      <NavLink
        to="/friends"
        className={styles.link}
        aria-label={isLoading ? 'Cargando amigos; abrir amigos' : 'Buscar y gestionar amigos'}
        title="Amigos"
      >
        {trigger}
      </NavLink>
    );
  }

  const items = [
    ...[...friends]
      .sort((a, b) => Number(b.online) - Number(a.online))
      .map((friend) => ({
        label: (
          <span className={styles.friendItem}>
            <span className={styles.friendName}>{friend.name}</span>
            <Badge variant={friend.online ? 'success' : 'neutral'} dot>
              {friend.online ? 'En línea' : 'Desconectado'}
            </Badge>
          </span>
        ),
        onClick: () => navigate('/friends'),
      })),
    { label: 'Gestionar amigos', onClick: () => navigate('/friends') },
  ];

  return (
    <Dropdown
      trigger={<span aria-label={`Amigos en línea: ${onlineCount}`}>{trigger}</span>}
      items={items}
      align="right"
    />
  );
}
