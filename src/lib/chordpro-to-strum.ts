/**
 * Convert ChordSheetJS-like parsed lines into Strum Machine "8 slots per lyric line"
 * (4/4 bluegrass: 4 lines per verse/chorus, each line => 8 eighth-note slots).
 */

export type ChordLyricsPair = {
  type: 'chordLyricsPair'
  chords: string
  lyrics: string
  annotation?: string
  chord?: unknown
}

export type ParsedLine = {
  type: 'line'
  items: ChordLyricsPair[]
}

export type SlotLine = {
  slots: string[]
  chords: string[]
  lyricText: string
}

export type ConvertResult = {
  lines: SlotLine[]
  flat: string[]
}

type ChordEvent = { chord: string; pos: number }

function repeat(ch: string, n: number): string[] {
  return Array.from({ length: n }, () => ch)
}

function isBlankChord(s: string | null | undefined): boolean {
  return !s || !s.trim()
}

function normalizeChord(s: string): string {
  return s.trim()
}

function extractChordsWithPositions(line: ParsedLine): {
  lyricText: string
  chords: Array<{ chord: string; pos: number }>
} {
  let lyricSoFar = ''
  const chords: Array<{ chord: string; pos: number }> = []

  for (const it of line.items) {
    const chordText = it.chords
    if (!isBlankChord(chordText)) {
      chords.push({ chord: normalizeChord(chordText), pos: lyricSoFar.length })
    }
    lyricSoFar += it.lyrics ?? ''
  }

  return { lyricText: lyricSoFar, chords }
}

/**
 * If the line begins with lyrics and the first chord appears "late",
 * treat the start as carried-over prevChord (implied leading chord).
 * Threshold 0.60: e.g. "Take me far on [D]..." carries prevChord; "By and [C]by..." stays on C.
 */
function maybePrependPrevChord(
  events: ChordEvent[],
  lyricLen: number,
  prevChord: string | null,
  leadingCarryThreshold = 0.6
): ChordEvent[] {
  if (!prevChord) return events
  if (events.length === 0) return events
  const firstPos = events[0].pos
  if (firstPos <= 0) return events
  const ratio = firstPos / Math.max(1, lyricLen)
  if (ratio >= leadingCarryThreshold) {
    return [{ chord: prevChord, pos: 0 }, ...events]
  }
  return events
}

/** Chord events with item index for split decisions. */
function extractChordEvents(line: ParsedLine): {
  lyricText: string
  events: Array<{ chord: string; pos: number; itemIndex: number }>
} {
  let lyricSoFar = ''
  const events: Array<{ chord: string; pos: number; itemIndex: number }> = []

  for (let i = 0; i < line.items.length; i++) {
    const it = line.items[i]
    if (!isBlankChord(it.chords)) {
      events.push({ chord: normalizeChord(it.chords), pos: lyricSoFar.length, itemIndex: i })
    }
    lyricSoFar += it.lyrics ?? ''
  }

  return { lyricText: lyricSoFar, events }
}

/**
 * Find a chord boundary near the middle to split this line into two musical lines.
 * Prefer (1 chord) + (2 chords). Only consider splitting when there are >= 3 chords.
 */
function findSplitIndex(line: ParsedLine): number | null {
  const { lyricText, events } = extractChordEvents(line)
  const n = events.length
  if (n < 3) return null

  const mid = lyricText.length / 2
  let best: { k: number; score: number } | null = null

  for (let k = 0; k < n - 1; k++) {
    const splitPos = events[k + 1].pos
    const distToMid = Math.abs(splitPos - mid)
    const leftCount = k + 1
    const rightCount = n - (k + 1)

    let score = distToMid
    if (leftCount === 1 && rightCount === 2) score -= 1000
    if (leftCount === 1) score -= 200
    if (rightCount === 1) score -= 50
    if (rightCount > 3) score += 300
    if (splitPos < lyricText.length * 0.25 || splitPos > lyricText.length * 0.75) score += 200

    if (!best || score < best.score) best = { k, score }
  }

  if (!best) return null

  const splitPos = events[best.k + 1].pos
  const ratio = splitPos / Math.max(1, lyricText.length)
  const leftCount = best.k + 1
  const rightCount = n - (best.k + 1)
  const isPreferredPattern = leftCount === 1 && rightCount === 2
  if (!isPreferredPattern && (ratio < 0.25 || ratio > 0.75)) return null

  return events[best.k + 1].itemIndex
}

/** Split one line into two at a chord boundary when >= 3 chords and a good split exists. */
export function splitLineIfNeeded(line: ParsedLine): ParsedLine[] {
  const splitItemIndex = findSplitIndex(line)
  if (splitItemIndex == null) return [line]

  const leftItems = line.items.slice(0, splitItemIndex)
  const rightItems = line.items.slice(splitItemIndex)
  return [
    { type: 'line', items: leftItems },
    { type: 'line', items: rightItems },
  ]
}

/**
 * When there are only two lines in a verse/chorus, split each (if possible) so we get four lines
 * for Strum Machine's 4-line expectation.
 */
export function expandToFourLines(lines: ParsedLine[]): ParsedLine[] {
  if (lines.length !== 2) return lines
  return lines.flatMap(splitLineIfNeeded)
}

function lineTo8Slots(
  line: ParsedLine,
  prevChord: string | null
): { slots: string[]; nextPrevChord: string | null; chords: string[]; lyricText: string } {
  const { lyricText, chords } = extractChordsWithPositions(line)
  const events = maybePrependPrevChord(chords, lyricText.length, prevChord)
  const chordSyms = events.map((e) => e.chord)

  if (chordSyms.length === 0) {
    if (!prevChord) {
      return { slots: Array(8).fill(''), nextPrevChord: prevChord, chords: [], lyricText }
    }
    return { slots: repeat(prevChord, 8), nextPrevChord: prevChord, chords: [], lyricText }
  }

  if (chordSyms.length >= 3) {
    const [a, b, c] = chordSyms
    const slots = [...repeat(a, 2), ...repeat(b, 2), ...repeat(c, 4)]
    return { slots, nextPrevChord: c, chords: chordSyms, lyricText }
  }

  if (chordSyms.length === 2) {
    const [a, b] = chordSyms
    const slots = [...repeat(a, 4), ...repeat(b, 4)]
    return { slots, nextPrevChord: b, chords: chordSyms, lyricText }
  }

  const a = chordSyms[0]
  return { slots: repeat(a, 8), nextPrevChord: a, chords: chordSyms, lyricText }
}

export function convertChordSheetLinesToStrumSlots(lines: ParsedLine[]): ConvertResult {
  const outLines: SlotLine[] = []
  let prev: string | null = null

  for (const ln of lines) {
    if (ln.type !== 'line') continue
    const { slots, nextPrevChord, chords, lyricText } = lineTo8Slots(ln, prev)
    outLines.push({ slots, chords, lyricText })
    prev = nextPrevChord
  }

  return { lines: outLines, flat: outLines.flatMap((l) => l.slots) }
}

/** Serialized ChordSheetJS song body: array of line objects (some with tag items). */
type SerializedBodyLine = {
  type: string
  items?: Array<{ type: string; name?: string; value?: string; [key: string]: unknown }>
}

function isTagLine(line: SerializedBodyLine, tagName: string): boolean {
  if (line.type !== 'line' || !Array.isArray(line.items) || line.items.length !== 1) return false
  const item = line.items[0]
  return item?.type === 'tag' && item?.name === tagName
}

function isLyricLine(line: SerializedBodyLine): line is { type: 'line'; items: ChordLyricsPair[] } {
  if (line.type !== 'line' || !Array.isArray(line.items)) return false
  return line.items.length > 0 && line.items.every((it) => it?.type === 'chordLyricsPair')
}

/**
 * Extract chorus lines from ChordSheetJS serialized song (between start_of_chorus and end_of_chorus).
 * Serializer returns { type, lines } (not body). Returns only the lyric lines (no tag lines).
 */
export function extractChorusLines(serializedSong: { lines?: SerializedBodyLine[]; body?: SerializedBodyLine[] }): {
  chorusLines: ParsedLine[]
  chorusOnly: SerializedBodyLine[]
} {
  const body = serializedSong?.lines ?? serializedSong?.body ?? []
  const chorusOnly: SerializedBodyLine[] = []
  const chorusLines: ParsedLine[] = []
  let inChorus = false

  for (const line of body) {
    if (isTagLine(line, 'start_of_chorus')) {
      inChorus = true
      continue
    }
    if (isTagLine(line, 'end_of_chorus')) {
      inChorus = false
      continue
    }
    if (!inChorus) continue
    if (isLyricLine(line)) {
      chorusOnly.push(line)
      chorusLines.push(line)
    }
  }

  return { chorusLines, chorusOnly }
}

/**
 * Extract first verse lines (between first start_of_verse and matching end_of_verse).
 * Returns only the lyric lines (no tag lines).
 */
export function extractFirstVerseLines(serializedSong: { lines?: SerializedBodyLine[]; body?: SerializedBodyLine[] }): {
  verseLines: ParsedLine[]
  verseOnly: SerializedBodyLine[]
} {
  const body = serializedSong?.lines ?? serializedSong?.body ?? []
  const verseOnly: SerializedBodyLine[] = []
  const verseLines: ParsedLine[] = []
  let inVerse = false

  for (const line of body) {
    if (isTagLine(line, 'start_of_verse')) {
      inVerse = true
      continue
    }
    if (isTagLine(line, 'end_of_verse')) {
      inVerse = false
      continue
    }
    if (!inVerse) continue
    if (isLyricLine(line)) {
      verseOnly.push(line)
      verseLines.push(line)
    }
  }

  return { verseLines, verseOnly }
}

/** One section (verse or chorus) with its lyric lines and file order. */
export type ExtractedSection = {
  kind: 'verse' | 'chorus'
  lines: ParsedLine[]
  serialized: SerializedBodyLine[]
  order: number
}

/**
 * Extract all verse and chorus sections in file order. Each section is the lyric lines
 * between start_of_verse/end_of_verse or start_of_chorus/end_of_chorus.
 */
export function extractAllSections(serializedSong: { lines?: SerializedBodyLine[]; body?: SerializedBodyLine[] }): ExtractedSection[] {
  const body = serializedSong?.lines ?? serializedSong?.body ?? []
  const sections: ExtractedSection[] = []
  let order = 0
  let currentKind: 'verse' | 'chorus' | null = null
  let currentLines: ParsedLine[] = []
  let currentSerialized: SerializedBodyLine[] = []

  function flush() {
    if (currentKind !== null) {
      sections.push({ kind: currentKind, lines: currentLines, serialized: currentSerialized, order: order++ })
      currentKind = null
      currentLines = []
      currentSerialized = []
    }
  }

  for (const line of body) {
    if (isTagLine(line, 'start_of_verse')) {
      flush()
      currentKind = 'verse'
      continue
    }
    if (isTagLine(line, 'end_of_verse')) {
      if (currentKind === 'verse') flush()
      continue
    }
    if (isTagLine(line, 'start_of_chorus')) {
      flush()
      currentKind = 'chorus'
      continue
    }
    if (isTagLine(line, 'end_of_chorus')) {
      if (currentKind === 'chorus') flush()
      continue
    }
    if (currentKind !== null && isLyricLine(line)) {
      currentLines.push(line)
      currentSerialized.push(line)
    }
  }
  flush()

  return sections
}

/**
 * First verse with notes and first chorus with notes, in file order.
 * At least one must have notes; returns empty array if neither does.
 * Use this when you have a flat serialized song (lines with start_of_verse/end_of_verse tags).
 */
export function getFirstVerseAndChorusInOrder(serializedSong: { lines?: SerializedBodyLine[]; body?: SerializedBodyLine[] }): ExtractedSection[] {
  const sections = extractAllSections(serializedSong)
  return pickFirstVerseAndChorusInOrder(sections)
}

/** Section block as from ChordPro: kind + array of (serialized) lines. */
export type SectionBlock = {
  kind: 'verse' | 'chorus'
  lines: SerializedBodyLine[]
}

/**
 * Accept sections that already have "kind" and "lines" (e.g. from song.bodyParagraphs).
 * Filters each section's lines to lyric lines only, then returns first verse with notes
 * and first chorus with notes in file order.
 */
export function getFirstVerseAndChorusInOrderFromSections(sectionBlocks: SectionBlock[]): ExtractedSection[] {
  const sections: ExtractedSection[] = sectionBlocks.map((block, order) => {
    const lyricLines = block.lines.filter((line): line is SerializedBodyLine & { items: ChordLyricsPair[] } => isLyricLine(line))
    return {
      kind: block.kind,
      lines: lyricLines as ParsedLine[],
      serialized: lyricLines,
      order,
    }
  })
  return pickFirstVerseAndChorusInOrder(sections)
}

function pickFirstVerseAndChorusInOrder(sections: ExtractedSection[]): ExtractedSection[] {
  const firstVerse = sections.find((s) => s.kind === 'verse' && s.lines.length > 0)
  const firstChorus = sections.find((s) => s.kind === 'chorus' && s.lines.length > 0)
  const chosen = [firstVerse, firstChorus].filter((s): s is ExtractedSection => s != null)
  if (chosen.length === 0) return []
  return chosen.sort((a, b) => a.order - b.order)
}
