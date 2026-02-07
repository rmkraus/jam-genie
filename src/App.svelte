<script>
  import { getApiKey, setApiKey, clearApiKey } from './lib/api-key-store'
  import CreateSongCard from './lib/CreateSongCard.svelte'
  import ChordProUploadCard from './lib/ChordProUploadCard.svelte'

  let apiKeyStatus = $state('loading') // 'loading' | 'saved' | 'none'
  let apiKeyInput = $state('')
  let saving = $state(false)
  let clearing = $state(false)
  let error = $state('')

  getApiKey().then((key) => {
    apiKeyStatus = key != null && key !== '' ? 'saved' : 'none'
  })

  async function handleSaveKey(e) {
    e?.preventDefault()
    const trimmed = apiKeyInput.trim()
    if (!trimmed) return
    saving = true
    error = ''
    try {
      await setApiKey(trimmed)
      apiKeyStatus = 'saved'
      apiKeyInput = ''
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save'
    } finally {
      saving = false
    }
  }

  async function handleClearKey() {
    clearing = true
    error = ''
    try {
      await clearApiKey()
      apiKeyStatus = 'none'
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to clear'
    } finally {
      clearing = false
    }
  }
</script>

<div class="container py-4">
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary rounded mb-4">
    <div class="container-fluid">
      <a class="navbar-brand" href="#">Jam Genie</a>
      <div class="navbar-nav">
      </div>
    </div>
  </nav>


  <div class="row g-3">
    {#if false}
      <!-- API Key card (hidden) -->
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-header">Strum Machine API</div>
          <div class="card-body">
            {#if apiKeyStatus === 'loading'}
              <p class="text-muted mb-0">Checking for saved API key…</p>
            {:else if apiKeyStatus === 'saved'}
              <p class="text-success mb-2 mb-md-0 me-md-2">
                <strong>API key saved.</strong> Your key is stored locally and used for Strum Machine requests.
              </p>
              <button
                class="btn btn-outline-danger"
                disabled={clearing}
                onclick={handleClearKey}
              >
                {clearing ? 'Clearing…' : 'Clear API key'}
              </button>
            {:else}
              <p class="text-body mb-3">Enter your Strum Machine API key to use this app. It is stored only on this device.</p>
              <form class="d-flex flex-wrap gap-2 align-items-end" onsubmit={handleSaveKey}>
                <div class="flex-grow-1" style="min-width: 200px;">
                  <label for="api-key" class="form-label visually-hidden">API key</label>
                  <input
                    id="api-key"
                    type="password"
                    class="form-control"
                    placeholder="API key"
                    bind:value={apiKeyInput}
                    autocomplete="off"
                  />
                </div>
                <button type="submit" class="btn btn-primary" disabled={saving || !apiKeyInput.trim()}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </form>
            {/if}
            {#if error}
              <p class="text-danger small mt-2 mb-0">{error}</p>
            {/if}
          </div>
        </div>
      </div>

      <div class="col-12">
        <CreateSongCard apiKeySaved={apiKeyStatus === 'saved'} />
      </div>
    {/if}

    <div class="col-12">
      <ChordProUploadCard />
    </div>
  </div>

</div>

<style>
  .logo {
    height: 4em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
</style>
