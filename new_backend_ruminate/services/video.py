"""Dummy async video generation placeholder."""
import asyncio

async def create_video(dream_id: str):
    # Simulate some async work
    await asyncio.sleep(0.1)
    print(f"[video.create_video] called for dream {dream_id}")
