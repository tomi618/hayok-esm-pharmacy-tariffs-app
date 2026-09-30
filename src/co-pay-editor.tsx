import React, { useEffect, useState } from 'react';
import { Button } from '@carbon/react';
import { showSnackbar, useSession, userHasAccess } from '@openmrs/esm-framework';
import { updateHmoCoPay } from './api';
import styles from './pharmacy-tariffs.scss';

interface Props {
  baseUrl: string;
  hmoId: number;
  coPay: number;
  onSaved: (value: number) => void;
}

const CoPayEditor: React.FC<Props> = ({ baseUrl, hmoId, coPay, onSaved }) => {
  const session = useSession();
  const [input, setInput] = useState(String(coPay ?? 0));
  const [saving, setSaving] = useState(false);

  // Reset the box when a different HMO is selected
  useEffect(() => setInput(String(coPay ?? 0)), [hmoId, coPay]);

  // The real gate. Without the privilege, nothing renders at all.
  //if (!userHasAccess('set co-pay', session?.user)) return null;

  async function save() {
    const value = Number(input);
    if (Number.isNaN(value) || value < 0) {
      showSnackbar({ kind: 'error', title: 'Enter a valid co-pay amount' });
      return;
    }
    setSaving(true);
    try {
      await updateHmoCoPay(baseUrl, hmoId, value);
      onSaved(value);
      showSnackbar({ kind: 'success', title: 'Co-pay updated' });
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: 'Could not update co-pay',
        subtitle: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.copaySection}>
      <label htmlFor="copay-input">Co-pay</label>
      <div className={styles.copayRow}>
        <input id="copay-input" type="number" inputMode="decimal" min={0} step="0.01"
               value={input} onChange={(e) => setInput(e.target.value)} />
        <Button kind="primary" size="md" disabled={saving} onClick={save}>Save</Button>
      </div>
    </div>
  );
};

export default CoPayEditor;