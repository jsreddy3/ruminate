import asyncio
import json
from typing import Dict, Any, List, Set, Optional
import logging

logger = logging.getLogger(__name__)

class SSEManager:
    """
    Server-Sent Events manager to handle real-time communication with clients.
    Manages client connections and sending events for specific conversations.
    """
    
    def __init__(self):
        self.clients: Dict[str, Set[Any]] = {}  # conversation_id -> set of clients
        logger.debug("SSEManager initialized")
        
    async def register_client(self, conversation_id: str, client: Any) -> None:
        """Register a client for SSE events for a specific conversation"""
        if conversation_id not in self.clients:
            self.clients[conversation_id] = set()
        self.clients[conversation_id].add(client)
        logger.info(f"Registered client for conversation {conversation_id}")
        
    async def unregister_client(self, conversation_id: str, client: Any) -> None:
        """Unregister a client from SSE events"""
        if conversation_id in self.clients and client in self.clients[conversation_id]:
            self.clients[conversation_id].remove(client)
            if not self.clients[conversation_id]:
                del self.clients[conversation_id]
            logger.info(f"Unregistered client for conversation {conversation_id}")
            
    async def send_event(self, conversation_id: str, event_type: str, data: Any) -> None:
        """Send an SSE event to all clients for a conversation"""
        if conversation_id not in self.clients:
            return
            
        message = self._format_sse_message(event_type, data)
        failed_clients = set()
        
        for client in self.clients[conversation_id]:
            try:
                await client.send(message)
            except Exception as e:
                logger.error(f"Error sending SSE to client: {e}")
                failed_clients.add(client)
                
        # Clean up failed clients
        for failed_client in failed_clients:
            await self.unregister_client(conversation_id, failed_client)
            
    def _format_sse_message(self, event_type: str, data: Any) -> str:
        """Format an SSE message according to the spec"""
        json_data = json.dumps(data)
        return f"event: {event_type}\ndata: {json_data}\n\n"
        
    async def broadcast_event(self, event_type: str, data: Any) -> None:
        """Broadcast an event to all clients across all conversations"""
        message = self._format_sse_message(event_type, data)
        failed_clients = []
        
        for conversation_id, clients in self.clients.items():
            for client in clients:
                try:
                    await client.send(message)
                except Exception as e:
                    logger.error(f"Error broadcasting SSE to client: {e}")
                    failed_clients.append((conversation_id, client))
                    
        # Clean up failed clients
        for conversation_id, client in failed_clients:
            await self.unregister_client(conversation_id, client)
            
    def get_active_clients_count(self) -> int:
        """Get the total number of active clients"""
        return sum(len(clients) for clients in self.clients.values())
        
    def get_active_conversations_count(self) -> int:
        """Get the number of active conversations with clients"""
        return len(self.clients)