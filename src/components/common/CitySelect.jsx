import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { BRAZIL_CITIES } from '../../lib/cities';

const MAX_RESULTS = 40;

// Accent/case-insensitive so "sao paulo" still finds "São Paulo".
const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ~5.6k cities is too many for a plain <select> to browse — this is a
// searchable combobox instead: type part of a name, pick from a short
// filtered list. `onChange` still receives a `{ target: { value } }`
// shape so it drops into the existing `(e) => setX(e.target.value)`
// call sites unchanged.
export const CitySelect = ({ value, onChange, placeholder = 'Selecione sua cidade', className = '' }) => {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Stay in sync when the value changes from outside (e.g. loading a
  // saved profile), but not while the person is actively typing/open.
  useEffect(() => {
    if (!open) setQuery(value || '');
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(value || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, value]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return BRAZIL_CITIES
      .filter((c) => normalize(c.city).includes(q))
      .slice(0, MAX_RESULTS);
  }, [query]);

  const handleSelect = (c) => {
    const label = `${c.city}, ${c.uf}`;
    setQuery(label);
    setOpen(false);
    onChange({ target: { value: label } });
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    if (e.target.value.trim() === '') onChange({ target: { value: '' } });
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--c-text-faint)] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={className ? `${className} pl-8` : 'pl-8'}
        />
      </div>

      {open && query.trim() && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl shadow-2xl">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-[var(--c-text-faint)]">Nenhuma cidade encontrada.</p>
          ) : (
            results.map((c) => (
              <button
                key={`${c.city}-${c.uf}`}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full text-left px-3 py-2 text-xs text-[var(--c-text)] hover:bg-[var(--c-overlay-10)] transition"
              >
                {c.city} <span className="text-[var(--c-text-faint)]">- {c.uf}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
