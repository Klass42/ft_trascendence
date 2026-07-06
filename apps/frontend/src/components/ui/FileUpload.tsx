/**
 * FileUpload Component
 *
 * Drag-and-drop file upload with client-side validation,
 * progress tracking, previews, and backend integration.
 *
 * Usage:
 *   <FileUpload
 *     organizationId="org-id"
 *     accept="image/*"
 *     maxSizeBytes={5 * 1024 * 1024}
 *     onChange={(files) => console.log(files)}
 *   />
 */

import {
  useState,
  useRef,
  forwardRef,
  useCallback,
  type DragEvent,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import {
  Upload,
  File,
  FileImage,
  FileText,
  FileVideo,
  FileAudio,
  Archive,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import styles from './FileUpload.module.css';

// =============================================================================
// Types
// =============================================================================

export interface FileValue {
  /** Temporary or backend file ID */
  id: string;
  /** The raw File object */
  file: File;
  /** Backend download URL (after successful upload) */
  url?: string;
  /** Original filename */
  originalName: string;
  /** MIME type */
  contentType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Upload status */
  status: 'pending' | 'uploading' | 'done' | 'error';
  /** Upload progress percentage (0-100) */
  progress?: number;
  /** Error message if status is 'error' */
  error?: string;
}

export interface FileUploadProps {
  /** Accepted file types - extensions (.pdf) or MIME types (image/*) */
  accept?: string;
  /** Maximum file size in bytes (default: 10MB) */
  maxSizeBytes?: number;
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Maximum number of files (only applies when multiple is true) */
  maxFiles?: number;
  /** Disable the upload zone */
  disabled?: boolean;
  /** Controlled value (array of files) */
  value?: FileValue[];
  /** Called when files change (add, remove, upload complete) */
  onChange?: (files: FileValue[]) => void;
  /** Organization ID for backend scoping */
  organizationId: string;
  /** Optional uploader user ID */
  uploaderId?: string;
  /** Automatically upload files when selected (default: true) */
  autoUpload?: boolean;
  /** Hint text below the dropzone */
  hint?: string;
  /** External error message */
  error?: string;
  /** Additional class name */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const DEFAULT_ACCEPT = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.tgz',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.mp4', '.mov', '.webm', '.mp3', '.wav',
  '.txt', '.csv', '.json',
].join(',');

// =============================================================================
// Helpers
// =============================================================================

let tempIdCounter = 0;
function generateTempId(): string {
  tempIdCounter += 1;
  return `temp-${Date.now()}-${tempIdCounter}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const base = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const value = bytes / Math.pow(base, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function getFileTypeIcon(contentType: string): ReactNode {
  if (contentType.startsWith('image/')) return <FileImage size={20} />;
  if (contentType === 'application/pdf') return <FileText size={20} />;
  if (contentType.startsWith('video/')) return <FileVideo size={20} />;
  if (contentType.startsWith('audio/')) return <FileAudio size={20} />;
  if (
    contentType.includes('zip') ||
    contentType.includes('rar') ||
    contentType.includes('tar') ||
    contentType.includes('7z') ||
    contentType.includes('gzip') ||
    contentType.includes('compress')
  ) {
    return <Archive size={20} />;
  }
  if (
    contentType.includes('excel') ||
    contentType.includes('spreadsheet') ||
    contentType.includes('csv')
  ) {
    return <FileText size={20} />;
  }
  if (
    contentType.includes('powerpoint') ||
    contentType.includes('presentation') ||
    contentType.includes('slides')
  ) {
    return <FileText size={20} />;
  }
  if (
    contentType.includes('word') ||
    contentType.includes('document') ||
    contentType.includes('text') ||
    contentType.startsWith('text/')
  ) {
    return <FileText size={20} />;
  }
  return <File size={20} />;
}

function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

function isFileAccepted(file: File, accept: string): boolean {
  if (!accept) return true;
  const types = accept.split(',').map((t) => t.trim());
  const ext = getFileExtension(file.name);
  const mime = file.type.toLowerCase();

  return types.some((t) => {
    if (t.startsWith('.')) return ext === t;
    if (t.endsWith('/*')) return mime.startsWith(t.replace('/*', '/'));
    return mime === t;
  });
}

// =============================================================================
// Component
// =============================================================================

export const FileUpload = forwardRef<HTMLDivElement, FileUploadProps>(
  (
    {
      accept = DEFAULT_ACCEPT,
      maxSizeBytes = DEFAULT_MAX_SIZE,
      multiple = false,
      maxFiles,
      disabled = false,
      value,
      onChange,
      organizationId,
      uploaderId,
      autoUpload = true,
      hint,
      error: externalError,
      className,
    },
    ref,
  ) => {
    const [dragOver, setDragOver] = useState(false);
    const [internalFiles, setInternalFiles] = useState<FileValue[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const xhrMap = useRef<Map<string, XMLHttpRequest>>(new Map());

    const abortSet = useRef<Set<string>>(new Set());

    const isControlled = value !== undefined;
    const files = isControlled ? value : internalFiles;
    const filesRef = useRef(files);
    filesRef.current = files;

    const setFiles = useCallback(
      (next: FileValue[] | ((prev: FileValue[]) => FileValue[])) => {
        const prev = filesRef.current;
        const nextVal = typeof next === 'function' ? next(prev) : next;
        filesRef.current = nextVal;
        if (!isControlled) {
          setInternalFiles(nextVal);
        }
        if (onChange) {
          onChange(nextVal);
        }
      },
      [isControlled, onChange],
    );

    // ---------------------------------------------------------------------------
    // Validation
    // ---------------------------------------------------------------------------

    const validateFile = useCallback(
      (file: File): string | null => {
        if (!isFileAccepted(file, accept)) {
          const ext = getFileExtension(file.name);
          return `Tipo de archivo no permitido (${ext || file.type}). Formatos aceptados: ${accept}`;
        }
        if (file.size > maxSizeBytes) {
          return `El archivo excede el tamaño máximo de ${formatFileSize(maxSizeBytes)}`;
        }
        return null;
      },
      [accept, maxSizeBytes],
    );

    // ---------------------------------------------------------------------------
    // Upload
    // ---------------------------------------------------------------------------

    const startUpload = useCallback(
      async (entry: FileValue) => {
        const updateFile = (updater: Partial<FileValue>) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === entry.id ? { ...f, ...updater } : f)),
          );
        };

        updateFile({ status: 'uploading', progress: 0 });

        try {
          const result = await apiClient.uploadWithProgress<{
            id: string;
            originalName: string;
            contentType: string;
            sizeBytes: number;
          }>(
            '/files',
            entry.file,
            {
              fields: {
                organizationId,
                ...(uploaderId ? { uploaderId } : {}),
              },
              onProgress: (percent: number) => {
                if (abortSet.current.has(entry.id)) return;
                updateFile({ progress: percent });
              },
            },
          );

          if (abortSet.current.has(entry.id)) return;

          updateFile({
            id: result.id,
            status: 'done',
            progress: 100,
          });
        } catch (err: unknown) {
          if (abortSet.current.has(entry.id)) return;
          const message =
            err instanceof Error ? err.message : 'Error al subir el archivo';
          updateFile({ status: 'error', error: message });
        } finally {
          xhrMap.current.delete(entry.id);
        }
      },
      [organizationId, uploaderId, setFiles],
    );

    // ---------------------------------------------------------------------------
    // File handling
    // ---------------------------------------------------------------------------

    const handleFiles = useCallback(
      (newFiles: FileList | File[]) => {
        if (disabled) return;

        const fileArray = Array.from(newFiles);
        const entries: FileValue[] = [];

        for (const file of fileArray) {
          const validationError = validateFile(file);
          if (validationError) {
            entries.push({
              id: generateTempId(),
              file,
              originalName: file.name,
              contentType: file.type,
              sizeBytes: file.size,
              status: 'error',
              error: validationError,
            });
            continue;
          }

          entries.push({
            id: generateTempId(),
            file,
            originalName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            status: 'pending',
          });
        }

        // Enforce maxFiles
        let updated = [...filesRef.current, ...entries];
        if (maxFiles && maxFiles > 0) {
          updated = updated.slice(0, maxFiles);
        }

        setFiles(updated);

        // Auto-upload entries that passed validation
        if (autoUpload) {
          for (const entry of entries) {
            if (entry.status === 'pending') {
              startUpload(entry);
            }
          }
        }
      },
      [disabled, validateFile, maxFiles, autoUpload, setFiles, startUpload],
    );

    // ---------------------------------------------------------------------------
    // Drag & Drop handlers
    // ---------------------------------------------------------------------------

    const handleDragOver = useCallback((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
    }, []);

    const handleDrop = useCallback(
      (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (disabled) return;
        if (e.dataTransfer.files) {
          handleFiles(e.dataTransfer.files);
        }
      },
      [disabled, handleFiles],
    );

    // ---------------------------------------------------------------------------
    // Click to browse
    // ---------------------------------------------------------------------------

    const handleClick = useCallback(() => {
      if (disabled) return;
      inputRef.current?.click();
    }, [disabled]);

    const handleInputChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
          handleFiles(e.target.files);
        }
        e.target.value = '';
      },
      [handleFiles],
    );

    // ---------------------------------------------------------------------------
    // Remove file
    // ---------------------------------------------------------------------------

    const handleRemove = useCallback(
      (fileId: string) => {
        // Abort in-progress upload
        abortSet.current.add(fileId);
        const xhr = xhrMap.current.get(fileId);
        if (xhr) {
          xhr.abort();
          xhrMap.current.delete(fileId);
        }

        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      },
      [setFiles],
    );

    // ---------------------------------------------------------------------------
    // Status adornment
    // ---------------------------------------------------------------------------

    const renderStatus = (file: FileValue) => {
      switch (file.status) {
        case 'uploading':
          return (
            <span className={`${styles.fileStatus} ${styles.statusUploading}`}>
              <span className={styles.statusIcon}>
                <AlertCircle size={16} />
              </span>
              {file.progress != null ? `${file.progress}%` : 'Subiendo...'}
            </span>
          );
        case 'done':
          return (
            <span className={`${styles.fileStatus} ${styles.statusDone}`}>
              <span className={styles.statusIcon}>
                <CheckCircle size={16} />
              </span>
              Subido
            </span>
          );
        case 'error':
          return (
            <span className={`${styles.fileStatus} ${styles.statusError}`}>
              <span className={styles.statusIcon}>
                <AlertCircle size={16} />
              </span>
              Error
            </span>
          );
        default:
          return null;
      }
    };

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    const dropzoneClassNames = [
      styles.dropzone,
      dragOver && styles.dropzoneDragOver,
      disabled && styles.disabled,
      files.length > 0 && styles.hasFiles,
    ]
      .filter(Boolean)
      .join(' ');

    const wrapperClassNames = [styles.wrapper, className].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={wrapperClassNames}>
        {/* ====== Drop Zone ====== */}
        <div
          className={dropzoneClassNames}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className={styles.hiddenInput}
            onChange={handleInputChange}
            disabled={disabled}
            tabIndex={-1}
          />

          <span className={styles.uploadIcon}>
            <Upload size={24} />
          </span>

          <div>
            {files.length === 0 && (
              <div className={styles.dropzoneTitle}>
                Arrastra archivos o <span className={styles.browseLink}>examina</span>
              </div>
            )}
            <div className={styles.dropzoneText}>
              {files.length === 0
                ? `${accept.split(',').slice(0, 4).join(', ')}${accept.split(',').length > 4 ? '...' : ''} — hasta ${formatFileSize(maxSizeBytes)} por archivo`
                : 'Añadir más archivos'}
            </div>
          </div>
        </div>

        {/* ====== External Error ====== */}
        {externalError && (
          <p className={styles.error} role="alert">
            {externalError}
          </p>
        )}

        {/* ====== File List ====== */}
        {files.length > 0 && (
          <div className={styles.fileList}>
            {files.map((fileEntry) => {
              const itemClassNames = [
                styles.fileItem,
                fileEntry.status === 'error' && styles.fileItemError,
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div key={fileEntry.id} className={itemClassNames}>
                  {/* Icon / Preview */}
                  <span className={styles.fileIcon}>
                    {fileEntry.contentType.startsWith('image/') &&
                    fileEntry.status !== 'error' ? (
                      <img
                        src={
                          fileEntry.url ||
                          URL.createObjectURL(fileEntry.file)
                        }
                        alt={fileEntry.originalName}
                        className={styles.previewImage}
                      />
                    ) : (
                      getFileTypeIcon(fileEntry.contentType)
                    )}
                  </span>

                  {/* Info */}
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>
                      {fileEntry.originalName}
                    </span>
                    <div className={styles.fileMeta}>
                      <span>{formatFileSize(fileEntry.sizeBytes)}</span>
                      {fileEntry.status !== 'pending' && (
                        <>
                          <span className={styles.fileMetaDot} />
                          {renderStatus(fileEntry)}
                        </>
                      )}
                    </div>
                    {/* Progress bar */}
                    {fileEntry.status === 'uploading' && (
                      <div className={styles.progressTrack}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${fileEntry.progress ?? 0}%`,
                          }}
                        />
                      </div>
                    )}
                    {/* Error detail */}
                    {fileEntry.status === 'error' && fileEntry.error && (
                      <span className={styles.fileMeta}>
                        <span style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)' }}>
                          {fileEntry.error}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(fileEntry.id);
                    }}
                    aria-label={`Eliminar ${fileEntry.originalName}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ====== Hint ====== */}
        {hint && !externalError && (
          <p className={styles.hint}>{hint}</p>
        )}
      </div>
    );
  },
);

FileUpload.displayName = 'FileUpload';
