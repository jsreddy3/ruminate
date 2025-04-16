from typing import List, Optional, Tuple, Dict
from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message, MessageRole
from src.repositories.interfaces.conversation_repository import ConversationRepository
from src.repositories.interfaces.document_repository import DocumentRepository
from src.models.viewer.block import Block
import uuid
import logging
import re
import yaml
import os
from pathlib import Path
from jinja2 import Template

logger = logging.getLogger(__name__)

class ContextService:
    def __init__(self, 
                 conversation_repository: ConversationRepository,
                 document_repository: DocumentRepository):
        self.conversation_repo = conversation_repository
        self.document_repo = document_repository
        self.prompts = self._load_prompts()
    
    def _load_prompts(self) -> Dict:
        """Load prompt templates from YAML file"""
        try:
            # Path is relative to this file's location
            prompts_path = Path(__file__).parent.parent / "conversation" / "prompts.yaml"
            with open(prompts_path, 'r') as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            logger.error(f"Error loading prompts: {e}")
            return {}  # Return empty dict if file not found or invalid
    
    async def create_system_message(self, 
                                    conversation_id: str, 
                                    template_key: str, 
                                    template_vars: Dict) -> Message:
        """
        Create a system message using a template from prompts.yaml
        Args:
            conversation_id: ID of the conversation
            template_key: Key for the template in prompts.yaml (e.g., 'regular_conversation')
            template_vars: Dictionary of variables to substitute in the template
        Returns:
            System message with populated content
        """
        content = self._render_template(template_key, template_vars)
        
        # Create system message
        system_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role=MessageRole.SYSTEM,
            content=content
        )
        
        return system_msg
    
    def _render_template(self, template_key: str, template_vars: Dict) -> str:
        """Render a template with the provided variables"""
        if not self.prompts:
            logger.warning("No prompts loaded, using fallback message")
            return f"This is a conversation about a document. (Prompts failed to load)"
        
        try:
            # Get the template for the specified key
            template_path = template_key.split('.')
            template = self.prompts
            for key in template_path:
                template = template.get(key, {})
            
            if not template or not isinstance(template, str):
                template = self.prompts.get(template_key, {}).get('system_message', '')
            
            # Render optional sections first
            rendered_sections = {}
            sections = self.prompts.get('sections', {})
            for section_name, section_template in sections.items():
                section_key = f"{section_name}_section"
                # Only include section if all its variables are present
                section_vars = {k: v for k, v in template_vars.items() 
                                if k in section_template and v is not None}
                
                if section_name in template_vars.get('include_sections', []):
                    # Render the section with its variables
                    rendered_section = section_template
                    for var_name, var_value in section_vars.items():
                        rendered_section = rendered_section.replace(f"{{{{ {var_name} }}}}", str(var_value))
                    rendered_sections[section_key] = rendered_section
                else:
                    rendered_sections[section_key] = ""
            
            # Combine template variables with rendered sections
            all_vars = {**template_vars, **rendered_sections}
            
            # Render the main template with all variables
            content = template
            for var_name, var_value in all_vars.items():
                if var_value is not None:
                    content = content.replace(f"{{{{ {var_name} }}}}", str(var_value))
            
            # Remove any unreplaced variable placeholders
            content = re.sub(r'{{.*?}}', '', content)
            
            return content.strip()
        except Exception as e:
            logger.error(f"Template rendering error: {e}")
            return f"This is a conversation about a document. (Template error: {e})"

    def _strip_html(self, html_content: Optional[str]) -> str:
        """Simple text extraction from HTML content"""
        if not html_content:
            return ""
        return re.sub(r'<[^>]+>', ' ', html_content).strip()
    
    async def build_message_context(self, conversation_id: str, new_message: Message, active_thread_ids: List[str], message_limit: int = None) -> List[Message]:
        """
        Build context for LLM by getting the active thread of messages
        If message_limit is provided, only the most recent N non-system messages will be included
        System messages are always included regardless of the limit
        """
        all_messages = await self.conversation_repo.get_messages(conversation_id)
        messages_by_id = {msg.id: msg for msg in all_messages}
        
        # Get all messages from the active thread
        all_context = [messages_by_id[msg_id] for msg_id in active_thread_ids if msg_id in messages_by_id]
        
        # If no limit is set, use all messages
        if message_limit is None:
            context = all_context
        else:
            # Separate system and non-system messages
            system_msgs = [msg for msg in all_context if msg.role == MessageRole.SYSTEM]
            non_system_msgs = [msg for msg in all_context if msg.role != MessageRole.SYSTEM]
            
            # Limit non-system messages to the most recent ones
            limited_non_system = non_system_msgs[-message_limit:] if len(non_system_msgs) > message_limit else non_system_msgs
            
            # Combine system messages with limited non-system messages
            context = system_msgs + limited_non_system
        
        # Add the new message
        context.append(new_message)
        return context
    
    async def enhance_context_with_block(self, 
                                    conversation: Conversation, 
                                    user_msg: Message,
                                    active_thread_ids: List[str],
                                    selected_block_id: Optional[str] = None,
                                    session: Optional[object] = None,
                                    message_limit: int = None) -> Tuple[List[Message], Dict[str, str]]:
        """
        Enhance message context with selected block and page content
        Returns: (enhanced context messages, pages_tracking_info)
        """
        # Build the base message context
        context_messages = await self.build_message_context(conversation.id, user_msg, active_thread_ids, message_limit)
        
        # Track selected block and pages
        selected_block = None
        pages_content = ""
        enhanced_user_content = ""
        
        # Initialize included_pages if not present
        if not hasattr(conversation, 'included_pages') or conversation.included_pages is None:
            conversation.included_pages = {}
            # logger.info(f"Initialized included_pages tracking for conversation {conversation.id}")
        
        # Get selected block content if specified
        if selected_block_id:
            selected_block = await self.document_repo.get_block(selected_block_id, session)
            if selected_block and selected_block.page_number is not None:
                document_id = selected_block.document_id
                current_page_num = selected_block.page_number
                prev_page_num = current_page_num - 1 if current_page_num > 0 else None
                
                # logger.info(f"Selected block is on page {current_page_num} (document: {document_id})")
                
                # Check if current page needs to be included
                if str(current_page_num) not in conversation.included_pages:
                    # logger.info(f"Current page {current_page_num} not yet included in conversation")
                    current_page = await self.document_repo.get_page_by_number(document_id, current_page_num, session)
                    if current_page:
                        current_page_blocks = await self.document_repo.get_page_blocks(current_page.id, session)
                        if current_page_blocks:
                            current_page_text = "\n".join([self._strip_html(block.html_content) for block in current_page_blocks if block.html_content])
                            pages_content += f"Current page (Page {current_page_num + 1}):\n---\n{current_page_text}\n---\n\n"
                            conversation.included_pages[str(current_page_num)] = user_msg.id
                            # logger.info(f"Added page {current_page_num} to included pages")
                
                # Check if previous page needs to be included
                if prev_page_num is not None and str(prev_page_num) not in conversation.included_pages:
                    # logger.info(f"Previous page {prev_page_num} not yet included in conversation")
                    prev_page = await self.document_repo.get_page_by_number(document_id, prev_page_num, session)
                    if prev_page:
                        prev_page_blocks = await self.document_repo.get_page_blocks(prev_page.id, session)
                        if prev_page_blocks:
                            prev_page_text = "\n".join([self._strip_html(block.html_content) for block in prev_page_blocks if block.html_content])
                            pages_content = f"Previous page (Page {prev_page_num + 1}):\n---\n{prev_page_text}\n---\n\n" + pages_content
                            conversation.included_pages[str(prev_page_num)] = user_msg.id
                            # logger.info(f"Added page {prev_page_num} to included pages")
        
        # Add selected block content to user message
        selected_block_text = None
        if selected_block and selected_block.html_content:
            selected_block_text = self._strip_html(selected_block.html_content)
            enhanced_user_content += f"Selected block content:\n---\n{selected_block_text}\n---\n\n"
        
        # Add original user query to user message
        enhanced_user_content += user_msg.content
        
        # Find system message and add page content to it
        if pages_content:
            for i, msg in enumerate(context_messages):
                if msg.role == MessageRole.SYSTEM:
                    # Store original system content
                    original_system = msg.content
                    # Add page content after system instructions
                    msg.content = f"{original_system}\n\nDocument Context:\n{pages_content}"
                    break
        
        # Update user message with block content + query
        enhanced_user_msg = context_messages[-1]  # Last message is the user message
        enhanced_user_msg.content = enhanced_user_content
        
        # Log context information for verification
        # self._log_context_info(conversation.id, conversation.included_pages, selected_block, selected_block_id, context_messages)
        
        return context_messages, conversation.included_pages
    
    def _log_context_info(self, conversation_id, included_pages, selected_block, selected_block_id, context_messages):
        """Log detailed context information for verification"""
        logger.info("---------- CONTEXT VERIFICATION ----------")
        logger.info(f"Conversation ID: {conversation_id}")
        logger.info(f"Included Pages: {included_pages}")
        if selected_block:
            logger.info(f"Selected Block: ID={selected_block_id}, Page={selected_block.page_number}")
        
        # Log the messages being sent to the LLM
        logger.info("Messages being sent to LLM:")
        for i, msg in enumerate(context_messages):
            # Truncate long content for readability in logs
            content_preview = msg.content[:500] + "..." if len(msg.content) > 500 else msg.content
            logger.info(f"  Message {i+1}: Role={msg.role}, Content Preview={content_preview}")
        logger.info("----------------------------------------")

    async def build_agent_system_prompt(self, conversation_id: str, document_id: str, session: Optional[object] = None) -> str:
        """Build the system prompt for the agent.
        
        This handles all template variables and renders the system message.
        """
        # Fetch the conversation to get selected text and other metadata
        conversation = await self.conversation_repo.get_conversation(conversation_id, session)
        
        # Fetch document metadata
        document = await self.document_repo.get_document(document_id, session)
        document_title = document.title if document and hasattr(document, 'title') else "Document"
        
        # Get document summary if available
        document_summary = document.summary if document and hasattr(document, 'summary') else ""
        
        # Prepare template variables
        template_vars = {
            "document_id": document_id,
            "document_title": document_title,
            "selected_text": conversation.selected_text or "",
            "document_summary_section": document_summary or ""
        }
        
        # Get system prompt which now includes instructions
        system_prompt = self.get_agent_system_prompt(template_vars)
        
        return system_prompt
    
    def get_agent_system_prompt(self, template_vars: Dict) -> str:
        """Get the agent system prompt from the prompts.yaml file
        
        Args:
            template_vars: Variables to render in the template (document_title, selected_text, etc.)
            
        Returns:
            Rendered system prompt string
        """
        return self._render_template("agent_rabbithole.system_message", template_vars)
    
    # The get_agent_instructions method has been removed as the instructions are now
    # included directly in the system_message template in prompts.yaml
    
    def get_agent_action_schema(self) -> Dict:
        """Get the agent action schema from the prompts.yaml file
        
        Returns:
            Action schema dictionary
        """
        try:
            schema = self.prompts.get("agent_rabbithole", {}).get("action_schema", {})
            if not schema:
                logger.warning("Agent action schema not found in prompts.yaml, using fallback")
                # Fallback schema
                return {
                    "type": "object",
                    "properties": {
                        "thought": {"type": "string", "description": "The agent's reasoning"},
                        "response_type": {"type": "string", "enum": ["action", "answer"]},
                        "action": {"type": "string", "enum": ["GET_PAGE", "GET_BLOCK"]},
                        "action_input": {"type": "string"},
                        "answer": {"type": "string"}
                    },
                    "required": ["thought", "response_type"],
                    "additionalProperties": False
                }
            return schema
        except Exception as e:
            logger.error(f"Error getting agent action schema: {e}")
            # Fallback schema
            return {
                "type": "object",
                "properties": {
                    "thought": {"type": "string"},
                    "response_type": {"type": "string", "enum": ["action", "answer"]},
                    "action": {"type": "string", "enum": ["GET_PAGE", "GET_BLOCK"]},
                    "action_input": {"type": "string"},
                    "answer": {"type": "string"}
                },
                "required": ["thought", "response_type"],
                "additionalProperties": False
            }

    def get_final_iteration_message(self, template_vars: Dict) -> str:
        """Get the final iteration message template from prompts.yaml and render it
        
        Args:
            template_vars: Variables to use in template rendering
                
        Returns:
            Rendered final iteration message
        """
        try:
            template = self.prompts.get("agent_rabbithole", {}).get("final_iteration_message", "")
            return Template(template).render(**template_vars)
        except Exception as e:
            logger.error(f"Error rendering final iteration message: {e}")
            return "Please provide your final answer based on all information gathered."
    
    def get_final_iteration_schema(self) -> Dict:
        """Get the final iteration schema from the prompts.yaml file
        
        Returns:
            Final iteration schema dictionary
        """
        try:
            schema = self.prompts.get("agent_rabbithole", {}).get("final_iteration_schema", {})
            if not schema:
                logger.warning("Final iteration schema not found in prompts.yaml, using fallback")
                # Fallback schema
                return {
                    "type": "object",
                    "properties": {
                        "answer": {"type": "string", "description": "Your final answer"}
                    },
                    "required": ["answer"],
                    "additionalProperties": False
                }
            return schema
        except Exception as e:
            logger.error(f"Error getting final iteration schema: {e}")
            # Fallback schema
            return {
                "type": "object",
                "properties": {
                    "answer": {"type": "string"}
                },
                "required": ["answer"],
                "additionalProperties": False
            }
            
    async def enhance_context_for_note_generation(self,
                                         conversation: Conversation,
                                         message_id: str,
                                         session: Optional[object] = None) -> Tuple[List[Message], Dict[str, str]]:
        """Enhance context for note generation based on a conversation and a specific message
        
        Args:
            conversation: The conversation object
            message_id: ID of the message to truncate the conversation at
            session: Optional database session
            
        Returns:
            Tuple of (enhanced context messages, conversation.included_pages)
        """
        # Get the active thread of messages
        all_messages = await self.conversation_repo.get_active_thread(conversation.id, session)
        
        # Truncate at the specified message ID
        messages = []
        for message in all_messages:
            messages.append(message)
            if message.id == message_id:
                break
        
        if not messages or messages[-1].id != message_id:
            logger.error(f"Message {message_id} not found in active thread of conversation {conversation.id}")
            raise ValueError(f"Message {message_id} not found in active thread of conversation {conversation.id}")
            
        # Initialize the return value for included_pages tracking
        included_pages = conversation.included_pages or {}
        
        # Get document information
        document = await self.document_repo.get_document(conversation.document_id, session)
        if not document:
            logger.error(f"Document {conversation.document_id} not found")
            raise ValueError(f"Document {conversation.document_id} not found")
            
        # Filter out system messages for the conversation context
        conversation_messages = [msg for msg in messages if msg.role != MessageRole.SYSTEM]
        
        # Create system message with the appropriate template for the conversation type
        template_vars = {
            "document_title": document.title or "Untitled Document",
            "include_sections": []
        }
        
        # Include document summary if available
        if document.summary:
            template_vars["document_summary"] = document.summary
            template_vars["include_sections"].append("document_summary")
        
        # Create the system message 
        system_msg = await self.create_system_message(
            conversation.id, 
            "regular_conversation.system_message", 
            template_vars
        )
        
        # Get the note generation request prompt from prompts.yaml
        note_request_content = self.prompts.get("note_generation", {}).get("user_message", "")
        if not note_request_content:
            # Fallback if not found
            note_request_content = ("Based on our conversation about this document and content, "
                                  "can you create a concise, well-structured note summarizing the "
                                  "key insights and information we've discussed?")
        
        # Build the enhanced context
        result = [system_msg] + conversation_messages
        
        # Return the context and tracking info
        return result, included_pages