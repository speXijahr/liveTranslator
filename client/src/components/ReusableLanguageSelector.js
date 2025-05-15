// client/src/components/ReusableLanguageSelector.js
import React from 'react';

function ReusableLanguageSelector({
  id,
  label,
  options, // Expects an array of objects: [{ value: 'en-US', label: 'English (US)' }, ...]
  selectedValue,
  onChange,
  disabled = false,
  className = ''
}) {
  return (
    <div className={`language-selector-component ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <select
        id={id}
        value={selectedValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ReusableLanguageSelector;