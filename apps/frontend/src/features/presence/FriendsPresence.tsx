import { Users } from 'lucide-react';
import { Badge, Dropdown } from '@/components/ui';
import { usePresence } from './PresenceProvider';

/**
 * Navbar widget: a friends icon with the count of friends currently online, and
 * a dropdown listing each friend with a live online/offline dot. Reflects
 * `presence:update` events in real time (A6b).
 */
export function FriendsPresence() {
  const { friends, onlineCount, isLoading } = usePresence();

  const trigger = (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
      aria-label={`Amigos en línea: ${onlineCount}`}
    >
      <Users size={20} />
      {onlineCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -8,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-success)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 'var(--font-bold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {onlineCount}
        </span>
      )}
    </span>
  );

  const items =
    friends.length === 0
      ? [
          {
            label: isLoading ? 'Cargando…' : 'Sin amigos aún',
            disabled: true,
          },
        ]
      : // Online first, then alphabetical (list already sorted by name).
        [...friends]
          .sort((a, b) => Number(b.online) - Number(a.online))
          .map((f) => ({
            label: (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  justifyContent: 'space-between',
                  minWidth: 180,
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.name}
                </span>
                <Badge variant={f.online ? 'success' : 'neutral'} dot>
                  {f.online ? 'En línea' : 'Desconectado'}
                </Badge>
              </span>
            ),
          }));

  return <Dropdown trigger={trigger} items={items} align="right" />;
}
