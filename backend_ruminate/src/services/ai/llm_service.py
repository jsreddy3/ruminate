# llm_service.py

from typing import List, Optional, Dict, Any
from src.models.conversation.message import Message, MessageRole
from litellm import acompletion
from google import genai
from google.genai import types
import base64
import json
import logging
import openai
import math

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class LLMService:
    CHAT_MODEL = "gpt-4o-mini"  # Default model
    
    def __init__(self, api_key: Optional[str] = None, gemini_api_key: Optional[str] = None):
        self.api_key = api_key
        self.gemini_api_key = gemini_api_key
        
        # Initialize Gemini if API key is provided
        if gemini_api_key:
            self.gemini_client = genai.Client(api_key=gemini_api_key)
        
    async def analyze_image(self, base64_image: str, prompt: str) -> str:
        """Analyze an image using Gemini 1.5 Flash

        Args:
            base64_image: Base64 encoded image data
            prompt: The prompt to guide the image analysis

        Returns:
            str: The analysis result from Gemini
        """
        try:
            # Decode base64 string to bytes
            image_bytes = base64.b64decode(base64_image)
            
            # Create image part using the new API
            image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
            
            # Generate content using Gemini 1.5 Flash
            response = self.gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[prompt, image_part]
            )
            
            logger.debug(f"Gemini response: {response}")
            return response.text
            
        except Exception as e:
            logger.error(f"Error analyzing image with Gemini: {str(e)}")
            raise e

    async def generate_response(self, messages: List[Message]) -> str:
        """Generate LLM response for the given messages
        
        Args:
            messages: List of messages in the conversation thread
            
        Returns:
            Generated response text
        """
        # Convert our Message objects to the format expected by litellm
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "role": msg.role,  # MessageRole enum is already a string
                "content": msg.content
            })
            
        completion = await acompletion(
            model=self.CHAT_MODEL,
            messages=formatted_messages,
            api_key=self.api_key,
            stream=False  # Don't stream responses for now
        )
        return completion.choices[0].message.content

    async def generate_structured_response(
        self, 
        messages: List[Message], 
        response_format: Dict[str, str],
        json_schema: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate LLM response in a structured JSON format according to the provided schema
        
        Args:
            messages: List of messages in the conversation thread
            response_format: Format specification for the response (e.g., {"type": "json_object"})
            json_schema: JSON schema that defines the structure of the expected response
            
        Returns:
            Structured response as a dictionary matching the provided schema
        """
        # Convert our Message objects to the format expected by litellm
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "role": msg.role,
                "content": msg.content
            })
            
        completion = await acompletion(
            model=self.CHAT_MODEL,
            messages=formatted_messages,
            api_key=self.api_key,
            response_format=response_format,
            tools=[{
                "type": "function",
                "function": {
                    "name": "output_structure",
                    "description": "Structure the output according to the schema",
                    "parameters": json_schema
                }
            }],
            tool_choice={"type": "function", "function": {"name": "output_structure"}},
            stream=False
        )
        
        # Extract and parse the JSON response from the function call
        function_call = completion.choices[0].message.tool_calls[0]
        return json.loads(function_call.function.arguments)

    async def get_embedding(self, text: str, model: str = "text-embedding-3-small") -> List[float]:
        """
        Get embedding vector for a text string using OpenAI's embedding API.
        
        Args:
            text: The text to embed
            model: The embedding model to use
            
        Returns:
            List[float]: The embedding vector
        """
        try:
            client = openai.OpenAI(api_key=self.api_key)
            response = client.embeddings.create(
                input=[text],
                model=model,
                encoding_format="float"
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error getting embedding: {e}")
            # Return a zero vector with the standard embedding dimension
            return [0.0] * 1536  # Default embedding dimension
            
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate the cosine similarity between two vectors.
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            float: Cosine similarity (between -1 and 1)
        """
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0
            
        return dot_product / (magnitude1 * magnitude2)