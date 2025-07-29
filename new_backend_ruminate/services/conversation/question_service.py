# new_backend_ruminate/services/conversation/question_service.py
"""
Service for generating contextual questions about documents.
Integrates with the conversation creation flow to provide suggested questions.
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.context.question_generation_builder import QuestionGenerationContextBuilder
from new_backend_ruminate.domain.conversation.entities.question import ConversationQuestion
from new_backend_ruminate.domain.conversation.repo import ConversationRepository
from new_backend_ruminate.domain.ports.llm import LLMService
from new_backend_ruminate.infrastructure.db.bootstrap import session_scope


class QuestionGenerationService:
    """
    Service for generating contextual questions when conversations are created.
    
    This service:
    1. Builds document context using QuestionGenerationContextBuilder
    2. Uses LLM to generate relevant questions
    3. Stores questions in the database
    4. Provides questions to the frontend for user interaction
    """
    
    def __init__(
        self,
        conversation_repo: ConversationRepository,
        document_repo,
        llm: LLMService,
        context_builder: QuestionGenerationContextBuilder
    ):
        self.conversation_repo = conversation_repo
        self.document_repo = document_repo
        self.llm = llm
        self.context_builder = context_builder
    
    async def generate_questions_for_conversation(
        self,
        conversation_id: str,
        document_id: str,
        current_page: Optional[int] = None,
        question_count: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Generate contextual questions for a newly created conversation.
        
        Args:
            conversation_id: ID of the conversation
            document_id: ID of the document being discussed
            current_page: Current page user is viewing (optional)
            question_count: Number of questions to generate
            
        Returns:
            List of generated questions with metadata
        """
        
        async with session_scope() as session:
            # Build context for question generation
            context = await self.context_builder.build_document_context(
                document_id=document_id,
                current_page=current_page,
                context_window=2,
                session=session
            )
            
            # Generate questions using LLM
            llm_context = self.context_builder.format_for_llm(context)
            questions_data = await self._generate_questions_with_llm(
                llm_context, question_count
            )
            
            # Store questions in database
            question_entities = []
            for i, q_data in enumerate(questions_data):
                question = ConversationQuestion(
                    conversation_id=conversation_id,
                    question_text=q_data["question"],
                    source_page_numbers=context["current_focus"]["page_number"] and [context["current_focus"]["page_number"]] or None,
                    source_block_ids=None,  # Could be enhanced to track specific blocks
                    display_order=i,
                    generation_context={
                        "document_id": document_id,
                        "current_page": current_page,
                        "generation_method": "llm_contextual",
                        "context_pages": len(context["content_sections"])
                    }
                )
                question_entities.append(question)
            
            # Save to database
            await self._save_questions(question_entities, session)
            
            # Return formatted questions for API response
            return [
                {
                    "id": q.id,
                    "question": q.question_text,
                    "order": q.display_order
                }
                for q in question_entities
            ]
    
    async def _generate_questions_with_llm(
        self, 
        context: str, 
        question_count: int
    ) -> List[Dict[str, Any]]:
        """
        Use LLM to generate contextual questions based on document content.
        Uses structured response for reliable JSON parsing.
        """
        
        # Craft prompt for question generation
        prompt = self._build_question_generation_prompt(context, question_count)
        
        # Define the structured response schema
        response_schema = {
            "type": "object",
            "properties": {
                "questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": {"type": "string"}
                        },
                        "required": ["question"]
                    }
                }
            },
            "required": ["questions"]
        }
        
        # Convert prompt to message format and call LLM with structured response
        try:
            from new_backend_ruminate.domain.conversation.entities.message import Message, Role
            
            messages = [
                Message(
                    id="prompt",
                    conversation_id="question_gen",
                    parent_id=None,
                    role=Role.USER,
                    content=prompt,
                    user_id="system",
                    version=0
                )
            ]
            
            response = await self.llm.generate_structured_response(
                messages,
                response_format={"type": "json_object"},
                json_schema=response_schema,
                model="gpt-4o-mini"  # Use cheap model for question generation
            )
            
            questions = response.get("questions", [])
            
            # Ensure we have the right number of questions
            if len(questions) < question_count:
                questions.extend(self._generate_fallback_questions(question_count - len(questions)))
            
            return questions[:question_count]
            
        except Exception as e:
            print(f"Error generating questions with LLM: {e}")
            # Fallback to template-based questions
            return self._generate_fallback_questions(question_count)
    
    def _build_question_generation_prompt(self, context: str, count: int) -> str:
        """
        Build the prompt for LLM question generation.
        """
        prompt = f"""Based on the following document content, generate {count} concise, engaging questions that would help a reader explore and understand the material better.

Document Context:
{context}

Requirements for questions:
1. Keep each question concise (ideally 5-12 words) - they will be displayed as clickable buttons in the UI
2. Make them specific to the actual content provided
3. Focus on guiding the user to understand highly specific details about the referenced text.

The response will be structured JSON that I can parse reliably.

Generate {count} questions now:"""
        
        return prompt
    
    def _parse_llm_questions_response(self, response: str) -> List[Dict[str, Any]]:
        """
        Parse the LLM response to extract questions.
        """
        import json
        import re
        
        try:
            # Try to extract JSON from the response
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                questions_data = json.loads(json_str)
                
                # Validate and clean the questions
                valid_questions = []
                
                for q in questions_data:
                    if isinstance(q, dict) and "question" in q:
                        valid_questions.append({
                            "question": q["question"].strip(),
                        })
                
                return valid_questions
                
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"Error parsing LLM response: {e}")
        
        # Fallback: try to extract questions from plain text
        return self._extract_questions_from_text(response)
    
    def _extract_questions_from_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Extract questions from plain text response as fallback.
        """
        import re
        
        # Look for lines that end with question marks
        question_lines = re.findall(r'^.*\?$', text, re.MULTILINE)
        
        questions = []
        for line in question_lines:
            clean_question = line.strip()
            if len(clean_question) > 10:  # Filter out very short questions
                questions.append({
                    "question": clean_question,
                })
        
        return questions
    
    def _generate_fallback_questions(self, count: int) -> List[Dict[str, Any]]:
        """
        Generate template-based fallback questions when LLM fails.
        """
        fallback_templates = [
            {"question": "What are the main concepts discussed in this section?"},
            {"question": "How do the ideas in this document relate to each other?"},
            {"question": "What connections can you draw between different sections?"},
        ]
        
        return fallback_templates[:count]
    
    async def _save_questions(
        self, 
        questions: List[ConversationQuestion], 
        session: AsyncSession
    ) -> None:
        """
        Save generated questions to the database.
        """
        for question in questions:
            session.add(question)
        
        await session.commit()
    
    async def get_questions_for_conversation(
        self, 
        conversation_id: str
    ) -> List[Dict[str, Any]]:
        """
        Retrieve stored questions for a conversation.
        Only returns unused questions, limited to 3.
        """
        async with session_scope() as session:
            # Query questions using the repository pattern
            # This would need to be implemented in the conversation repository
            questions = await self.conversation_repo.get_conversation_questions(
                conversation_id, session
            )
            
            # Filter unused questions and limit to 3
            unused_questions = [q for q in questions if not q.is_used][:3]
            
            return [
                {
                    "id": q.id,
                    "question": q.question_text,
                    "order": q.display_order
                }
                for q in unused_questions
            ]
    
    async def regenerate_questions(
        self,
        conversation_id: str,
        document_id: str,
        current_page: Optional[int] = None,
        question_count: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Regenerate questions for an existing conversation.
        Useful if user wants fresh questions or moves to a different page.
        """
        async with session_scope() as session:
            # Delete existing questions
            await self.conversation_repo.delete_conversation_questions(
                conversation_id, session
            )
            
            # Generate new questions
            return await self.generate_questions_for_conversation(
                conversation_id, document_id, current_page, question_count
            )
    
    async def mark_question_as_used(self, question_id: str) -> None:
        """
        Mark a question as used when it's clicked/sent.
        """
        from datetime import datetime
        
        async with session_scope() as session:
            # This would need to be implemented in the conversation repository
            await self.conversation_repo.mark_question_as_used(
                question_id, datetime.utcnow(), session
            )