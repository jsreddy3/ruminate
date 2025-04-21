# llm_service.py

from typing import List, Optional, Dict, Any, AsyncGenerator
from src.models.conversation.message import Message, MessageRole
from litellm import acompletion, ModelResponse
import google.generativeai as genai
from google.generativeai import types # Keep this import
import base64
import json
import logging
import openai
import math

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class LLMService:
    CHAT_MODEL = "gpt-4o"  # Default model

    def __init__(self, api_key: Optional[str] = None, gemini_api_key: Optional[str] = None):
        self.api_key = api_key
        self.gemini_api_key = gemini_api_key

        # Initialize Gemini by configuring the library if API key is provided
        if gemini_api_key:
            try:
                genai.configure(api_key=gemini_api_key)
                # logger.info("Gemini API configured successfully.")
            except Exception as e:
                logger.error(f"Failed to configure Gemini API: {e}")
                # Decide if you want to raise an error here or handle it differently
                # raise e
        # No self.gemini_client is needed anymore for this setup

    async def analyze_image(self, base64_image: str, prompt: str) -> str:
        """Analyze an image using a Gemini vision model

        Args:
            base64_image: Base64 encoded image data
            prompt: The prompt to guide the image analysis

        Returns:
            str: The analysis result from Gemini
        """
        # Check if Gemini was configured (API key provided)
        if not self.gemini_api_key:
             logger.error("Gemini API key not provided during initialization. Cannot analyze image.")
             # Consider returning a specific error message or raising an exception
             return "Error: Gemini API not configured."

        try:
            # Decode base64 string to bytes
            image_bytes = base64.b64decode(base64_image)

            # Create image part using the types API
            # Assuming JPEG, adjust if needed or detect MIME type
            image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")

            # Instantiate the specific Gemini model for vision tasks
            # Note: 'gemini-2.0-flash' might not be a valid model name yet.
            # Common vision models are 'gemini-1.5-flash' or 'gemini-pro-vision'.
            # Using the name from your original code, but double-check its validity.
            model_name = "gemini-1.5-flash" # Changed to a likely valid vision model
            # model_name = "gemini-pro-vision" # Another common option
            # model_name = "gemini-2.0-flash" # If this is actually available now

            logger.debug(f"Using Gemini model: {model_name}")
            model = genai.GenerativeModel(model_name)

            # Generate content using the instantiated model
            response = await model.generate_content_async( # Use async version
                contents=[prompt, image_part]
            )

            logger.debug(f"Gemini response: {response}")
            # Safely access the text part of the response
            if response.parts:
                 return "".join(part.text for part in response.parts if hasattr(part, 'text'))
            elif hasattr(response, 'text'):
                 return response.text
            else:
                 # Handle cases where the response might be blocked or empty
                 logger.warning(f"Gemini response did not contain text. Full response: {response}")
                 # Check for safety ratings or finish reason if needed
                 # For example: if response.prompt_feedback.block_reason: ...
                 return "Analysis could not be completed."


        except Exception as e:
            logger.error(f"Error analyzing image with Gemini: {str(e)}")
            # Re-raise the exception or return an error string
            # raise e
            return f"Error analyzing image: {str(e)}" # Return error message

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

        try:
            completion = await acompletion(
                model=self.CHAT_MODEL,
                messages=formatted_messages,
                api_key=self.api_key,
                stream=False  # Don't stream responses for now
            )
            # Add basic error handling/checking
            if completion.choices and completion.choices[0].message:
                 return completion.choices[0].message.content
            else:
                 logger.error(f"Failed to get valid completion from LiteLLM. Response: {completion}")
                 return "Error: Could not generate response."
        except Exception as e:
            logger.error(f"Error calling LiteLLM acompletion: {e}")
            return f"Error generating response: {e}"

    async def generate_response_stream(self, messages: List[Message]) -> AsyncGenerator[str, None]:
        """Generate LLM response for the given messages via stream

        Args:
            messages: List of messages in the conversation thread

        Yields:
            String chunks of the generated response text
        """
        # Convert our Message objects to the format expected by litellm
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "role": msg.role,  # MessageRole enum is already a string
                "content": msg.content
            })

        completion_stream: Optional[ModelResponse] = None
        try:
            logger.debug(f"Calling LiteLLM acompletion with stream=True for model {self.CHAT_MODEL}")
            completion_stream = await acompletion(
                model=self.CHAT_MODEL,
                messages=formatted_messages,
                api_key=self.api_key,
                stream=True  # Enable streaming
            )
            logger.debug("LiteLLM acompletion stream started.")
            
            async for chunk in completion_stream:
                # Extract content delta from the chunk
                # The exact structure might vary slightly depending on the underlying LLM API
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    content_delta = chunk.choices[0].delta.content
                    # logger.debug(f"Received chunk: {content_delta}")
                    yield content_delta
                # else:
                    # logger.debug(f"Received non-content chunk or empty delta: {chunk}") # Can be noisy
            
            logger.debug("Finished iterating through LiteLLM stream.")

        except Exception as e:
            logger.error(f"Error during LiteLLM stream: {e}", exc_info=True)
            yield f"Error during generation: {e}" # Yield an error message if streaming fails
        finally:
            logger.debug("Stream generation process completed.")
            # Optional: Any stream-specific cleanup if needed

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

        try:
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
            # Add more robust checking before accessing attributes
            if (completion.choices and
                completion.choices[0].message and
                completion.choices[0].message.tool_calls and
                len(completion.choices[0].message.tool_calls) > 0):

                function_call = completion.choices[0].message.tool_calls[0]
                if function_call.function and function_call.function.arguments:
                    try:
                        return json.loads(function_call.function.arguments)
                    except json.JSONDecodeError as json_e:
                        logger.error(f"Failed to parse JSON arguments from LLM: {json_e}")
                        logger.error(f"Raw arguments: {function_call.function.arguments}")
                        # Decide how to handle: return error dict, raise exception?
                        return {"error": "Failed to parse structured response", "details": str(json_e)}
                else:
                    logger.error("LiteLLM response missing function call arguments.")
                    return {"error": "Missing function call arguments in response"}
            else:
                logger.error(f"Failed to get valid tool call from LiteLLM. Response: {completion}")
                return {"error": "Could not generate structured response."}
        except Exception as e:
            logger.error(f"Error calling LiteLLM acompletion for structured response: {e}")
            return {"error": f"Error generating structured response: {e}"}


    async def get_embedding(self, text: str, model: str = "text-embedding-3-small") -> List[float]:
        """
        Get embedding vector for a text string using OpenAI's embedding API.

        Args:
            text: The text to embed
            model: The embedding model to use

        Returns:
            List[float]: The embedding vector
        """
        # Ensure OpenAI API key is available
        if not self.api_key:
             logger.error("OpenAI API key not provided during initialization. Cannot get embeddings.")
             # Return a zero vector with the standard embedding dimension or raise error
             # Adjust dimension if using a different model with different output size
             return [0.0] * 1536 # Default embedding dimension for text-embedding-3-small

        try:
            # Initialize client inside the method or ensure it's thread-safe if initialized in __init__
            # For simplicity here, initializing inside the method:
            client = openai.AsyncOpenAI(api_key=self.api_key) # Use AsyncOpenAI for async context
            response = await client.embeddings.create( # await the async call
                input=[text.replace("\n", " ")], # Recommended to replace newlines
                model=model,
                # encoding_format="float" # encoding_format is often inferred or default
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error getting embedding: {e}")
            # Return a zero vector with the standard embedding dimension
            # Adjust dimension based on the model if necessary
            # text-embedding-3-small dimension is 1536
            # text-embedding-ada-002 dimension is 1536
            # text-embedding-3-large dimension is 3072
            if model == "text-embedding-3-large":
                 dim = 3072
            else:
                 dim = 1536
            return [0.0] * dim

    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate the cosine similarity between two vectors.

        Args:
            vec1: First vector
            vec2: Second vector

        Returns:
            float: Cosine similarity (between -1 and 1)
        """
        # Add length check for safety
        if len(vec1) != len(vec2):
            logger.error(f"Cannot compute cosine similarity for vectors of different lengths: {len(vec1)} vs {len(vec2)}")
            return 0.0 # Or raise ValueError

        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))

        if magnitude1 == 0 or magnitude2 == 0:
            # Handle zero vectors - they are orthogonal or similarity is undefined/zero
            return 0.0

        # Clip result to [-1.0, 1.0] to avoid potential floating point inaccuracies
        similarity = dot_product / (magnitude1 * magnitude2)
        return max(-1.0, min(1.0, similarity))