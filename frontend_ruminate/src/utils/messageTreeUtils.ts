import type { Message } from "../types/chat";

export const getActiveThread = (root: Message, messageMap: Map<string, Message>): Message[] => {
  const thread: Message[] = [root];
  let currentMessage = root;

  while (currentMessage.active_child_id) {
    const activeChild = messageMap.get(currentMessage.active_child_id);
    if (!activeChild) {
      console.error(`Could not find active child ${currentMessage.active_child_id} in messageMap`);
      console.log('Current messageMap keys:', Array.from(messageMap.keys()));
      break;
    }
    
    thread.push(activeChild);
    currentMessage = activeChild;
  }

  return thread;
};

export const buildMessageTree = (messages: any[]): { 
  tree: Message[]; 
  messageMap: Map<string, Message> 
} => {
  const messageMap = new Map(
    messages.map(m => [
      m.id,
      {
        ...m,
        children: [],
        created_at: m.created_at || new Date().toISOString()
      }
    ])
  );

  messages.forEach(m => {
    const message = messageMap.get(m.id)!;
    if (m.parent_id && messageMap.has(m.parent_id)) {
      const parent = messageMap.get(m.parent_id)!;
      parent.children.push(message);
    }
  });

  const root = Array.from(messageMap.values()).find(
    m => m.role === "system" && !m.parent_id
  );

  if (!root) {
    console.error("No system message found in conversation");
    return { tree: [], messageMap };
  }

  return { tree: [root], messageMap };
};