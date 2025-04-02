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
        className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors duration-200"
      >
        <span>{getDisplayText()}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-64 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg">
          {PRESET_OBJECTIVES.map((objective) => (
            <div
              key={objective.id}
              className="p-2 hover:bg-neutral-50 cursor-pointer"
              onClick={() => handleObjectiveSelect(objective)}
            >
              <div className="font-medium text-sm text-neutral-800">{objective.label}</div>
              {objective.id !== 'custom' && (
                <div className="text-xs text-neutral-600 mt-1">{objective.objective}</div>
              )}
            </div>
          ))}
          
          {selectedObjective.id === 'custom' && (
            <div className="p-2 border-t border-neutral-200">
              <input
                type="text"
                value={customObjective}
                onChange={handleCustomObjectiveChange}
                placeholder="Enter your objective..."
                className="w-full px-3 py-2 text-sm text-neutral-800 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
} 