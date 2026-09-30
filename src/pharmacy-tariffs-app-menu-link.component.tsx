import React from 'react';
import { navigate } from '@openmrs/esm-framework';

const PharmacyTariffsAppMenuLink: React.FC = () => {
  return (
    <a
      href={`${window.spaBase}/pharmacy-tariffs`}
      onClick={(e) => {
        e.preventDefault();
        navigate({ to: `${window.spaBase}/pharmacy-tariffs` });
      }}
    >
      Pharmacy Tariffs
    </a>
  );
};

export default PharmacyTariffsAppMenuLink;