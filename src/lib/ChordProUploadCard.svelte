<script>
  import ChordSheetJS from 'chordsheetjs'
  import { JsonView } from '@zerodevx/svelte-json-view'
  import { getFirstVerseAndChorusInOrderFromSections, expandToFourLines, convertChordSheetLinesToStrumSlots } from './chordpro-to-strum'

  /** Ordered sections (verse and/or chorus) with their Strum slot results. */
  let sectionsWithSlots = $state(/** @type {Array<{ kind: 'verse'|'chorus'; serialized: unknown[]; slots: import('./chordpro-to-strum').ConvertResult }> */ ([]))
  let parsedData = $state(/** @type {object | null} */ (null))
  let parsedJson = $state(/** @type {string | null} */ (null))
  let fileName = $state(/** @type {string | null} */ (null))
  let error = $state(/** @type {string | null} */ (null))
  let fullscreen = $state(false)
  let noSection = $state(false)

  function handleFileChange(e) {
    const file = e.target?.files?.[0]
    if (!file) return

    parsedData = null
    parsedJson = null
    fileName = file.name
    error = null
    noSection = false
    sectionsWithSlots = []

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = /** @type {string} */ (reader.result)
        const parser = new ChordSheetJS.ChordProParser()
        const song = parser.parse(text)
        const serializer = new ChordSheetJS.ChordSheetSerializer()
        const fullSerialized = serializer.serialize(song)
        parsedData = fullSerialized
        parsedJson = JSON.stringify(fullSerialized, null, 2)

        const sectionBlocks = (song.bodyParagraphs || [])
          .filter((p) => p.type === 'verse' || p.type === 'chorus')
          .map((p) => ({ kind: p.type, lines: p.lines.map((l) => serializer.serializeLine(l)) }))
        const ordered = getFirstVerseAndChorusInOrderFromSections(sectionBlocks)

        if (ordered.length === 0) {
          noSection = true
          sectionsWithSlots = []
          return
        }

        sectionsWithSlots = ordered.map((s) => ({
          kind: s.kind,
          serialized: s.serialized,
          slots: convertChordSheetLinesToStrumSlots(expandToFourLines(s.lines)),
        }))
      } catch (err) {
        error = err instanceof Error ? err.message : 'Parse failed'
      }
    }
    reader.onerror = () => {
      error = 'Failed to read file'
    }
    reader.readAsText(file)
  }

  function copyJson() {
    if (!parsedJson) return
    navigator.clipboard.writeText(parsedJson)
  }

  function clearResult() {
    parsedData = null
    parsedJson = null
    fileName = null
    error = null
    fullscreen = false
    noSection = false
    sectionsWithSlots = []
  }

  function closeFullscreen() {
    fullscreen = false
  }
</script>

<div class="card shadow-sm">
  <div class="card-header">Upload ChordPro</div>
  <div class="card-body">
    <p class="text-body mb-3">
      Upload a ChordPro file (<code>.cho</code>, <code>.chordpro</code>, or text). It will be parsed with
      <a href="https://github.com/martijnversluis/ChordSheetJS" target="_blank" rel="noreferrer">ChordSheetJS</a> and shown as JSON.
    </p>
    <input
      type="file"
      accept=".cho,.chordpro,.txt,text/plain"
      class="form-control mb-2"
      onchange={handleFileChange}
    />
    {#if fileName && !parsedData && !error && !noSection}
      <p class="text-muted small mb-0">Parsing {fileName}…</p>
    {/if}
    {#if noSection}
      <p class="text-warning small mb-2">Need at least one verse or chorus with notes (no <code>start_of_verse</code>/<code>end_of_verse</code> or <code>start_of_chorus</code>/<code>end_of_chorus</code> with lyric lines).</p>
      <button type="button" class="btn btn-sm btn-outline-secondary" onclick={clearResult}>Clear</button>
    {/if}
    {#if error}
      <p class="text-danger small mb-2">{error}</p>
      <button type="button" class="btn btn-sm btn-outline-secondary" onclick={clearResult}>Clear</button>
    {/if}
    {#if parsedData}
      <div class="mb-2">
        <div class="d-flex flex-wrap gap-1 align-items-center mb-2">
          <span class="text-success small">{fileName} → JSON</span>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-primary" onclick={copyJson}>Copy JSON</button>
            <button type="button" class="btn btn-outline-primary" onclick={() => (fullscreen = true)}>Fullscreen</button>
            <button type="button" class="btn btn-outline-secondary" onclick={clearResult}>Clear</button>
          </div>
        </div>
        <div class="json-viewer-wrap">
          <JsonView json={parsedData} depth={2} />
        </div>
        {#each sectionsWithSlots as { kind, slots }}
          <div class="mt-3">
            <h6 class="mb-2 text-capitalize">{kind}</h6>
            <div class="strum-slots-wrap">
              {#each slots.lines as line}
                <div class="strum-slot-line">
                  <span class="strum-slot-chords">{line.slots.join(' ')}</span>
                  {#if line.lyricText}
                    <span class="strum-slot-lyric text-muted"> — {line.lyricText}</span>
                  {/if}
                </div>
              {/each}
            </div>
            <p class="small text-muted mt-1 mb-0">Flat: {slots.flat.join(' ')}</p>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if fullscreen && parsedData}
  <div
    class="json-fullscreen-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="JSON fullscreen"
  >
    <div class="json-fullscreen-header">
      <span class="text-success">{fileName} — JSON viewer</span>
      <button type="button" class="btn btn-sm btn-outline-light" onclick={closeFullscreen}>Close</button>
    </div>
    <div class="json-fullscreen-body">
      <div class="json-viewer-wrap json-viewer-wrap-fullscreen">
        <JsonView json={parsedData} depth={2} />
      </div>
    </div>
  </div>
{/if}

<style>
  .json-viewer-wrap {
    text-align: left;
    max-height: 320px;
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 0.875rem;
    padding: 0.75rem;
    background: var(--bs-light, #f8f9fa);
    border: 1px solid var(--bs-border-color, #dee2e6);
    border-radius: 0.25rem;
  }

  .json-viewer-wrap-fullscreen {
    max-height: none;
    height: 100%;
  }

  .json-fullscreen-overlay {
    position: fixed;
    inset: 0;
    z-index: 1050;
    display: flex;
    flex-direction: column;
    background: var(--bs-body-bg, #fff);
  }

  .json-fullscreen-header {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: var(--bs-dark, #212529);
    color: var(--bs-light, #f8f9fa);
  }

  .json-fullscreen-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 1rem;
  }

  .strum-slots-wrap {
    text-align: left;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 0.875rem;
    padding: 0.5rem 0;
  }

  .strum-slot-line {
    margin-bottom: 0.25rem;
  }

  .strum-slot-chords {
    font-weight: 500;
  }

  .strum-slot-lyric {
    font-weight: normal;
  }
</style>
