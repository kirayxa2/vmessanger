'use client';

import React, { useEffect, useState } from 'react';

const TitleBar: React.FC = () => {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!(window as any).electronAPI);
  }, []);

  if (!isElectron) return null;

  return (
    <div
      className="flex items-center justify-between select-none shrink-0"
      style={{
        height: '36px',
        backgroundColor: '#161e28',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      {/* Left: icon + app name */}
      <div className="px-3 flex items-center gap-2">
        {/* App icon */}
        <img
          src="/logo (1).ico"
          alt="VortexMessenger"
          width={16}
          height={16}
          style={{ imageRendering: 'crisp-edges', flexShrink: 0 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <span className="text-[11px] font-semibold text-gray-500 tracking-wide">
          VortexMessenger
        </span>
      </div>

      {/* Right: window control buttons */}
      <div
        className="flex h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Minimize */}
        <button
          onClick={() => (window as any).electronAPI?.minimize()}
          className="px-3.5 flex items-center justify-center transition-colors hover:bg-white/8 text-gray-500 hover:text-white"
          title="Minimize"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1 6H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>

        {/* Maximize */}
        <button
          onClick={() => (window as any).electronAPI?.maximize()}
          className="px-3.5 flex items-center justify-center transition-colors hover:bg-white/8 text-gray-500 hover:text-white"
          title="Maximize"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
          </svg>
        </button>

        {/* Close */}
        <button
          onClick={() => (window as any).electronAPI?.close()}
          className="px-3.5 flex items-center justify-center transition-colors hover:bg-red-500/80 text-gray-500 hover:text-white"
          title="Close"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
