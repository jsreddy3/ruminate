# tests/test_question_service.py
"""
Unit tests for the question generation service.
Tests both mocked and real LLM functionality following established patterns.
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.services.conversation.question_service import QuestionGenerationService
from new_backend_ruminate.context.question_generation_builder import QuestionGenerationContextBuilder
from new_backend_ruminate.domain.conversation.entities.question import ConversationQuestion
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.infrastructure.document.models import DocumentModel, BlockModel, PageModel
from new_backend_ruminate.tests.stubs import StubLLM


@pytest.fixture
def mock_conversation_repo():
    """Mock conversation repository with common operations."""
    repo = AsyncMock()
    repo.get_conversation_questions.return_value = []
    repo.delete_conversation_questions.return_value = None
    return repo


@pytest.fixture  
def mock_document_repo():
    """Mock document repository with sample data."""
    repo = AsyncMock()
    
    # Sample document
    sample_doc = DocumentModel(
        id="doc-123",
        title="Introduction to Machine Learning",
        status="READY"
    )
    repo.get_document.return_value = sample_doc
    
    # Sample pages
    sample_pages = [
        PageModel(id="page-1", document_id="doc-123", page_number=1),
        PageModel(id="page-2", document_id="doc-123", page_number=2),
        PageModel(id="page-3", document_id="doc-123", page_number=3),
    ]
    repo.get_pages_by_document.return_value = sample_pages
    
    # Sample blocks
    sample_blocks = [
        BlockModel(
            id="block-1",
            document_id="doc-123", 
            page_number=1,
            block_type="heading",
            html_content="<h1>Introduction to Neural Networks</h1>"
        ),
        BlockModel(
            id="block-2",
            document_id="doc-123",
            page_number=1, 
            block_type="text",
            html_content="<p>Neural networks are computational models inspired by biological neural networks.</p>"
        ),
    ]
    repo.get_blocks_by_page.return_value = sample_blocks
    
    return repo


@pytest.fixture
def mock_llm_service():
    """Mock LLM service that returns structured responses."""
    llm = AsyncMock()
    
    # Default structured response
    llm.generate_structured_response.return_value = {
        "questions": [
            {"question": "What are neural networks?", "type": "COMPREHENSION"},
            {"question": "How do neural networks learn?", "type": "ANALYSIS"},
            {"question": "When would you use neural networks?", "type": "APPLICATION"}
        ]
    }
    
    return llm


@pytest.fixture
def context_builder(mock_document_repo):
    """Context builder with mocked repository."""
    return QuestionGenerationContextBuilder(mock_document_repo)


@pytest.fixture
def question_service(mock_conversation_repo, mock_document_repo, mock_llm_service, context_builder):
    """Question generation service with all dependencies mocked."""
    return QuestionGenerationService(
        conversation_repo=mock_conversation_repo,
        document_repo=mock_document_repo,
        llm=mock_llm_service,
        context_builder=context_builder
    )


class TestQuestionGenerationService:
    """Test the question generation service with various scenarios."""
    
    @pytest.mark.asyncio
    async def test_generate_questions_for_conversation_success(self, question_service, mock_llm_service):
        """Test successful question generation with mocked LLM."""
        
        # Execute
        with patch('new_backend_ruminate.services.conversation.question_service.session_scope') as mock_session:
            # Mock session context manager
            mock_db_session = AsyncMock()
            mock_session.return_value.__aenter__.return_value = mock_db_session
            mock_session.return_value.__aexit__.return_value = None
            
            questions = await question_service.generate_questions_for_conversation(
                conversation_id="conv-123",
                document_id="doc-123",
                current_page=1,
                question_count=3
            )
        
        # Verify LLM was called with correct parameters
        mock_llm_service.generate_structured_response.assert_called_once()
        call_args = mock_llm_service.generate_structured_response.call_args
        
        assert "gpt-4o-mini" == call_args.kwargs["model"]
        assert "json_schema" in call_args.kwargs
        assert len(call_args.args) > 0  # Messages passed as first argument
        
        # Verify response format
        assert len(questions) == 3
        assert questions[0]["question"] == "What are neural networks?"
        assert questions[0]["type"] == "COMPREHENSION"
        assert "id" in questions[0]
        assert "order" in questions[0]
        
        # Verify database operations
        assert mock_db_session.add.call_count == 3  # 3 questions added
        mock_db_session.commit.assert_called_once()
    
    @pytest.mark.asyncio 
    async def test_generate_questions_with_llm_failure_uses_fallback(self, question_service, mock_llm_service):
        """Test that fallback questions are used when LLM fails."""
        
        # Setup LLM to fail
        mock_llm_service.generate_structured_response.side_effect = Exception("LLM API error")
        
        with patch('new_backend_ruminate.services.conversation.question_service.session_scope') as mock_session:
            mock_db_session = AsyncMock()
            mock_session.return_value.__aenter__.return_value = mock_db_session
            mock_session.return_value.__aexit__.return_value = None
            
            questions = await question_service.generate_questions_for_conversation(
                conversation_id="conv-123",
                document_id="doc-123",
                question_count=3
            )
        
        # Verify fallback questions were generated
        assert len(questions) == 3
        assert "main concepts" in questions[0]["question"].lower()
        assert questions[0]["type"] == "COMPREHENSION"
    
    @pytest.mark.asyncio
    async def test_context_builder_builds_correct_structure(self, context_builder):
        """Test that context builder creates proper structure for LLM."""
        
        # Don't need to patch session_scope since we're passing session directly
        mock_db_session = AsyncMock()
        
        context = await context_builder.build_document_context(
            document_id="doc-123",
            current_page=1,
            session=mock_db_session
        )
        
        # Verify context structure
        assert "document" in context
        assert "current_focus" in context
        assert "content_sections" in context
        assert "document_structure" in context
        assert "key_topics" in context
        
        # Verify document info
        assert context["document"]["title"] == "Introduction to Machine Learning"
        assert context["current_focus"]["page_number"] == 1
        assert context["current_focus"]["is_specific_page"] is True
    
    @pytest.mark.asyncio
    async def test_prompt_generation_includes_ui_requirements(self, question_service):
        """Test that generated prompt includes UI-specific requirements."""
        
        context = "Sample document context about machine learning."
        prompt = question_service._build_question_generation_prompt(context, 3)
        
        # Verify UI requirements in prompt
        assert "concise" in prompt.lower()
        assert "8-15 words" in prompt
        assert "clickable buttons" in prompt
        assert "ui" in prompt.lower()
        assert "gpt-4o-mini" not in prompt  # Model specified in API call, not prompt
    
    @pytest.mark.asyncio
    async def test_fallback_questions_generation(self, question_service):
        """Test fallback question generation when LLM fails."""
        
        fallback_questions = question_service._generate_fallback_questions(5)
        
        assert len(fallback_questions) == 5
        assert all("question" in q for q in fallback_questions)
        assert all("type" in q for q in fallback_questions)
        assert all(q["type"] in ["COMPREHENSION", "ANALYSIS", "EVALUATION", "APPLICATION", "SYNTHESIS"] 
                  for q in fallback_questions)
    
    @pytest.mark.asyncio
    async def test_get_questions_for_conversation(self, question_service, mock_conversation_repo):
        """Test retrieving stored questions for a conversation."""
        
        # Setup mock questions
        mock_questions = [
            ConversationQuestion(
                id="q1",
                conversation_id="conv-123",
                question_text="What is machine learning?",
                question_type="COMPREHENSION",
                display_order=0
            ),
            ConversationQuestion(
                id="q2", 
                conversation_id="conv-123",
                question_text="How does training work?",
                question_type="ANALYSIS",
                display_order=1
            )
        ]
        mock_conversation_repo.get_conversation_questions.return_value = mock_questions
        
        with patch('new_backend_ruminate.services.conversation.question_service.session_scope') as mock_session:
            mock_db_session = AsyncMock()
            mock_session.return_value.__aenter__.return_value = mock_db_session
            mock_session.return_value.__aexit__.return_value = None
            
            questions = await question_service.get_questions_for_conversation("conv-123")
        
        # Verify results
        assert len(questions) == 2
        assert questions[0]["question"] == "What is machine learning?"
        assert questions[1]["type"] == "ANALYSIS"
        
        mock_conversation_repo.get_conversation_questions.assert_called_once_with("conv-123", mock_db_session)


class TestQuestionServiceWithRealLLM:
    """Integration tests using real LLM service (StubLLM from stubs.py)."""
    
    @pytest.fixture
    def real_llm_service(self):
        """Use the stub LLM implementation for integration testing."""
        return StubLLM()
    
    @pytest.fixture
    def integration_service(self, mock_conversation_repo, mock_document_repo, real_llm_service, context_builder):
        """Service with real LLM for integration testing."""
        return QuestionGenerationService(
            conversation_repo=mock_conversation_repo,
            document_repo=mock_document_repo, 
            llm=real_llm_service,
            context_builder=context_builder
        )
    
    @pytest.mark.asyncio
    async def test_end_to_end_question_generation(self, integration_service):
        """Test complete workflow with stub LLM."""
        
        # Note: StubLLM doesn't implement generate_structured_response
        # So this will fall back to template questions, which is good to test
        
        with patch('new_backend_ruminate.services.conversation.question_service.session_scope') as mock_session:
            mock_db_session = AsyncMock()
            mock_session.return_value.__aenter__.return_value = mock_db_session
            mock_session.return_value.__aexit__.return_value = None
            
            questions = await integration_service.generate_questions_for_conversation(
                conversation_id="conv-456",
                document_id="doc-456",
                current_page=2,
                question_count=4
            )
        
        # With StubLLM, this should fall back to template questions
        assert len(questions) == 4
        assert all("question" in q for q in questions)
        assert all("type" in q for q in questions)
        
        # Verify database interactions happened
        assert mock_db_session.add.call_count == 4
        mock_db_session.commit.assert_called_once()


class TestQuestionContextBuilder:
    """Test the context builder separately for detailed coverage."""
    
    @pytest.mark.asyncio
    async def test_format_for_llm_creates_proper_prompt(self, context_builder):
        """Test that context is formatted properly for LLM consumption."""
        
        sample_context = {
            "document": {
                "title": "AI Research Paper",
                "document_type": "academic",
                "total_pages": 10
            },
            "current_focus": {
                "page_number": 3,
                "is_specific_page": True
            },
            "content_sections": [
                {
                    "page_number": 3,
                    "text_content": "This section discusses neural network architectures...",
                    "has_figures": True,
                    "has_tables": False
                }
            ],
            "document_structure": {
                "block_type_distribution": {"text": 15, "heading": 3, "figure": 2}
            },
            "key_topics": ["Neural Networks", "Deep Learning", "Backpropagation"]
        }
        
        formatted = context_builder.format_for_llm(sample_context)
        
        # Verify key elements are included
        assert "AI Research Paper" in formatted
        assert "Page 3" in formatted
        assert "Neural Networks" in formatted
        assert "text, heading, figure" in formatted
        assert "neural network architectures" in formatted
    
    def test_select_context_pages_with_current_page(self, context_builder):
        """Test page selection when current page is specified."""
        
        # Create sample pages
        pages = [PageModel(id=f"p{i}", page_number=i, document_id="doc") for i in range(1, 11)]
        
        # Test middle page selection
        selected = context_builder._select_context_pages(pages, current_page=5, context_window=2)
        page_numbers = [p.page_number for p in selected]
        
        assert page_numbers == [3, 4, 5, 6, 7]  # 5 ± 2
    
    def test_select_context_pages_without_current_page(self, context_builder):
        """Test page sampling when no specific page is given."""
        
        pages = [PageModel(id=f"p{i}", page_number=i, document_id="doc") for i in range(1, 11)]
        
        selected = context_builder._select_context_pages(pages, current_page=None, context_window=2)
        
        # Should sample beginning, middle, and end
        assert len(selected) == 6  # 2 + 2 + 2
        page_numbers = [p.page_number for p in selected]
        assert 1 in page_numbers  # Beginning
        assert 10 in page_numbers  # End
        assert any(4 <= num <= 7 for num in page_numbers)  # Middle


@pytest.mark.asyncio
async def test_question_service_with_real_database(db_session):
    """Integration test with real database session."""
    
    # Create a real conversation in the database
    conversation = Conversation(id="real-conv-123")
    db_session.add(conversation)
    await db_session.commit()
    
    # Mock other dependencies but use real DB session
    mock_doc_repo = AsyncMock()
    mock_llm = AsyncMock()
    mock_llm.generate_structured_response.return_value = {
        "questions": [
            {"question": "Real database test question?", "type": "COMPREHENSION"}
        ]
    }
    
    context_builder = QuestionGenerationContextBuilder(mock_doc_repo)
    service = QuestionGenerationService(
        conversation_repo=AsyncMock(),  # We'll bypass repo for this test
        document_repo=mock_doc_repo,
        llm=mock_llm,
        context_builder=context_builder
    )
    
    # Mock the document repository responses
    mock_doc_repo.get_document.return_value = DocumentModel(
        id="real-doc",
        title="Real Test Document"
    )
    mock_doc_repo.get_pages_by_document.return_value = [
        PageModel(id="real-page", page_number=1, document_id="real-doc")
    ]
    mock_doc_repo.get_blocks_by_page.return_value = []
    
    # Patch session_scope to use our real session
    with patch('new_backend_ruminate.services.conversation.question_service.session_scope') as mock_session_scope:
        mock_session_scope.return_value.__aenter__.return_value = db_session
        mock_session_scope.return_value.__aexit__.return_value = None
        
        questions = await service.generate_questions_for_conversation(
            conversation_id="real-conv-123",
            document_id="real-doc"
        )
    
    # Verify questions were stored in real database (1 from LLM + 4 fallback = 5 total)
    assert len(questions) == 5
    assert questions[0]["question"] == "Real database test question?"
    
    # Verify it's actually in the database
    from sqlalchemy import select
    result = await db_session.execute(
        select(ConversationQuestion).where(
            ConversationQuestion.conversation_id == "real-conv-123"
        )
    )
    stored_questions = result.scalars().all()
    assert len(stored_questions) == 5
    assert stored_questions[0].question_text == "Real database test question?"