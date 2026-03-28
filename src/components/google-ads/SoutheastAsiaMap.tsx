import React from 'react';
import { motion } from 'motion/react';
import { countriesMock } from '../../data/googleAdsMockData';

interface SoutheastAsiaMapProps {
  selectedCountry: string | null;
  onCountrySelect: (country: string | null) => void;
}

export const SoutheastAsiaMap: React.FC<SoutheastAsiaMapProps> = ({ selectedCountry, onCountrySelect }) => {
  const countries = countriesMock;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('vi-VN');
  };

  return (
    <div className="bg-ads-card rounded-xl p-6">
      <h3 className="text-lg font-bold mb-4">Bản đồ Đông Nam Á</h3>
      <div className="relative bg-ads-card rounded-lg p-4 overflow-auto">
        <svg
          viewBox="0 0 400 250"
          className="w-full h-auto"
          style={{ minHeight: '500px' }}
        >
          {/* Background */}
          <rect width="400" height="250" fill="#12261c" />

          {/* Countries */}
          {countries.map((country) => {
            const isSelected = selectedCountry === country.id;
            return (
              <g key={country.id}>
                <path
                  d={country.path}
                  fill={isSelected ? '#22c55e' : '#166534'}
                  stroke={isSelected ? '#4ade80' : '#14532d'}
                  strokeWidth={isSelected ? '2' : '1'}
                  className="cursor-pointer transition-all hover:fill-[#3d428d]"
                  onClick={() => onCountrySelect(isSelected ? null : country.id)}
                  style={{
                    filter: isSelected ? 'brightness(1.3) drop-shadow(0 0 8px rgba(255, 77, 141, 0.6))' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                />
                {/* Country label */}
                <text
                  x={country.x}
                  y={country.y}
                  fill={isSelected ? '#ffffff' : '#9ca3af'}
                  fontSize="10"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {country.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Country Info */}
        {selectedCountry && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-ads-active rounded-lg border border-emerald-400/40"
          >
            <h4 className="text-lg font-bold text-emerald-300 mb-2">
              {countries.find(c => c.id === selectedCountry)?.name}
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Impressions</div>
                <div className="text-white font-semibold">12,345</div>
              </div>
              <div>
                <div className="text-gray-400">Clicks</div>
                <div className="text-white font-semibold">456</div>
              </div>
              <div>
                <div className="text-gray-400">Conversions</div>
                <div className="text-white font-semibold">23</div>
              </div>
              <div>
                <div className="text-gray-400">Cost</div>
                <div className="text-white font-semibold">{formatCurrency(1234567)} ₫</div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
