import { Message } from "../types/chat";

// utils/applyOptimisticEdit.ts
export function applyOptimisticEdit(
  messageId: string,
  newContent: string,
  messageTree: Message[],
  messagesById: Map<string, Message>,
  displayedThread: Message[],            // ← extra param
) {
  // ensure the original message is in the map
  let original = messagesById.get(messageId);
  if (!original) {
    original = displayedThread.find(m => m.id === messageId);
    if (!original) {
      // now we really have a problem – bail out gracefully
      console.warn(`applyOptimisticEdit: message ${messageId} missing`);
      return null;
    }
    messagesById = new Map(messagesById).set(messageId, original);
  }

  // pick a parent (fallback = root system node)
  const parent =
    (original.parent_id && messagesById.get(original.parent_id)) ||
    messageTree[0];

  if (!parent) {
    console.warn(
      `applyOptimisticEdit: no parent found for message ${messageId}`,
    );
    return null;
  }

  /* build the optimistic edit exactly like before … */
  const tempId = `temp-edit-${Date.now()}`;
  const edited: Message = {
    id: tempId,
    role: "user",
    content: newContent,
    parent_id: parent.id,
    children: [],
    active_child_id: null,
    created_at: new Date().toISOString(),
  };

  const parentCopy = {
    ...parent,
    active_child_id: tempId,
    children: [...parent.children, edited],
  };

  const newMap = new Map(messagesById)
    .set(parentCopy.id, parentCopy)
    .set(tempId, edited);

  return { tempId, newMap };
}
