import { useRef, useEffect, useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as Popover from '@radix-ui/react-popover'
import { colors } from '../../constants/colors'
import {
  CaretRight,
  Eye,
  CloudArrowUp,
  GithubLogo,
  MagnifyingGlass,
  Users,
  UserCircle,
  SignOut,
  Key,
  TextB,
  TextItalic,
  TextStrikethrough,
  Code,
  Image,
  CaretDown,
  Function as FunctionIcon,
  ShareNetwork
} from '@phosphor-icons/react'
import StyleDropdown from './StyleDropdown'
import Loading from '../ui/Loading'
import styles from './EditorNavbar.module.css'

export default function EditorNavbar({
  title,
  onTitleChange,
  unsaved,
  subjectLabel,
  folderLabel,
  onNavigateRoot,
  onNavigateSubject,
  onPreview,
  onSave,
  onBackupToGithub,
  saving,
  onToggleUsers,
  onToggleCleanup,
  cleanupOpen,
  isOwner,
  canManageUsers,
  roleLabel,
  username,
  onSignOut,
  onChangePassword,
  editorRef,
  onFormatAction,
  onInsertImage,
  onInsertFormula,
  onInsertSocialLink,
  currentStyle,
  onStyleChange,
}) {
  const [titleWidth, setTitleWidth] = useState('auto')
  const mirrorRef = useRef(null)

  // Auto-size title input
  useEffect(() => {
    if (mirrorRef.current) {
      setTitleWidth(`${mirrorRef.current.offsetWidth + 20}px`)
    }
  }, [title])

  return (
    <Tooltip.Provider delayDuration={300}>
      {/* Row 1: Document Controls */}
      <div className={styles.row1}>
        <div className={styles.leftGroup}>
          {/* Where the directory drawer toggle used to be — now a breadcrumb
              back to the browser, since navigation happens one level up
              (T-045 phase A). */}
          <div className={styles.breadcrumb}>
            <button className={styles.breadcrumbLink} onClick={onNavigateRoot}>Subjects</button>
            {subjectLabel && (
              <>
                <CaretRight size={12} className={styles.breadcrumbCaret} />
                <button className={styles.breadcrumbLink} onClick={onNavigateSubject}>{subjectLabel}</button>
              </>
            )}
            {folderLabel && (
              <>
                <CaretRight size={12} className={styles.breadcrumbCaret} />
                <span className={styles.breadcrumbCurrent}>{folderLabel}</span>
              </>
            )}
          </div>

          <div className={styles.titleGroup}>
            <span ref={mirrorRef} className={styles.titleMirror}>
              {title || 'Untitled'}
            </span>
            <input
              type="text"
              className={styles.titleInput}
              placeholder="Untitled"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              style={{ width: titleWidth }}
            />
            {unsaved && <div className={styles.unsavedDot} />}
          </div>
        </div>

        <div className={styles.rightGroup}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className={styles.iconButton} onClick={onPreview}>
                <Eye size={18} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                Preview
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          {isOwner && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  className={styles.iconButton}
                  onClick={onToggleCleanup}
                  style={{ color: cleanupOpen ? colors.accent : undefined }}
                >
                  <MagnifyingGlass size={18} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                  Image cleanup
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                className={styles.iconButton}
                onClick={onSave}
                disabled={saving}
              >
                {saving ? <Loading size={18} color="var(--accent)" /> : <CloudArrowUp size={18} />}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                Save &amp; publish (instant)
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          {onBackupToGithub && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button className={styles.iconButton} onClick={onBackupToGithub}>
                  <GithubLogo size={18} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                  Back up .md to GitHub (optional)
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}

          {canManageUsers && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button className={styles.iconButton} onClick={onToggleUsers}>
                  <Users size={18} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                  Manage users
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}

          <Popover.Root>
            <Popover.Trigger asChild>
              <button className={styles.iconButton}>
                <UserCircle size={18} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className={styles.popoverContent} sideOffset={5}>
                <div className={styles.userInfo}>
                  <span className={styles.username}>{username}</span>
                  <span className={styles.role}>{roleLabel}</span>
                </div>
                <div className={styles.divider} />
                <button className={styles.menuItem} onClick={onChangePassword}>
                  <Key size={16} />
                  <span>Change password</span>
                </button>
                <button className={styles.menuItem} onClick={onSignOut}>
                  <SignOut size={16} />
                  <span>Sign out</span>
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>

      {/* Row 2: Formatting Toolbar */}
      <div className={styles.row2}>
        <div className={styles.formattingGroup}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                className={styles.formatButton}
                onClick={() => onFormatAction('bold')}
              >
                <TextB size={18} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                Bold (⌘B)
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                className={styles.formatButton}
                onClick={() => onFormatAction('italic')}
              >
                <TextItalic size={18} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                Italic (⌘I)
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                className={styles.formatButton}
                onClick={() => onFormatAction('strike')}
              >
                <TextStrikethrough size={18} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                Strikethrough
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                className={styles.formatButton}
                onClick={() => onFormatAction('code')}
              >
                <Code size={18} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                Code block
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                className={styles.formatButton}
                onClick={onInsertFormula}
              >
                <FunctionIcon size={18} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                Insert formula (LaTeX)
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                className={styles.formatButton}
                onClick={onInsertSocialLink}
              >
                <ShareNetwork size={18} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                Insert social link
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className={styles.formatButton} onClick={onInsertImage}>
                <Image size={18} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={5}>
                Insert image
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <div className={styles.verticalDivider} />

          <StyleDropdown
            currentStyle={currentStyle}
            onStyleChange={onStyleChange}
          />
        </div>
      </div>
    </Tooltip.Provider>
  )
}
