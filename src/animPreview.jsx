// Dev-only harness for eyeballing the new note embeds without needing the app
// shell, a session, or a database. Served by preview-anim.html.
import { createRoot } from 'react-dom/client'
import MarkdownRenderer from './components/markdown/MarkdownRenderer'
import './styles/global.css'

const SOURCE = `
# Animation and console preview

## The schema figure

::anim{id="db-dreamhome-schema"}

## Normalising CARE

::anim{id="db-normalisation-care"}

## Building the tables

::sqlrun{id="ddl-build-branch-staff"}

## Grouping and joins

::sqlrun{id="dml-grouping-and-joins"}
`

function Preview() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>
      <MarkdownRenderer content={SOURCE} />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<Preview />)
