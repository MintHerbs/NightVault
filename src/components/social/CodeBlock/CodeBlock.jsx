import { memo, useMemo } from 'react'
import { detectCodeLanguage, getLanguageLabel, normalizeLanguage, tokenizeCodeLine } from '../../../lib/social/codeHighlighter'
import styles from './CodeBlock.module.css'

function CodeBlock({ code, language }) {
  // Detection runs a dozen regexes over the whole file and tokenising runs one
  // per line, so doing this in the render body meant re-highlighting every code
  // block in the feed on every unrelated state change.
  const { label, lines } = useMemo(() => {
    const requested = normalizeLanguage(language)
    const resolved = requested === 'auto' ? detectCodeLanguage(code) : requested
    return {
      label: getLanguageLabel(resolved),
      lines: String(code || '')
        .split('\n')
        .map((line) => tokenizeCodeLine(line, resolved)),
    }
  }, [code, language])

  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.dots}>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
          </div>
          <span className={styles.language}>{label}</span>
        </div>
      </div>

      <pre className={styles.pre}>
        <code className={styles.code}>
          {lines.map((tokens, lineIndex) => (
            <span key={lineIndex} className={styles.line}>
              <span className={styles.lineNumber} aria-hidden="true">
                {lineIndex + 1}
              </span>
              <span className={styles.source}>
                {tokens.map((token, tokenIndex) => (
                  <span key={tokenIndex} className={styles[token.type] || undefined}>
                    {token.value}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

export default memo(CodeBlock)
