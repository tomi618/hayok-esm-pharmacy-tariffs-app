import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExtensionSlot, showSnackbar, useConfig, useSession } from '@openmrs/esm-framework';
import { Button } from '@carbon/react';
import { ChevronLeft, ChevronRight } from '@carbon/react/icons';
import styles from './pharmacy-tariffs.scss';


import {
  fetchDrugs,
  fetchHmos,
  syncDrugs,
  syncHmos,
  updateDrugPrices, } from './api';

import type { PharmacyTariffsConfig } from './config-schema';
import type { DrugWithPrice, Hmo } from './types';

function formatMoney(n: number) {
  if (Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function drugName(d: DrugWithPrice) {
  return d.name ?? d.Name ?? '—';
}

function drugPrice(d: DrugWithPrice) {
  return d.price ?? d.Price ?? 0;
}

function drugId(d: DrugWithPrice) {
  return d.id ?? d.ID;
}

function isInvalidPrice(value: string) {
  return value.trim() === '' || Number.isNaN(Number(value)) || Number(value) < 0;
}

const isMobile = () => window.matchMedia('(max-width: 800px)').matches;

const PharmacyTariffs: React.FC = () => {
  const config = useConfig<PharmacyTariffsConfig>();
  const baseUrl = config.apiBaseUrl;
  const pageSize = config.pageSize || 200;

  const [booting, setBooting] = useState(true);
  const [bootMessage, setBootMessage] = useState('Syncing HMOs and drugs…');
  const [banner, setBanner] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(
    null,
  );

  const [hmos, setHmos] = useState<Hmo[]>([]);
  const [hmoOpen, setHmoOpen] = useState(true);
  const [selectedHmoId, setSelectedHmoId] = useState<number | null>(null);
  

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [drugs, setDrugs] = useState<DrugWithPrice[]>([]);
  const [loadingDrugs, setLoadingDrugs] = useState(false);

  // Unsaved price edits: { [drugId]: "what the user typed" }.
  // Only drugs whose typed value differs from the saved price live in here.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const dirtyCount = Object.keys(edits).length;

  // Debounce search
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Boot: sync then load HMOs
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBooting(true);
      setBanner({ type: 'info', text: 'Preparing data…' });
      try {
        setBootMessage('Syncing HMOs…');
        await syncHmos(baseUrl);
        if (cancelled) return;

        setBootMessage('Syncing drugs…');
        await syncDrugs(baseUrl);
        if (cancelled) return;

        setBootMessage('Loading HMOs…');
        const list = await fetchHmos(baseUrl);
        if (cancelled) return;

        setHmos(list);
        if (list.length) {
          const firstId = list[0].hmo_id;
          setSelectedHmoId(firstId);
        }
        setBanner({ type: 'success', text: 'Ready' });
        window.setTimeout(() => {
          if (!cancelled) setBanner(null);
        }, 2000);
      } catch (e) {
        if (!cancelled) {
          setBanner({
            type: 'error',
            text: e instanceof Error ? e.message : 'Startup failed',
          });
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  const loadDrugs = useCallback(async () => {
    if (selectedHmoId == null) return;
    setLoadingDrugs(true);
    try {
      const resp = await fetchDrugs(baseUrl, {
        hmoId: selectedHmoId,
        page,
        limit: pageSize,
        search: debouncedSearch,
      });
      setDrugs(resp.data || []);
      setTotalPages(resp.pagination?.total_pages || 1);
      setTotalItems(resp.pagination?.total_items || 0);
      if (resp.pagination?.current_page) {
        setPage(resp.pagination.current_page);
      }
    } catch (e) {
      setDrugs([]);
      setBanner({
        type: 'error',
        text: e instanceof Error ? e.message : 'Failed to load drugs',
      });
    } finally {
      setLoadingDrugs(false);
    }
  }, [baseUrl, selectedHmoId, page, pageSize, debouncedSearch]);

  useEffect(() => {
    if (!booting && selectedHmoId != null) {
      loadDrugs();
    }
  }, [booting, selectedHmoId, page, debouncedSearch, loadDrugs]);

  const selectedHmo = useMemo(
    () => hmos.find((h) => h.hmo_id === selectedHmoId) ?? null,
    [hmos, selectedHmoId],
  );

  function selectHmo(id: number) {
    if (id === selectedHmoId) return;

    // Edits belong to one HMO's price list, so don't carry them over silently.
    if (dirtyCount > 0 && !window.confirm('You have unsaved prices. Discard them and switch HMO?')) {
      return;
    }
    setEdits({});
    setSelectedHmoId(id);
    setPage(1);
    setSearch('');
    setDebouncedSearch('');
    const hmo = hmos.find((h) => h.hmo_id === id);

    // On a phone, get the list out of the way so the drugs are visible
    if (isMobile()) setHmoOpen(false);
  }

  const session = useSession();
  const canEditCoPay =
  session?.user?.roles?.some(
    (r) => r.display === 'System Developer' || r.display === 'System Administrator',
  );

function handleCoPaySaved(value: number) {
  setHmos((prev) => prev.map((h) => (h.hmo_id === selectedHmoId ? { ...h, co_pay: value } : h)));
}

  function handlePriceChange(d: DrugWithPrice, value: string) {
    const id = drugId(d);
    if (id == null) return;
    const key = String(id);
    const unchanged = value !== '' && Number(value) === Number(drugPrice(d));

    setEdits((prev) => {
      const next = { ...prev };
      if (unchanged) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  async function handleSavePrices() {
    if (selectedHmoId == null || dirtyCount === 0) return;

    const entries = Object.entries(edits);
    if (entries.some(([, v]) => isInvalidPrice(v))) {
      showSnackbar({
        kind: 'error',
        title: 'Check the prices',
        subtitle: 'Every price must be a number that is 0 or more.',
      });
      return;
    }

    const updates = entries.map(([id, v]) => ({ drug_id: Number(id), price: Number(v) }));

    setSavingPrices(true);
    try {
      await updateDrugPrices(baseUrl, selectedHmoId, updates);

      // Update the rows we already have on screen so we don't need to refetch
      const saved = new Map(updates.map((u) => [String(u.drug_id), u.price]));
      setDrugs((prev) =>
        prev.map((d) => {
          const p = saved.get(String(drugId(d)));
          if (p === undefined) return d;
          return d.price !== undefined ? { ...d, price: p } : { ...d, Price: p };
        }),
      );
      setEdits({});
      showSnackbar({
        kind: 'success',
        title: 'Prices saved',
        subtitle: `${updates.length} ${updates.length === 1 ? 'price' : 'prices'} updated`,
      });
    } catch (e) {
      // Keep the edits so nothing the user typed is lost
      showSnackbar({
        kind: 'error',
        title: 'Could not save prices',
        subtitle: e instanceof Error ? e.message : 'Please try again',
      });
    } finally {
      setSavingPrices(false);
    }
  }

  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Pharmacy Tariffs</h1>
        <p>HMO drug prices &amp; co-pay</p>
      </header>

      {banner && (
        <div
          className={`${styles.banner} ${
            banner.type === 'error'
              ? styles.bannerError
              : banner.type === 'success'
                ? styles.bannerSuccess
                : styles.bannerInfo
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className={`${styles.layout} ${hmoOpen ? '' : styles.layoutFull}`}>
        {hmoOpen && (
          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>HMOs</h2>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={ChevronLeft}
                onClick={() => setHmoOpen(false)}
              >
                Hide
              </Button>
            </div>
            <div className={styles.hmoList}>
              {!hmos.length && !booting && (
                <p className={styles.muted} style={{ padding: '0.75rem' }}>
                  No HMOs found
                </p>
              )}
              {hmos.map((hmo) => (
                <button
                  key={hmo.hmo_id}
                  type="button"
                  className={`${styles.hmoItem} ${
                    hmo.hmo_id === selectedHmoId ? styles.hmoItemSelected : ''
                  }`}
                  onClick={() => selectHmo(hmo.hmo_id)}
                >
                  {hmo.name}
                  <span className={styles.hmoMeta}>Co-pay: {formatMoney(hmo.co_pay)}</span>
                </button>
              ))}
            </div>

              {selectedHmo && canEditCoPay && (
                <ExtensionSlot
              name="hmo-copay-slot"
              state={{baseUrl,
              hmoId: selectedHmo.hmo_id,
              coPay: selectedHmo.co_pay,
              onSaved: handleCoPaySaved,
          }}
  />
            )}
          </aside>
        )}

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.headerLeft}>
              {!hmoOpen && (
                <Button
                  kind="tertiary"
                  size="sm"
                  renderIcon={ChevronRight}
                  onClick={() => setHmoOpen(true)}
                >
                  HMOs
                </Button>
              )}
              <h2>{selectedHmo ? `Drugs — ${selectedHmo.name}` : 'Drugs'}</h2>
              {selectedHmo && !hmoOpen && (
                <span className={styles.muted}>Co-pay: {formatMoney(selectedHmo.co_pay)}</span>
              )}
            </div>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Search drugs…"
              value={search}
              disabled={selectedHmoId == null}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Drug</th>
                  <th className={styles.colPrice}>Price</th>
                </tr>
              </thead>
              <tbody>
                {loadingDrugs && (
                  <tr>
                    <td colSpan={2} className={`${styles.muted} ${styles.center}`}>
                      Loading drugs…
                    </td>
                  </tr>
                )}
                {!loadingDrugs && selectedHmoId == null && (
                  <tr>
                    <td colSpan={2} className={`${styles.muted} ${styles.center}`}>
                      Select an HMO to view prices
                    </td>
                  </tr>
                )}
                {!loadingDrugs && selectedHmoId != null && drugs.length === 0 && (
                  <tr>
                    <td colSpan={2} className={`${styles.muted} ${styles.center}`}>
                      No drugs found
                    </td>
                  </tr>
                )}
                {!loadingDrugs &&
                  drugs.map((d) => {
                    const id = drugId(d);
                    const key = id != null ? String(id) : undefined;
                    const edited = key !== undefined ? edits[key] : undefined;
                    const changed = edited !== undefined;
                    const invalid = changed && isInvalidPrice(edited);

                    return (
                      <tr key={key ?? drugName(d)}>
                        <td>{drugName(d)}</td>
                        <td className={styles.colPrice}>
                          <input
                            className={`${styles.priceInput} ${
                              invalid ? styles.priceInvalid : changed ? styles.priceChanged : ''
                            }`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            value={edited ?? String(drugPrice(d))}
                            disabled={id == null || savingPrices}
                            aria-label={`Price for ${drugName(d)}`}
                            aria-invalid={invalid}
                            onChange={(e) => handlePriceChange(d, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <footer className={styles.pagination}>
            <Button
              kind="tertiary"
              size="sm"
              disabled={page <= 1 || loadingDrugs}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className={styles.pageInfo}>
              {totalItems === 0
                ? 'No results'
                : `${start}–${end} of ${totalItems} (page ${page} / ${totalPages})`}
            </span>
            <Button
              kind="tertiary"
              size="sm"
              disabled={page >= totalPages || loadingDrugs}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </footer>

          {dirtyCount > 0 && (
            <div className={styles.saveBar} role="status">
              <span>
                {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
              </span>
              <div className={styles.saveBarActions}>
                <Button
                  kind="ghost"
                  size="md"
                  disabled={savingPrices}
                  onClick={() => setEdits({})}
                >
                  Discard
                </Button>
                <Button
                  kind="primary"
                  size="md"
                  disabled={savingPrices}
                  onClick={handleSavePrices}
                >
                  {savingPrices ? 'Saving…' : 'Save prices'}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      {booting && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <div className={styles.spinner} />
            <p>{bootMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacyTariffs;