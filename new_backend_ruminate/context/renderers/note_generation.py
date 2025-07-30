# new_backend_ruminate/context/renderers/note_generation.py

from typing import List, Optional, Dict, Any
import re
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.domain.document.entities import Document, Block


class NoteGenerationContext:
    """Context builder specifically for note generation from conversations"""
    
    def build_context(
        self,
        document: Document,
        block: Block,
        conversation_messages: List[Message],
        topic: Optional[str] = None,
        user_id: str = ""
    ) -> List[Message]:
        """
        Build context messages for note generation.
        
        Returns a list of Message objects formatted for LLM consumption.
        """
        # Extract block content if available
        block_content = ""
        if block.html_content:
            block_content = re.sub('<.*?>', '', block.html_content)[:500]
        
        # Build system prompt
        system_prompt = self._build_system_prompt(
            document=document,
            block_content=block_content,
            topic=topic
        )
        
        # Build user prompt with conversation
        user_prompt = self._build_user_prompt(
            conversation_messages=conversation_messages,
            topic=topic
        )
        
        # Return messages in format expected by LLM
        return [
            Message(
                id="sys",
                conversation_id="note_gen",
                parent_id=None,
                role=Role.SYSTEM,
                content=system_prompt,
                user_id=user_id,
                version=0
            ),
            Message(
                id="usr",
                conversation_id="note_gen",
                parent_id="sys",
                role=Role.USER,
                content=user_prompt,
                user_id=user_id,
                version=0
            )
        ]
    
    def _build_system_prompt(
        self,
        document: Document,
        block_content: str,
        topic: Optional[str]
    ) -> str:
        """Build the system prompt for note generation"""
        return f"""You are a helpful assistant that creates concise, insightful notes from conversations.
You are creating a note about a conversation that took place while reading a document titled: "{document.title}"
{f'Document summary: {document.summary}' if document.summary else ''}
{f'The conversation is focused on the topic: {topic}' if topic else ''}

The note will be attached to this specific text from the document:
```
{block_content}
```

Your task is to create an information-dense, concise, highly informative, useful note. There should
be no generic humanities filler -- there should be precise, useful, and concise information. NEVER blab.
Never use long paragraphs, diagrams, or tables."""
    
    def _build_user_prompt(
        self,
        conversation_messages: List[Message],
        topic: Optional[str]
    ) -> str:
        """Build the user prompt with conversation content"""
        # Format conversation for the prompt
        conversation_text = []
        for msg in conversation_messages:
            role_name = "User" if msg.role == Role.USER else "Assistant"
            conversation_text.append(f"{role_name}: {msg.content}")
        
        return f"""Please create a note summarizing this conversation:

{chr(10).join(conversation_text)}

{f'Focus particularly on aspects related to: {topic}' if topic else ''}

Remember to make the note self-contained and useful for future reference."""