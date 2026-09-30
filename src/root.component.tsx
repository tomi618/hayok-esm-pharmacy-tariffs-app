import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PharmacyTariffs from './pharmacy-tariffs.component';

const Root: React.FC = () => (
  <BrowserRouter basename={window.getOpenmrsSpaBase()}>
    <Routes>
      <Route path="pharmacy-tariffs" element={<PharmacyTariffs />} />
    </Routes>
  </BrowserRouter>
);

export default Root;
