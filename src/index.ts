import { getAsyncLifecycle, defineConfigSchema } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import { moduleName } from './constants';

const options = {
  featureName: 'pharmacy-tariffs',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

// Root component
export const root = getAsyncLifecycle(() => import('./root.component'), options);

// Extensions
export const coPayEditor = getAsyncLifecycle(() => import('./co-pay-editor'), {
  featureName: 'hmo-copay-editor',
  moduleName,
});

export const pharmacyTariffsAppMenuLink = getAsyncLifecycle(
  () => import('./pharmacy-tariffs-app-menu-link.component'),
  options,
);
// Modals

// Workspaces

