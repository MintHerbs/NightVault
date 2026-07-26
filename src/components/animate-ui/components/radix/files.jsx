import * as React from 'react';
import { FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react';

import {
  File as FilePrimitive,
  FileHighlight as FileHighlightPrimitive,
  FileIcon as FileIconPrimitive,
  FileLabel as FileLabelPrimitive,
  Files as FilesPrimitive,
  FilesHighlight as FilesHighlightPrimitive,
  Folder as FolderPrimitive,
  FolderContent as FolderContentPrimitive,
  FolderHeader as FolderHeaderPrimitive,
  FolderHighlight as FolderHighlightPrimitive,
  FolderIcon as FolderIconPrimitive,
  FolderItem as FolderItemPrimitive,
  FolderTrigger as FolderTriggerPrimitive,
  useFolder,
} from '@/components/animate-ui/primitives/radix/files';

import styles from './files.module.css';

const cn = (...classes) => classes.filter(Boolean).join(' ');

function getGitColor(gitStatus) {
  if (gitStatus === 'untracked') return '#22c55e';
  if (gitStatus === 'modified') return 'var(--color-accent-alt)';
  if (gitStatus === 'deleted') return '#ef4444';
  return undefined;
}

function Files({ className, children, ...props }) {
  return (
    <FilesPrimitive className={cn(styles.filesRoot, className)} {...props}>
      <FilesHighlightPrimitive className={styles.highlight}>
        {children}
      </FilesHighlightPrimitive>
    </FilesPrimitive>
  );
}

function SubFiles(props) {
  return <FilesPrimitive {...props} />;
}

function FolderItem(props) {
  return <FolderItemPrimitive {...props} />;
}

function FolderTrigger({
  icon,
  variant = 'folder',
  children,
  className,
  gitStatus,
  ...props
}) {
  const gitColor = getGitColor(gitStatus);
  const { isOpen } = useFolder();

  return (
    <FolderHeaderPrimitive>
      <FolderTriggerPrimitive className={styles.trigger}>
        <FolderHighlightPrimitive>
          <FolderPrimitive
            data-slot="folder-row"
            data-variant={variant}
            data-open={isOpen ? 'true' : 'false'}
            className={styles.row}
          >
            <div
              className={styles.leftGroup}
              style={gitColor ? { color: gitColor } : undefined}
              data-git-status={gitStatus}
            >
              {variant !== 'parent' && (
                icon ? (
                  <span className={styles.customIcon}>
                    {icon}
                  </span>
                ) : (
                  <FolderIconPrimitive
                    closeIcon={<FolderIcon size={18} />}
                    openIcon={<FolderOpenIcon size={18} />}
                  />
                )
              )}
              <FileLabelPrimitive className={cn(styles.label, className)} {...props}>
                {children}
              </FileLabelPrimitive>
            </div>

            {gitStatus && (
              <span className={styles.dot} style={{ backgroundColor: gitColor }} />
            )}
          </FolderPrimitive>
        </FolderHighlightPrimitive>
      </FolderTriggerPrimitive>
    </FolderHeaderPrimitive>
  );
}

function FolderContent(props) {
  return (
    <div className={styles.contentWrap}>
      <FolderContentPrimitive {...props} />
    </div>
  );
}

function FileItem({
  icon: Icon = FileIcon,
  variant,
  className,
  children,
  gitStatus,
  ...props
}) {
  const gitColor = getGitColor(gitStatus);

  return (
    <FileHighlightPrimitive>
      <FilePrimitive
        data-slot="file-item"
        data-git-status={gitStatus}
        data-variant={variant}
        className={cn(styles.row, className)}
        style={gitColor ? { color: gitColor } : undefined}
        {...props}
      >
        <div className={styles.leftGroup}>
          <FileIconPrimitive>
            <Icon size={18} />
          </FileIconPrimitive>
          <FileLabelPrimitive className={styles.label}>
            {children}
          </FileLabelPrimitive>
        </div>

        {gitStatus && (
          <span className={styles.statusLetter}>
            {gitStatus === 'untracked' && 'U'}
            {gitStatus === 'modified' && 'M'}
            {gitStatus === 'deleted' && 'D'}
          </span>
        )}
      </FilePrimitive>
    </FileHighlightPrimitive>
  );
}

export { Files, FolderItem, FolderTrigger, FolderContent, SubFiles, FileItem };
