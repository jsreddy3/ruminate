# new_backend_ruminate/worker/processor.py
from __future__ import annotations
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv
import os

import psutil

from new_backend_ruminate.infrastructure.db.bootstrap import init_engine
from new_backend_ruminate.config import settings

logger = logging.getLogger(__name__)


async def run_worker() -> None:
    # Initialize environment and DB engine BEFORE importing DI (which builds LLM)
    current_dir = Path(__file__).parent.parent
    for env_file in [current_dir / ".env", current_dir.parent / ".env"]:
        if env_file.exists():
            load_dotenv(env_file, override=True)
    await init_engine(settings())

    # Quick sanity log for OpenAI key prefix (first 8 chars only)
    try:
        ai_key = settings().openai_api_key
        prefix = (ai_key[:8] + "…") if ai_key else "<missing>"
        logger.info(f"[Worker] OPENAI_API_KEY prefix: {prefix}")
    except Exception:
        logger.info("[Worker] OPENAI_API_KEY prefix: <error reading>")

    # Import dependencies only after env is loaded and engine initialized
    from new_backend_ruminate.dependencies import (
        get_document_service,
        get_processing_queue,
    )

    document_service = get_document_service()
    queue = get_processing_queue()

    # Concurrency and memory guard
    max_concurrency = int(os.getenv("WORKER_MAX_CONCURRENCY", "2"))
    mem_pause_pct = float(os.getenv("WORKER_MEMORY_PAUSE_PCT", "85"))
    sem = asyncio.Semaphore(max_concurrency)

    async def process_job(job: dict) -> None:
        try:
            document_id = job.get("document_id")
            storage_key = job.get("storage_key")
            if not document_id or not storage_key:
                logger.error(f"Invalid job payload: {job}")
                return
            logger.info(f"Processing document job: document_id={document_id}")
            await document_service._process_document_background(document_id, storage_key)  # noqa: SLF001
        except Exception as e:
            logger.exception(f"Worker job error: {e}")
        finally:
            sem.release()

    logger.info(
        f"Worker started. max_concurrency={max_concurrency}, mem_pause_pct={mem_pause_pct}%"
    )

    while True:
        try:
            # Memory guard: pause dequeuing if system memory is high
            vm = psutil.virtual_memory()
            if vm and vm.percent >= mem_pause_pct:
                await asyncio.sleep(0.5)
                continue

            # Acquire a slot before dequeuing to apply backpressure
            await sem.acquire()

            job = await queue.dequeue(timeout_seconds=2)
            if not job:
                sem.release()
                await asyncio.sleep(0.1)
                continue

            # Process concurrently up to semaphore limit
            asyncio.create_task(process_job(job))
        except Exception as e:
            logger.exception(f"Worker loop error: {e}")
            await asyncio.sleep(1)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker()) 