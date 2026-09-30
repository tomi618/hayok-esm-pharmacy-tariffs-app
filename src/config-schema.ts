import { Type, validators } from '@openmrs/esm-framework';

export const configSchema = {
  apiBaseUrl: {
    _type: Type.String,
    _default: 'http://localhost:8080',
    _description: 'Base URL of the Go pharmacy tariffs service',
    _validators: [validators.isUrl],
  },
  pageSize: {
    _type: Type.Number,
    _default: 50,
    _description: 'Number of drugs to show per page',
  },
};

export type PharmacyTariffsConfig = {
  apiBaseUrl: string;
  pageSize: number;
};

export type ConfigSchema = Record<string, never>;
