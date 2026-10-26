import { Archive, ArchiveRestore, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Dropdown } from '@/components/ui';
import type { CourseDTO } from '@/lib/api';
import styles from './CourseActionsMenu.module.css';

interface CourseActionsMenuProps {
  course: CourseDTO;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

export function CourseActionsMenu({ course, onEdit, onToggleArchive, onDelete }: CourseActionsMenuProps) {
  return (
    <Dropdown
      trigger={(
        <>
          <MoreVertical size={18} aria-hidden="true" />
          <span className={styles.visuallyHidden}>Acciones de {course.name}</span>
        </>
      )}
      items={[
        { label: 'Editar', icon: <Pencil size={16} />, onClick: onEdit },
        course.status === 'ARCHIVED'
          ? { label: 'Desarchivar', icon: <ArchiveRestore size={16} />, onClick: onToggleArchive }
          : { label: 'Archivar', icon: <Archive size={16} />, onClick: onToggleArchive },
        { label: 'Borrar', icon: <Trash2 size={16} />, onClick: onDelete, danger: true },
      ]}
      align="right"
    />
  );
}
