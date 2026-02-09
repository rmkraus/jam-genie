<script>
  import 'luna-object-viewer/luna-object-viewer.css'
  import LunaObjectViewer from 'luna-object-viewer'
  import { parseChordPro } from './chordpro-parse'
  import {
    getFirstVerseAndChorusInOrderFromSong,
    expandToFourLines,
    convertChordSheetLinesToStrumSlots,
  } from './chordpro-to-strum'

  /** Svelte action: bind luna-object-viewer to a container and update when data changes. */
  function lunaViewer(node, data) {
    const viewer = new LunaObjectViewer(node, { accessGetter: false })
    if (data != null) viewer.set(data)
    return {
      update(data) {
        if (data != null) viewer.set(data)
      },
    }
  }

  /** Ordered sections (verse and/or chorus) with their Strum slot results. */
  let sectionsWithSlots = $state(/** @type {Array<{ kind: 'verse'|'chorus'; serialized: unknown[]; slots: import('./chordpro-to-strum').ConvertResult }> */ ([]))
  let parsedData = $state(/** @type {object | null} */ (null))
  let parsedJson = $state(/** @type {string | null} */ (null))
  let fileName = $state(/** @type {string | null} */ (null))
  let error = $state(/** @type {string | null} */ (null))
  let fullscreen = $state(false)
  let noSection = $state(false)
  let pastedText = $state('')

  function parseChordProText(text, sourceName = 'Loaded content') {
    parsedData = null
    parsedJson = null
    fileName = sourceName
    error = null
    noSection = false
    sectionsWithSlots = []

    try {
      const song = parseChordPro(text)
      parsedData = song
      parsedJson = JSON.stringify(song, null, 2)

      const ordered = getFirstVerseAndChorusInOrderFromSong(song)

      if (ordered.length === 0) {
        noSection = true
        sectionsWithSlots = []
        return
      }

      sectionsWithSlots = ordered.map((p) => {
        const lines = p.lines.filter((line) => line.hasRenderableItems())
        return {
          kind: p.type,
          serialized: lines,
          slots: convertChordSheetLinesToStrumSlots(expandToFourLines(lines)),
        }
      })
    } catch (err) {
      error = err instanceof Error ? err.message : 'Parse failed'
    }
  }

  function handleFileChange(e) {
    const file = e.target?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      parseChordProText(/** @type {string} */ (reader.result), file.name)
    }
    reader.onerror = () => {
      error = 'Failed to read file'
    }
    reader.readAsText(file)
  }

  function handlePasteParse() {
    const text = pastedText.trim()
    if (!text) return
    parseChordProText(text, 'Pasted content')
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
  <div class="card-header">ChordPro</div>
  <div class="card-body">
    <p class="text-body mb-3">
      Upload a ChordPro file (<code>.cho</code>, <code>.chordpro</code>, or text). 
    </p>
    <div class="mb-3">
      <label for="chordpro-paste" class="form-label">Paste ChordPro content</label>
      <textarea
        id="chordpro-paste"
        class="form-control font-monospace"
        rows="6"
        placeholder="Paste your ChordPro text here..."
        bind:value={pastedText}
      ></textarea>
      <button
        type="button"
        class="btn btn-primary mt-2"
        disabled={!pastedText.trim()}
        onclick={handlePasteParse}
      >
        Parse
      </button>
    </div>
    <div class="mb-2">
      <label for="chordpro-file" class="form-label">Or upload a file</label>
      <input
        id="chordpro-file"
        type="file"
        accept=".cho,.chordpro,.txt,text/plain"
        class="form-control"
        onchange={handleFileChange}
      />
    </div>
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
        <div class="json-viewer-wrap" use:lunaViewer={parsedData}></div>
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
      <div class="json-viewer-wrap json-viewer-wrap-fullscreen" use:lunaViewer={parsedData}></div>
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
