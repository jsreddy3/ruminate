import { useState, useCallback } from 'react';

export type ViewMode = 'ruminate' | 'pdf' | 'glossary' | 'annotations';

interface UseViewModeProps {
  onViewModeChange?: (mode: ViewMode) => void;
}

interface UseViewModeReturn {
  // State
  viewMode: ViewMode;
  isViewDropdownOpen: boolean;
  viewDropdownPosition: { x: number; y: number };
  
  // Actions
  setViewMode: (mode: ViewMode) => void;
  handleViewDropdownToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  closeViewDropdown: () => void;
  handleViewModeSelect: (mode: ViewMode) => void;
}

export function useViewMode({ 
  onViewModeChange 
}: UseViewModeProps = {}): UseViewModeReturn {
  // View mode state
  const [viewMode, setViewModeInternal] = useState<ViewMode>('ruminate');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [viewDropdownPosition, setViewDropdownPosition] = useState({ x: 0, y: 0 });
  
  // Handle view mode change with callback
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeInternal(mode);
    onViewModeChange?.(mode);
  }, [onViewModeChange]);
  
  // Handle dropdown toggle
  const handleViewDropdownToggle = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setViewDropdownPosition({
      x: rect.left,
      y: rect.bottom + 8
    });
    setIsViewDropdownOpen(prev => !prev);
  }, []);
  
  // Close dropdown
  const closeViewDropdown = useCallback(() => {
    setIsViewDropdownOpen(false);
  }, []);
  
  // Handle view mode selection from dropdown
  const handleViewModeSelect = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    closeViewDropdown();
  }, [setViewMode, closeViewDropdown]);
  
  return {
    // State
    viewMode,
    isViewDropdownOpen,
    viewDropdownPosition,
    
    // Actions
    setViewMode,
    handleViewDropdownToggle,
    closeViewDropdown,
    handleViewModeSelect,
  };
}