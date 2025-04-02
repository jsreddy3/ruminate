import React from 'react';
import type { Message } from '../../types/chat';

interface TreeVisualizerProps {
  messageTree: Message[];
  displayedThread: Message[];
}

// Constants for tree layout
const NODE_RADIUS = 6;
const LEVEL_HEIGHT = 40;
const HORIZONTAL_SPACING = 30;

interface LayoutNode {
  x: number;
  y: number;
  message: Message;
  isActive: boolean;
}

// Helper function for laying out nodes
const layoutTreeNodes = (
  message: Message,
  displayedThread: Message[],
  level: number = 0,
  offsetX: number = 0
): { 
  nodes: LayoutNode[];
  width: number;
} => {
  const nodes: LayoutNode[] = [];
  const isActive = displayedThread.some(m => m.id === message.id);
  
  nodes.push({
    x: offsetX,
    y: level * LEVEL_HEIGHT,
    message,
    isActive
  });
  
  let totalChildrenWidth = 0;
  const childLayouts = message.children.map((child, index) => {
    const layout = layoutTreeNodes(
      child,
      displayedThread,
      level + 1,
      offsetX + totalChildrenWidth
    );
    totalChildrenWidth += layout.width + (index > 0 ? HORIZONTAL_SPACING : 0);
    return layout;
  });
  
  childLayouts.forEach(layout => {
    nodes.push(...layout.nodes);
  });
  
  return {
    nodes,
    width: Math.max(NODE_RADIUS * 2, totalChildrenWidth)
  };
};

export default function TreeVisualizer({ messageTree, displayedThread }: TreeVisualizerProps) {
  if (messageTree.length === 0) return null;

  const { nodes } = layoutTreeNodes(messageTree[0], displayedThread);
  const maxY = Math.max(...nodes.map(n => n.y)) + NODE_RADIUS * 2;
  const processedConnections = new Set<string>();

  return (
    <div className="p-4 border-b border-neutral-200 bg-white">
      <svg width="100%" height={maxY + 20} style={{ maxHeight: "200px" }}>
        <g transform={`translate(${NODE_RADIUS}, ${NODE_RADIUS})`}>
          {/* Draw lines between nodes */}
          {nodes.map(node => 
            node.message.children.map(child => {
              const childNode = nodes.find(n => n.message.id === child.id);
              if (!childNode || !node.message.id || !child.id) return null;
              
              const connectionId = `${node.message.id}-${child.id}`;
              if (processedConnections.has(connectionId)) return null;
              processedConnections.add(connectionId);
              
              const isActivePath = node.isActive && childNode.isActive;
              
              return (
                <line
                  key={connectionId}
                  x1={node.x}
                  y1={node.y}
                  x2={childNode.x}
                  y2={childNode.y}
                  stroke={isActivePath ? "#4f46e5" : "#e5e7eb"}
                  strokeWidth={isActivePath ? 2 : 1}
                />
              );
            })
          )}
          
          {/* Draw nodes */}
          {nodes.map(node => (
            <circle
              key={`node-${node.message.id}`}
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              fill={
                node.message.role === "system" ? "#9ca3af" : 
                node.message.role === "user" ? "#4f46e5" :
                node.message.role === "assistant" ? "#10b981" :
                "#10b981"
              }
              stroke={node.isActive ? "#4f46e5" : "none"}
              strokeWidth={2}
              opacity={node.isActive ? 1 : 0.5}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}