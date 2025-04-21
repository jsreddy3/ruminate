# PDF Viewer Teardown

This document outlines the simplification of the PDF Viewer interface by removing all chat functionality.

## Components Removed

- All chat-related components (`ChatPane`, `InteractivePane`, etc.)
- Conversation handling and state management
- Message tree utilities
- Rabbit hole functionality
- Block navigation systems

## Current Functionality

The current PDF Viewer supports:

1. **PDF Rendering**: Standard PDF viewing with zoom, page navigation and search
2. **Block Selection**: Support for selecting and viewing information about blocks
3. **Notes**: Basic notes functionality remains without chat integration

## File Changes

- `PDFViewer.tsx`: Completely rebuilt to focus solely on PDF viewing
- Removed dependencies on chat components and APIs
- Simplified block handling logic

## Rebuilding Plan

To rebuild the chat functionality with a better architecture:

1. Create a dedicated chat module with clear responsibilities
2. Implement a centralized state management system
3. Separate PDF viewing from chat functionality
4. Build a more maintainable component structure

## Next Steps

1. Define new chat architecture with clear boundaries
2. Implement chat components one by one with proper testing
3. Integrate with PDF viewing functionality as needed
4. Ensure proper separation of concerns throughout 