<script>
  import { createGetToken } from './api-key-store'
  import { StrumMachineClient } from './strum-machine'

  let { apiKeySaved = false } = $props()

  let creatingSong = $state(false)
  let songError = $state('')
  let lastCreatedSong = $state(/** @type {{ id?: string; url?: string; name: string } | null} */ (null))

  async function handleCreateSong() {
    if (!apiKeySaved) return
    creatingSong = true
    songError = ''
    lastCreatedSong = null
    try {
      const client = new StrumMachineClient({
        getToken: createGetToken(),
        baseUrl: import.meta.env.DEV ? '/api/v0' : undefined,
      })
      const song = await client.createSong({
        name: 'Untitled',
        key: 'C',
        sections: [{ cells: ['C', 'C', 'C', 'D'] }],
      })
      lastCreatedSong = {
        id: song.id,
        url: song.url,
        name: song.name ?? 'Untitled',
      }
    } catch (err) {
      songError =
        err?.body?.message ?? err?.message ?? (err instanceof Error ? err.message : 'Failed to create song')
    } finally {
      creatingSong = false
    }
  }
</script>

<div class="card shadow-sm">
  <div class="card-header">Songs</div>
  <div class="card-body">
    {#if !apiKeySaved}
      <p class="text-muted mb-2">Save an API key above to create songs.</p>
    {/if}
    <button
      class="btn btn-primary"
      disabled={!apiKeySaved || creatingSong}
      onclick={handleCreateSong}
    >
      {creatingSong ? 'Creating…' : 'Create new song'}
    </button>
    {#if lastCreatedSong}
      <p class="text-success small mt-2 mb-0">
        Created "{lastCreatedSong.name}".
        {#if lastCreatedSong.url}
          <a href={lastCreatedSong.url} target="_blank" rel="noreferrer">Open in Strum Machine</a>
        {/if}
      </p>
    {/if}
    {#if songError}
      <p class="text-danger small mt-2 mb-0">{songError}</p>
    {/if}
  </div>
</div>
