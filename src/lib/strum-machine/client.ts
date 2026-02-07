/**
 * Strum Machine API client. Uses bearer token (API key) auth.
 * Base URL: https://beta.strummachine.com/api/v0
 */

import type {
  AddSongToListBody,
  CreateListBody,
  List,
  ListListsParams,
  ListsListResponse,
  ListSongsParams,
  Song,
  SongsListResponse,
  UpdateListBody,
} from './types';

const BASE_URL = 'https://beta.strummachine.com/api/v0';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: { error?: string; message?: string; details?: Record<string, unknown> }
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class StrumMachineClient {
  private baseUrl: string;
  private getToken: () => string | Promise<string>;

  constructor(options: {
    baseUrl?: string;
    /** Function that returns the bearer token (API key). */
    getToken: () => string | Promise<string>;
  }) {
    this.baseUrl = options.baseUrl ?? BASE_URL;
    this.getToken = options.getToken;
  }

  private async request<T>(
    method: string,
    path: string,
    opts?: { body?: unknown; searchParams?: Record<string, string | number | undefined> }
  ): Promise<T> {
    const token = await Promise.resolve(this.getToken());
    const base = this.baseUrl.replace(/\/$/, '');
    const pathPart = path.startsWith('/') ? path : `/${path}`;
    const fullHref =
      base.startsWith('http:') || base.startsWith('https:')
        ? `${base}${pathPart}`
        : `${typeof globalThis !== 'undefined' && 'location' in globalThis ? (globalThis as Window).location.origin : ''}${base.startsWith('/') ? base : `/${base}`}${pathPart}`;
    const url = new URL(fullHref);
    if (opts?.searchParams) {
      for (const [k, v] of Object.entries(opts.searchParams)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (opts?.body != null) headers['Content-Type'] = 'application/json';

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: opts?.body != null ? JSON.stringify(opts.body) : undefined,
    });

    const contentType = res.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    let body: { error?: string; message?: string; details?: Record<string, unknown> } | undefined;
    if (isJson && res.body) {
      try {
        body = await res.json();
      } catch {
        // ignore
      }
    }

    if (!res.ok) {
      const msg = body?.message ?? body?.error ?? res.statusText ?? `HTTP ${res.status}`;
      throw new ApiError(msg, res.status, body);
    }

    if (res.status === 204) return undefined as T;
    if (isJson && res.body) return (body ?? (await res.json())) as T;
    return undefined as T;
  }

  // --- Songs ---

  async listSongs(params?: ListSongsParams): Promise<SongsListResponse> {
    return this.request('GET', '/songs', {
      searchParams: params as Record<string, string | number | undefined>,
    });
  }

  async createSong(song: Song): Promise<Song> {
    return this.request('POST', '/songs', { body: song });
  }

  async getSong(id: string): Promise<Song> {
    return this.request('GET', `/songs/${encodeURIComponent(id)}`);
  }

  async updateSong(id: string, song: Song): Promise<Song> {
    return this.request('PUT', `/songs/${encodeURIComponent(id)}`, { body: song });
  }

  async deleteSong(id: string): Promise<void> {
    return this.request('DELETE', `/songs/${encodeURIComponent(id)}`);
  }

  // --- Lists ---

  async listLists(params?: ListListsParams): Promise<ListsListResponse> {
    return this.request('GET', '/lists', {
      searchParams: params as Record<string, string | number | undefined>,
    });
  }

  async createList(body: CreateListBody): Promise<List> {
    return this.request('POST', '/lists', { body });
  }

  async getList(id: string): Promise<List> {
    return this.request('GET', `/lists/${encodeURIComponent(id)}`);
  }

  async updateList(id: string, body: UpdateListBody): Promise<List> {
    return this.request('PUT', `/lists/${encodeURIComponent(id)}`, { body });
  }

  async deleteList(id: string): Promise<void> {
    return this.request('DELETE', `/lists/${encodeURIComponent(id)}`);
  }

  // --- List songs ---

  async addSongToList(listId: string, body: AddSongToListBody): Promise<List> {
    return this.request('POST', `/lists/${encodeURIComponent(listId)}/songs`, { body });
  }

  async removeSongFromList(listId: string, songId: string): Promise<void> {
    return this.request(
      'DELETE',
      `/lists/${encodeURIComponent(listId)}/songs/${encodeURIComponent(songId)}`
    );
  }
}
