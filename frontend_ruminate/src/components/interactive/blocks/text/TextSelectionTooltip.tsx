interface TextSelectionTooltipProps {
  documentId: string;
  blockId: string;
  onLaunchAgentChat?: (selectedText: string, startOffset: number, endOffset: number) => void;
}

const handleAgentChatClick = () => {
  if (onLaunchAgentChat && selection) {
    const selectedText = selection.toString();
    onLaunchAgentChat(selectedText, selectionStart, selectionEnd);
  }
  clearSelection();
}; 