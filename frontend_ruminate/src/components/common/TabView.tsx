"use client";

import React, { ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabViewProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export default function TabView({ 
  tabs, 
  activeTabId, 
  onTabChange,
  className = ''
}: TabViewProps) {
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Tab Headers */}
      <div className="flex border-b border-neutral-200">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-4 py-2 flex items-center gap-2 text-sm font-medium
                ${isActive 
                  ? 'text-primary-800 border-b-2 border-primary-500 bg-primary-50/50' 
                  : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50'}
                transition-colors duration-150
              `}
            >
              {tab.icon && <span className="text-lg">{tab.icon}</span>}
              {tab.label}
            </button>
          );
        })}
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`h-full w-full ${tab.id === activeTabId ? 'block' : 'hidden'}`}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
