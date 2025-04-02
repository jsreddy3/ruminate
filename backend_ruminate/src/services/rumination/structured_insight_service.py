import json
import yaml
import re
import os
import logging
import base64
from typing import List, Dict, Optional

from src.models.rumination.structured_insight import StructuredInsight, Annotation
from src.models.conversation.message import Message, MessageRole
from src.services.ai.llm_service import LLMService
from src.repositories.interfaces.insight_repository import InsightRepository
from src.models.viewer.block import BlockType

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class StructuredInsightService:
    def __init__(self, 
                 llm_service: LLMService,
                 insight_repository: InsightRepository):
        # Store the cumulative conversation as a list of Message objects.
        self.cumulative_messages: List[Message] = []
        self.llm_service = llm_service
        self.insight_repository = insight_repository
        
        # Get the absolute path to the prompts directory
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        prompts_dir = os.path.join(base_dir, "src", "prompts")
        config_dir = os.path.join(base_dir, "config")
        
        # Load prompts from YAML.
        try:
            with open(os.path.join(prompts_dir, "prompt.yml"), "r") as f:
                self.prompts = yaml.safe_load(f)
        except FileNotFoundError:
            logger.error(f"Could not find prompt.yml in {prompts_dir}")
            # Fallback to empty prompts dictionary
            self.prompts = {}

        try:
            with open(os.path.join(config_dir, "rumination_config.yml"), "r") as f:
                self.rumination_config = yaml.safe_load(f)
        except FileNotFoundError:
            logger.error(f"Could not find rumination_config.yml in {config_dir}")
            # Fallback to empty config dictionary
            self.rumination_config = {}
        
        # Store the default objective from config
        self.default_objective = self.rumination_config.get("objective", "Focus on extracting the key themes and details of the document.")

    def _get_prompt_with_objective(self, key: str, objective: str) -> str:
        """Get a prompt with the specified objective injected"""
        if not objective:
            raise ValueError("Objective is required for prompt generation")
            
        prompt = self.prompts.get(key, "")
        if isinstance(prompt, str):
            prompt = prompt.replace("{OBJECTIVE}", objective)
            logger.debug(f"Retrieved prompt '{key}' with objective: {objective}")
            logger.debug(f"Prompt preview: {prompt[:100]}...")
        return prompt

    async def analyze_block(self, block, objective: str) -> StructuredInsight:
        """Process a block by generating an overall insight and extracting annotations"""
        if not objective:
            raise ValueError("Objective is required for block analysis")
        print("\n\ncalling analyze block")
        logger.debug(f"Starting analyze_block for block_id: {block.id}, document_id: {block.document_id}")
        logger.debug(f"Using objective: {objective}")
        
        # Check if insight already exists
        existing_insight = await self.insight_repository.get_block_insight(block.id)
        if existing_insight:
            logger.debug(f"Found existing insight with document_id: {existing_insight.document_id}")
            return existing_insight

        # Handle different block types
        block_type = block.block_type
        
        # Initialize variables
        insight = ""
        annotations = []
        
        # Check if it's an image-related block
        image_block_types = [
            BlockType.FIGURE,
            BlockType.PICTURE,
            BlockType.PICTURE_GROUP,
            BlockType.FIGURE_GROUP
        ]

        if block_type in image_block_types:
            if not block.images:
                logger.warning(f"Image block {block.id} has no images")
                insight = "Image block found but no image data available"
            else:
                insight = await self._analyze_image_block(block, objective)
            # Image blocks don't have text annotations
        else:
            # For text blocks, get both insight and annotations
            insight = await self._analyze_text_block(block, objective)
            if block.html_content:  # Only extract annotations if there's text content
                annotations = await self._extract_annotations(block.html_content, objective)

        try:
            structured_insight = StructuredInsight(
                block_id=block.id,
                document_id=block.document_id,
                page_number=block.page_number,
                insight=insight,
                annotations=annotations,
                conversation_history=[{"id": msg.id, "role": msg.role, "content": msg.content} 
                                    for msg in self.get_cumulative_messages()]
            )
            logger.debug(f"Created StructuredInsight with document_id: {structured_insight.document_id}")
        except Exception as e:
            logger.error(f"Error creating StructuredInsight: {str(e)}", exc_info=True)
            logger.error(f"Block data: {json.dumps({'block_id': block.id, 'document_id': block.document_id,'page_number': block.page_number})}")
            raise

        # Store the insight
        try:
            await self.insight_repository.create_insight(structured_insight)
            logger.debug("Successfully stored insight in repository")
        except Exception as e:
            logger.error(f"Error storing insight: {str(e)}", exc_info=True)
            raise

        return structured_insight

    async def _analyze_image_block(self, block, objective: str) -> str:
        """Analyze an image block using Gemini"""
        try:
            print("\n=== STARTING IMAGE ANALYSIS ===")
            print(f"Block ID: {block.id}")
            print(f"Block type: {block.block_type}")
            
            # Get the first image from the block
            if not block.images:
                print("WARNING: No images found in block!")
                return "No images found in block"
                
            print(f"Number of images in block: {len(block.images)}")
            first_image_key = next(iter(block.images))
            base64_image = block.images[first_image_key]
            print(f"Using image key: {first_image_key}")
            print(f"Base64 length: {len(base64_image) if base64_image else 0}")

            # Prepare the message for Gemini
            prompt = f"""Analyze this image in the context of the following objective: {objective}
            
            Please provide:
            1. A detailed description of what you see in the image
            2. Key insights or findings relevant to the objective
            3. Any notable patterns, relationships, or anomalies
            4. Technical details if this is a chart, graph, or diagram
            
            Format your response in a clear, concise manner."""

            print("\nSending to LLM service...")
            # Call Gemini through LLM service
            response = await self.llm_service.analyze_image(
                base64_image=base64_image,
                prompt=prompt
            )
            
            print("\nReceived response from LLM")
            print(f"Response length: {len(response)}")
            print(f"Preview: {response[:200]}...")
            print("=== FINISHED IMAGE ANALYSIS ===\n")

            return response

        except Exception as e:
            print(f"\nERROR in image analysis: {str(e)}")
            return f"Error analyzing image: {str(e)}"

    async def _analyze_text_block(self, block, objective: str) -> str:
        """Analyze a text block - existing implementation"""
        conversation_id = f"conv-{block.id}"
        block_text = block.html_content or ""
        plain_text = re.sub(r'<[^>]+>', '', block_text).strip()

        # Build messages specific to this block.
        block_messages = []
        
        initial_prompt = self._get_prompt_with_objective('initial_analysis', objective)
        initial_message = (
            f"{initial_prompt}\n"
            f"[Block ID: {block.id}, Page: {block.page_number}]\n"
            f"{plain_text}"
        )
        block_messages.append(Message(conversation_id=conversation_id, role=MessageRole.USER, content=initial_message))

        # Create full context: cumulative messages so far + new block messages.
        full_context = self.get_cumulative_messages() + block_messages
        response = await self.llm_service.generate_response(full_context)
        block_messages.append(Message(conversation_id=conversation_id, role=MessageRole.ASSISTANT, content=response))

        # Update cumulative messages with the new messages for this block.
        self._update_cumulative_messages(block_messages)

        return response

    async def _extract_annotations(self, block_text: str, objective: str) -> List[Annotation]:
        """Extract annotations with the specified objective"""
        if not objective:
            raise ValueError("Objective is required for annotation extraction")
            
        json_schema = {
            "type": "object",
            "properties": {
                "annotations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "phrase": {
                                "type": "string",
                                "description": "An exact substring from the block text that is significant."
                            },
                            "insight": {
                                "type": "string",
                                "description": "A concise explanation (1-2 sentences) of the phrase's significance."
                            }
                        },
                        "required": ["phrase", "insight"]
                    },
                    "minItems": 1,
                    "maxItems": 4
                }
            },
            "required": ["annotations"]
        }

        annotation_prompt = self._get_prompt_with_objective("annotation_extraction", objective)
        annotation_message = Message(
            conversation_id="global",
            role=MessageRole.USER,
            content=f"{annotation_prompt}\n\nBlock Text:\n{block_text}\n\nPlease format your response as a valid json object."
        )

        messages = self.cumulative_messages + [annotation_message]

        try:
            response = await self.llm_service.generate_structured_response(
                messages=messages,
                response_format={"type": "json_object"},
                json_schema=json_schema
            )
            annotations_data = response.get("annotations", [])
            self._update_cumulative_messages([annotation_message])
            return [Annotation(**annotation) for annotation in annotations_data]
        except Exception as e:
            print(f"Error extracting annotations: {e}")
            return []

    def _update_cumulative_messages(self, conversation_history: List[Message]) -> None:
        """Append new messages to the cumulative conversation context."""
        self.cumulative_messages.extend(conversation_history)

    def get_cumulative_messages(self) -> List[Message]:
        return self.cumulative_messages

    async def get_document_insights(self, document_id: str) -> List[StructuredInsight]:
        """Get all insights for a document from the repository"""
        return await self.insight_repository.get_document_insights(document_id)

    def get_all_insights(self) -> List[StructuredInsight]:
        return self.insights

    def save_insights_to_json(self, file_path: str) -> None:
        with open(file_path, "w") as f:
            json.dump([insight.dict() for insight in self.insights], f, indent=2)
