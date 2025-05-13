import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const PRESET_OBJECTIVES = [
  {
    id: 'vocabulary',
    label: 'Key Vocabulary',
    objective: 'Focus on key vocabulary and jargon that a novice reader would not be familiar with.'
  },
  {
    id: 'concepts',
    label: 'Main Concepts',
    objective: 'Identify and explain the main concepts and ideas presented in the text.'
  },
  {
    id: 'relationships',
    label: 'Relationships',
    objective: 'Analyze relationships between different concepts and how they connect to form larger ideas.'
  },
  {
    id: 'custom',
    label: 'Custom Objective',
    objective: ''
  }
];

interface ObjectiveSelectorProps {
  onObjectiveChange: (objective: string) => void;
}

export default function ObjectiveSelector({ onObjectiveChange }: ObjectiveSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState(PRESET_OBJECTIVES[0]);
  const [customObjective, setCustomObjective] = useState('');

  const handleObjectiveSelect = (objective: typeof PRESET_OBJECTIVES[0]) => {
    setSelectedObjective(objective);
    if (objective.id !== 'custom') {
      onObjectiveChange(objective.objective);
      setIsOpen(false);
    }
  };

  const handleCustomObjectiveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomObjective(e.target.value);
    onObjectiveChange(e.target.value);
  };

  // Get the display text for the button
  const getDisplayText = () => {
    if (selectedObjective.id === 'custom' && customObjective) {
      // Truncate long custom objectives
      return customObjective.length > 30 
        ? customObjective.substring(0, 27) + '...'
        : customObjective;
    }
    return selectedObjective.label;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-ink-700 bg-paper-50 
                  border border-paper-300 rounded-md hover:bg-paper-100 
                  transition-colors duration-300 shadow-paper
                  font-medium tracking-wide"
      >
        <span>{getDisplayText()}</span>
        <ChevronDown className="w-4 h-4 text-ink-500" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-64 mt-2 bg-paper-50 border border-paper-200 
                      rounded-md shadow-paper overflow-hidden">
          {PRESET_OBJECTIVES.map((objective) => (
            <div
              key={objective.id}
              className="p-3 hover:bg-paper-100 cursor-pointer border-b border-paper-200 last:border-b-0 
                        transition-colors duration-200"
              onClick={() => handleObjectiveSelect(objective)}
            >
              <div className="font-medium text-sm text-ink-800">{objective.label}</div>
              {objective.id !== 'custom' && (
                <div className="text-xs text-ink-600 mt-1.5 font-light italic">{objective.objective}</div>
              )}
            </div>
          ))}
          
          {selectedObjective.id === 'custom' && (
            <div className="p-3 border-t border-paper-200 bg-paper-100">
              <input
                type="text"
                value={customObjective}
                onChange={handleCustomObjectiveChange}
                placeholder="Enter your objective..."
                className="w-full px-3 py-2 text-sm text-ink-800 border border-paper-300 
                          rounded-md focus:outline-none focus:ring-1 focus:ring-terracotta-400 
                          focus:border-terracotta-300 bg-paper-50 font-light"
                autoFocus
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
} 