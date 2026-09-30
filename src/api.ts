import type { Hmo, PaginatedDrugsResponse } from './types';

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/$/, '')}${path}`;
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(joinUrl(baseUrl, path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (typeof data === 'object' && data && 'error' in data && String((data as { error: string }).error)) ||
      (typeof data === 'string' ? data : null) ||
      res.statusText ||
      'Request failed';
    throw new Error(message);
  }

  return data as T;
}

export async function syncHmos(baseUrl: string) {
  return request<{ synced: number }>(baseUrl, '/sync/hmos', { method: 'POST' });
}

export async function syncDrugs(baseUrl: string) {
  return request<{ synced: number }>(baseUrl, '/sync/drugs', { method: 'POST' });
}

export async function fetchHmos(baseUrl: string) {
  const data = await request<Hmo[] | { data: Hmo[] }>(baseUrl, '/hmos');
  return Array.isArray(data) ? data : data.data ?? [];
}

export async function updateHmoCoPay(baseUrl: string, hmoId: number, coPay: number) {
  return request<{ updated: number }>(baseUrl, `/hmos/${hmoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ co_pay: coPay }),
  });
}

export async function fetchDrugs(
  baseUrl: string,
  params: { hmoId: number; page: number; limit: number; search?: string },
) {
  const qs = new URLSearchParams({
    hmo_id: String(params.hmoId),
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search?.trim()) {
    qs.set('search', params.search.trim());
  }
  return request<PaginatedDrugsResponse>(baseUrl, `/drugs?${qs.toString()}`);
}

export async function updateDrugPrices(
  baseUrl: string,
  hmoId: number,
  prices: { drug_id: number; price: number }[],
) {
  const res = await fetch(`${baseUrl}/hmos/${hmoId}/prices`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prices }),
  });
  if (!res.ok) throw new Error((await res.text()) || 'Failed to save prices');
}