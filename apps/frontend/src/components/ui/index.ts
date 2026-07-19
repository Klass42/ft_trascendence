/**
 * UI Components
 *
 * Barrel export for all UI components.
 *
 *   Usage:
 *   import { Button, Modal, Table, useToast } from '@/components/ui';
 */

// Design tokens (import this in your root CSS)
import './tokens.css';

// Primitives
export { Button, type ButtonProps } from './Button';
export { Input, type InputProps } from './Input';
export { Card, type CardProps } from './Card';
export { Spinner, type SpinnerProps } from './Spinner';
export { FileUpload, type FileUploadProps, type FileValue } from './FileUpload';
export { Badge, type BadgeProps } from './Badge';

// Form controls
export { FormField, type FormFieldProps, type FieldControlProps } from './FormField';
export { Textarea, type TextareaProps } from './Textarea';
export { Select, type SelectProps, type SelectOption } from './Select';
export { DatePicker, type DatePickerProps } from './DatePicker';

// Overlays
export { Modal, type ModalProps } from './Modal';
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
export { Dropdown, type DropdownProps, type DropdownItem } from './Dropdown';
export { ToastProvider, useToast, type ToastOptions, type ToastVariant } from './Toast';

// Display
export { Table, type TableProps, type Column } from './Table';
export { Tabs, type TabsProps, type TabItem } from './Tabs';
export { EmptyState, type EmptyStateProps } from './EmptyState';
