"""Test web search event streaming"""
import asyncio
import os
from dotenv import load_dotenv
from pathlib import Path

from new_backend_ruminate.infrastructure.llm.openai_responses_llm import OpenAIResponsesLLM

# Load environment variables
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path, override=True)

async def test_streaming():
    print("Testing web search event streaming...")
    
    llm = OpenAIResponsesLLM(
        api_key=os.getenv("OPENAI_API_KEY"),
        model="gpt-4o",
        enable_web_search=True
    )
    
    messages = [
        {"role": "user", "content": "What's the latest news about AI safety regulations in 2025?"}
    ]
    
    print("\nStreaming response with event detection:")
    print("-" * 60)
    
    async for chunk in llm.generate_response_stream(messages):
        # Check if chunk is a JSON event
        if chunk.startswith('{"type"'):
            print(f"\n🔍 EVENT: {chunk}\n")
        else:
            print(chunk, end="", flush=True)
    
    print("\n" + "-" * 60)

if __name__ == "__main__":
    asyncio.run(test_streaming())