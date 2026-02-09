/**
 * ChordPro parsing: takes file contents and returns the ChordSheetJS song.
 *
 * We have to pre-parse comment lines before the main parse: OnSong and SongbookPro
 * output ChordPro with comment headers (e.g. {c: Verse 1}, {c: Chorus}) instead of
 * proper section directives ({start_of_verse}, {soc}, etc.). If the text has no
 * section tags, we add them from those comment headers before parsing.
 */

import ChordSheetJS, { type Song } from 'chordsheetjs'

const SECTION_TAG_NAMES = [
  'start_of_verse',
  'end_of_verse',
  'start_of_chorus',
  'end_of_chorus',
  'sov',
  'eov',
  'soc',
  'eoc',
]

/** Check if raw ChordPro text contains any section directive (e.g. {sov}, {start_of_verse}). */
function hasSectionTagsInText(contents: string): boolean {
  const names = SECTION_TAG_NAMES.join('|')
  const re = new RegExp(`\\{\\s*(${names})\\s*\\}`, 'i')
  return re.test(contents)
}

/** Match a line that is only a comment directive: {c: ...}, {comment: ...}, etc. */
const COMMENT_LINE_RE = /^\s*\{\s*(c|comment|ci|comment_italic)\s*:\s*([^}]*)\}\s*$/i

/**
 * Add start_of_verse/end_of_verse and start_of_chorus/end_of_chorus from comment lines
 * like {c: Verse 1} or {c: Chorus}. Used when the ChordPro comes from OnSong/SongbookPro
 * (comment headers) rather than proper section directives.
 */
function normalizeCommentSectionsInText(contents: string): string {
  const lines = contents.split(/\r?\n/)
  const out: string[] = []
  let pendingEnd: string | null = null

  for (const line of lines) {
    const match = line.match(COMMENT_LINE_RE)
    const value = match ? match[2].trim() : ''
    const isVerse = /^verse\b/i.test(value)
    const isChorus = /^chorus\b/i.test(value)

    if (pendingEnd !== null && (isVerse || isChorus || line.trim() === '')) {
      out.push(`{${pendingEnd}}`)
      pendingEnd = null
    }

    if (isVerse) {
      out.push('{start_of_verse}')
      out.push(line)
      pendingEnd = 'end_of_verse'
    } else if (isChorus) {
      out.push('{start_of_chorus}')
      out.push(line)
      pendingEnd = 'end_of_chorus'
    } else {
      out.push(line)
    }
  }

  if (pendingEnd !== null) {
    out.push(`{${pendingEnd}}`)
  }

  return out.join('\n')
}

/**
 * Parse ChordPro file contents. If the text has no section tags, comment-style headers
 * ({c: Verse 1}, {c: Chorus}) are converted to start_of_verse/end_of_verse etc. in the text,
 * then the result is parsed once with ChordSheetJS. Returns the ChordSheetJS song object.
 */
export function parseChordPro(contents: string): Song {
  let text = contents
  if (!hasSectionTagsInText(text)) {
    text = normalizeCommentSectionsInText(text)
  }

  const parser = new ChordSheetJS.ChordProParser()
  return parser.parse(text)
}
