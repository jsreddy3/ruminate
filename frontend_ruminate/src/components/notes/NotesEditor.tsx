"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Editor, EditorState, RichUtils, ContentState, convertToRaw, convertFromRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';
import NotesList from './NotesList';
import { Notes } from '../../types/notes';

interface NotesEditorProps {
  documentId: string;
  initialContent?: string;
  className?: string;
  onSave?: (content: string) => void;
  blockSequenceMap?: Map<string, number>;
  activeTabId?: string; // The ID of the active tab
}

export default function NotesEditor({
  documentId,
  initialContent,
  className = '',
  onSave,
  blockSequenceMap,
  activeTabId = ''
}: NotesEditorProps) {
  // State for view mode (list or editor)
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  
  // Refetch trigger counter - increment to trigger a refetch
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  
  // Track previous activeTabId to detect changes
  const prevActiveTabIdRef = useRef(activeTabId);
  
  // Trigger refetch when the Notes tab becomes active
  useEffect(() => {
    // Only trigger refetch when switching TO the notes tab
    if (activeTabId === 'notes' && prevActiveTabIdRef.current !== 'notes') {
      console.log('Notes tab activated, triggering refetch');
      setRefetchTrigger(count => count + 1);
    }
    prevActiveTabIdRef.current = activeTabId;
  }, [activeTabId]);
  
  // Selected note to edit
  const [selectedNote, setSelectedNote] = useState<Notes | null>(null);
  
  // Initialize editor state
  const [editorState, setEditorState] = useState(() => {
    if (initialContent) {
      try {
        // Try to parse the initial content as raw Draft.js content
        const contentState = convertFromRaw(JSON.parse(initialContent));
        return EditorState.createWithContent(contentState);
      } catch (e) {
        // If parsing fails, create an editor with the text as plain content
        const contentState = ContentState.createFromText(initialContent);
        return EditorState.createWithContent(contentState);
      }
    }
    return EditorState.createEmpty();
  });
  
  // Save personal notes to localStorage whenever they change
  useEffect(() => {
    if (viewMode === 'editor' && !selectedNote) {
      const contentState = editorState.getCurrentContent();
      const rawContent = JSON.stringify(convertToRaw(contentState));
      
      // Save to localStorage
      localStorage.setItem(`notes-${documentId}`, rawContent);
      
      // Call onSave if provided
      if (onSave) {
        onSave(rawContent);
      }
    }
  }, [editorState, documentId, onSave, viewMode, selectedNote]);
  
  // Load personal notes from localStorage when component mounts
  useEffect(() => {
    if (!selectedNote) {
      const savedContent = localStorage.getItem(`notes-${documentId}`);
      
      if (savedContent) {
        try {
          const contentState = convertFromRaw(JSON.parse(savedContent));
          setEditorState(EditorState.createWithContent(contentState));
        } catch (e) {
          console.error('Failed to load saved notes:', e);
        }
      }
    }
  }, [documentId, selectedNote]);
  
  // Update editor when a note is selected
  useEffect(() => {
    if (selectedNote) {
      const contentState = ContentState.createFromText(selectedNote.content);
      setEditorState(EditorState.createWithContent(contentState));
    }
  }, [selectedNote]);
  
  // Handle keyboard commands (e.g., bold, italic)
  const handleKeyCommand = (command: string, editorState: EditorState) => {
    const newState = RichUtils.handleKeyCommand(editorState, command);
    
    if (newState) {
      setEditorState(newState);
      return 'handled';
    }
    
    return 'not-handled';
  };
  
  // Toggle block type (e.g., heading, blockquote)
  const toggleBlockType = (blockType: string) => {
    setEditorState(RichUtils.toggleBlockType(editorState, blockType));
  };
  
  // Toggle inline style (e.g., bold, italic)
  const toggleInlineStyle = (inlineStyle: string) => {
    setEditorState(RichUtils.toggleInlineStyle(editorState, inlineStyle));
  };
  
  // Handle note selection
  const handleNoteSelect = (note: Notes) => {
    setSelectedNote(note);
    setViewMode('editor');
  };
  
  // Handle return to list view
  const handleBackToList = () => {
    setSelectedNote(null);
    setViewMode('list');
  };
  
  // Handle save note
  const handleSaveNote = () => {
    const contentState = editorState.getCurrentContent();
    const rawContent = JSON.stringify(convertToRaw(contentState));
    
    // Save to localStorage
    localStorage.setItem(`notes-${documentId}`, rawContent);
    
    // Call onSave if provided
    if (onSave) {
      onSave(rawContent);
    }
  };

  return (
    <div className={`notes-editor h-full flex flex-col ${className}`}>
      {viewMode === 'list' ? (
        <NotesList 
          documentId={documentId}
          onNoteSelect={handleNoteSelect}
          className={className}
          blockSequenceMap={blockSequenceMap}
          refetchTrigger={refetchTrigger}
        />
      ) : (
        <>
          <div className="editor-toolbar p-3 border-b border-neutral-300 bg-neutral-100 flex justify-between items-center">
            <div className="flex space-x-1">
              <button 
                onClick={handleBackToList}
                className="px-3 py-1.5 text-sm rounded bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 flex items-center shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Notes
              </button>
            </div>
            
            <div className="flex">
              <button 
                onClick={handleSaveNote}
                className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 flex items-center shadow-sm transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </button>
            </div>
          </div>

          <div className="text-formatting-toolbar p-2 border-b border-neutral-300 bg-white flex">
            <div className="flex space-x-1 text-neutral-700">
              <button 
                onClick={() => toggleBlockType('header-one')}
                className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-100 font-medium"
              >
                H1
              </button>
              <button 
                onClick={() => toggleBlockType('header-two')}
                className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-100 font-medium"
              >
                H2
              </button>
              <button 
                onClick={() => toggleBlockType('unordered-list-item')}
                className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-100 font-medium"
              >
                • List
              </button>
              <button 
                onClick={() => toggleInlineStyle('BOLD')}
                className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-100 font-bold"
              >
                B
              </button>
              <button 
                onClick={() => toggleInlineStyle('ITALIC')}
                className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-100 italic"
              >
                I
              </button>
              <button 
                onClick={() => toggleInlineStyle('UNDERLINE')}
                className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-100 underline"
              >
                U
              </button>
            </div>
          </div>

          {selectedNote && (
            <div className="px-4 py-2 bg-indigo-50 border-b border-neutral-300 text-sm">
              <span className="font-medium text-indigo-800">Editing note:</span>
              {selectedNote.block_sequence_no !== undefined && (
                <span className="ml-2 bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                  Block {selectedNote.block_sequence_no + 1}
                </span>
              )}
              <span className="mx-2 text-indigo-400">•</span>
              <span className="text-indigo-700">
                Created from message ID: {selectedNote.message_id?.substring(0, 8)}
              </span>
            </div>
          )}
          
          <div className="editor-container p-4 flex-1 overflow-y-auto bg-white border-neutral-300 border-b">
            <Editor
              editorState={editorState}
              onChange={setEditorState}
              handleKeyCommand={handleKeyCommand}
              placeholder={selectedNote ? "Edit this note..." : "Start typing your personal notes here..."}
              spellCheck={true}
            />
            {/* Add custom CSS to fix Draft.js text color issues */}
            <style jsx global>{`
              .public-DraftStyleDefault-block {
                color: #1f2937 !important; /* text-neutral-800 equivalent */
              }
              .public-DraftEditorPlaceholder-root {
                color: #6b7280 !important; /* text-neutral-500 equivalent */
              }
              .public-DraftStyleDefault-block span[data-text="true"] {
                color: #1f2937 !important; /* text-neutral-800 equivalent */
              }
              /* Additional styles for bold, italic, etc. */
              .public-DraftStyleDefault-block span[data-text="true"] strong,
              .public-DraftStyleDefault-block span[data-text="true"] b {
                font-weight: bold; 
                color: #1f2937 !important;
              }
              .public-DraftStyleDefault-block span[data-text="true"] em,
              .public-DraftStyleDefault-block span[data-text="true"] i {
                font-style: italic;
                color: #1f2937 !important;
              }
            `}</style>
          </div>
        </>
      )}
    </div>
  );
}
