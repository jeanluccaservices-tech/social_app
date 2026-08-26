import React from 'react';
import { BRAZIL_STATES, BRAZIL_CITIES } from '../../lib/cities';

// Dropdown of existing Brazilian cities, grouped by state, used everywhere
// the app collects a location so results stay normalized and matchable
// (instead of free text like "sp" vs "São Paulo" vs "sao paulo - sp").
export const CitySelect = ({ value, onChange, placeholder = 'Selecione sua cidade', className = '' }) => (
  <select value={value} onChange={onChange} className={className}>
    <option value="">{placeholder}</option>
    {BRAZIL_STATES.map(({ uf, name }) => {
      const cities = BRAZIL_CITIES.filter((c) => c.uf === uf);
      if (cities.length === 0) return null;
      return (
        <optgroup key={uf} label={name}>
          {cities.map((c) => (
            <option key={`${c.city}-${uf}`} value={`${c.city}, ${uf}`}>
              {c.city} - {uf}
            </option>
          ))}
        </optgroup>
      );
    })}
  </select>
);
