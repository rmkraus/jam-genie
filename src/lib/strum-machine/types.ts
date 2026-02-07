/**
 * Types for the Strum Machine API (from openapi/api-spec.yaml).
 */

export type TimeSignature = '4/4' | '3/4' | '6/8' | '9/8';
export type DisplayTimeSignature = '4/4' | '2/2' | '3/4' | '6/8' | '9/8' | '';
export type SectionType = 'i' | 'o' | 'sf' | 'sl';
export type CellEffect = 'rest' | 'stop' | 'diamond';

export interface Owner {
  id?: string;
  firstName?: string;
  lastName?: string;
}

/** Chord cell: either a chord string or { chord, effect? }. */
export type Cell = string | { chord: string; effect?: CellEffect };

export interface Section {
  name?: string;
  type?: SectionType;
  repetitions?: number;
  lineLengths?: number[];
  cells: Cell[];
}

export interface Song {
  id?: string;
  url?: string;
  name: string;
  owner?: Owner;
  key: string;
  tpm?: number;
  timeSignature?: TimeSignature;
  displayTimeSignature?: DisplayTimeSignature;
  notes?: string;
  sections: Section[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiError {
  error?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

export interface SongListItem {
  id: string;
  name: string;
  key: string;
  updatedAt: string;
}

export interface SongsListResponse {
  data: SongListItem[];
  pagination: Pagination;
}

export interface ListSong {
  id?: string;
  name?: string;
  owner?: Owner;
  medleySongs?: { id?: string; name?: string }[];
  updatedAt?: string;
}

export interface List {
  id?: string;
  url?: string;
  name: string;
  owner?: Owner;
  songs?: ListSong[];
  createdAt?: string;
}

export interface ListSummary {
  id?: string;
  name?: string;
  owner?: Owner;
  songCount?: number;
  createdAt?: string;
}

export interface ListsListResponse {
  data: ListSummary[];
  pagination: Pagination;
}

export type SongSort = 'updatedAt' | 'createdAt' | 'name' | 'id';

export interface ListSongsParams {
  limit?: number;
  offset?: number;
  sort?: SongSort;
  search?: string;
}

export interface ListListsParams {
  limit?: number;
  offset?: number;
}

export interface CreateListBody {
  name: string;
}

export interface UpdateListBody {
  name?: string;
}

export interface AddSongToListBody {
  songId?: string;
  medleyId?: string;
}
