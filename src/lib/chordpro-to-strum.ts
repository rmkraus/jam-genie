/**
 * Convert ChordSheetJS-like parsed lines into Strum Machine "8 slots per lyric line"
 * (4/4 bluegrass: 4 lines per verse/chorus, each line => 8 eighth-note slots).
 * Works with Line[] from song.bodyParagraphs (paragraph.lines).
 *
 * TODO:
 * - Support 3/4 waltz time
 * 
 * Tests
 * - ninety nine years and one dark day (hot rize) - simple 4/4 bluegrass
 * - wallflow (bob dylan) - 3/4 waltz time
 * - Wabash cannonball (johnny cash) - 4/4 late changes
 * - mama dont allow - 4/4 simple bluegrass
 */

import { ChordLyricsPair, Line } from 'chordsheetjs'
import type { Paragraph, Song } from 'chordsheetjs'

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
function extractChordEvents(line: Line): {
  lyricText: string
  events: Array<{ chord: string; pos: number; itemIndex: number }>
} {
  let lyricSoFar = ''
  const events: Array<{ chord: string; pos: number; itemIndex: number }> = []

  for (let i = 0; i < line.items.length; i++) {
    const it = line.items[i]
    if (!(it instanceof ChordLyricsPair)) continue
    if (!isBlankChord(it.chords)) {
      events.push({ chord: normalizeChord(it.chords), pos: lyricSoFar.length, itemIndex: i })
    }
    lyricSoFar += it.lyrics ?? ''
  }

  return { lyricText: lyricSoFar, events }
}

/**
 * Find a chord boundary near the middle of the line to split into two musical lines.
 * Only consider splitting when there are >= 3 chords.
 */
function findSplitIndex(line: Line): number | null {
  const { lyricText, events } = extractChordEvents(line)
  const n = events.length
  if (n < 3) return null

  const mid = lyricText.length / 2
  let bestK = 0
  let bestDist = Math.abs(events[1].pos - mid)

  for (let k = 1; k < n - 1; k++) {
    const dist = Math.abs(events[k + 1].pos - mid)
    if (dist < bestDist) {
      bestDist = dist
      bestK = k
    }
  }

  return events[bestK + 1].itemIndex
}

/** Split one line into two at a chord boundary when >= 3 chords and a good split exists. */
export function splitLineIfNeeded(line: Line): Line[] {
  const splitItemIndex = findSplitIndex(line)
  if (splitItemIndex == null) return [line]

  const leftItems = line.items.slice(0, splitItemIndex)
  const rightItems = line.items.slice(splitItemIndex)
  return [
    new Line({ type: line.type, items: leftItems }),
    new Line({ type: line.type, items: rightItems }),
  ]
}

/**
 * When there are only two lines in a verse/chorus, split each (if possible) so we get four lines
 * for Strum Machine's 4-line expectation.
 */
export function expandToFourLines(lines: Line[]): Line[] {
  if (lines.length !== 2) return lines
  return lines.flatMap(splitLineIfNeeded)
}

const PICKUP_THRESHOLD = 0.2

function lineTo8Slots(
  line: Line,
  prevChord: string | null,
  hasLongPickup: boolean
): { slots: string[]; nextPrevChord: string | null; chords: string[]; lyricText: string } {
  const { lyricText, events } = extractChordEvents(line)
  const chords = events.map((e) => ({ chord: e.chord, pos: e.pos }))
  const withPrev = maybePrependPrevChord(chords, lyricText.length, prevChord)
  const chordSyms = withPrev.map((e) => e.chord)

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
    const totalLen = Math.max(1, lyricText.length)
    // Two chords: decide whether the second chord comes in at 50% or at 25%/50%/75%.
    // hasLongPickup is set from the first line of the paragraph (significant lyrics before the first chord).
    // Long pickup → second chord at 50% (4+4). Otherwise weight by where the second chord starts and snap to 25/50/75.
    if (hasLongPickup) {
      const slots = [...repeat(a, 4), ...repeat(b, 4)]
      return { slots, nextPrevChord: b, chords: chordSyms, lyricText }
    }
    const weightA = withPrev[1].pos / totalLen
    const quarters = [0.25, 0.5, 0.75]
    const nearest = quarters.reduce((best, q) =>
      Math.abs(q - weightA) < Math.abs(best - weightA) ? q : best
    )
    const slotsA = Math.round(nearest * 8)
    const slotsB = 8 - slotsA
    const slots = [...repeat(a, slotsA), ...repeat(b, slotsB)]
    return { slots, nextPrevChord: b, chords: chordSyms, lyricText }
  }

  const a = chordSyms[0]
  return { slots: repeat(a, 8), nextPrevChord: a, chords: chordSyms, lyricText }
}

export function convertChordSheetLinesToStrumSlots(lines: Line[]): ConvertResult {
  const outLines: SlotLine[] = []
  let prev: string | null = null

  const firstLine = lines[0]
  const firstEvents = firstLine ? extractChordEvents(firstLine) : null
  const hasLongPickup =
    firstEvents != null &&
    firstEvents.events.length >= 2 &&
    firstEvents.lyricText.length > 0 &&
    firstEvents.events[0].pos / Math.max(1, firstEvents.lyricText.length) > PICKUP_THRESHOLD

  for (const ln of lines) {
    const { slots, nextPrevChord, chords, lyricText } = lineTo8Slots(ln, prev, hasLongPickup)
    outLines.push({ slots, chords, lyricText })
    prev = nextPrevChord
  }

  return { lines: outLines, flat: outLines.flatMap((l) => l.slots) }
}

/**
 * First verse and first chorus in file order. Loops through song.bodyParagraphs, returns Paragraph[].
 */
export function getFirstVerseAndChorusInOrderFromSong(song: Song): Paragraph[] {
  const verse = song.bodyParagraphs.find((p) => p.type?.toLowerCase() === 'verse' && p.hasRenderableItems())
  const chorus = song.bodyParagraphs.find((p) => p.type?.toLowerCase() === 'chorus' && p.hasRenderableItems())
  const chosen = [verse, chorus].filter((p): p is Paragraph => p != null)
  if (chosen.length === 0) return []
  return chosen.sort((a, b) => song.bodyParagraphs.indexOf(a) - song.bodyParagraphs.indexOf(b))
}

