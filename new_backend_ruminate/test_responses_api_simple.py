"""Simple test of OpenAI Responses API without domain dependencies"""
import asyncio
import os
from dotenv import load_dotenv
from pathlib import Path

from new_backend_ruminate.infrastructure.llm.openai_responses_llm import OpenAIResponsesLLM

# Load environment variables
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path, override=True)

async def test_responses_api():
    print("Testing OpenAI Responses API with web search...")
    
    llm = OpenAIResponsesLLM(
        api_key=os.getenv("OPENAI_API_KEY"),
        model="gpt-4o",
        enable_web_search=True
    )
    
    # Use plain dict messages instead of Message objects
    messages = [
        {"role": "user", "content": "What are the latest AI announcements from OpenAI in 2025? Please search for recent news."}
    ]
    
    print("\nStreaming response:")
    print("-" * 50)
    
    full_response = ""
    try:
        # Pass messages as plain dicts to avoid Message object issues
        async for chunk in llm.generate_response_stream(messages):
            print(chunk, end="", flush=True)
            full_response += chunk
    except Exception as e:
        print(f"\nError: {e}")
        return
    
    print("\n" + "-" * 50)
    print(f"\nTotal response length: {len(full_response)} characters")
    
    # Check if web search was used
    if "2025" in full_response or "recent" in full_response.lower():
        print("✅ Web search appears to be working!")
    else:
        print("⚠️  Response might not have used web search")

if __name__ == "__main__":
    asyncio.run(test_responses_api())