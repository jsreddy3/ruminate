import json
from typing import List, Optional
from sqlalchemy import Column, String, Integer, JSON, ForeignKey
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from src.models.rumination.structured_insight import StructuredInsight
from src.repositories.interfaces.insight_repository import InsightRepository
from src.api.dependencies import Base

class InsightModel(Base):
    __tablename__ = "insights"

    block_id = Column(String, primary_key=True)
    document_id = Column(String, nullable=False)
    page_number = Column(Integer)
    insight = Column(String, nullable=False)
    annotations = Column(JSON)
    conversation_history = Column(JSON)

class SQLiteInsightRepository(InsightRepository):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def create_insight(self, insight: StructuredInsight) -> StructuredInsight:
        async with self.session_factory() as session:
            try:
                # First check if insight exists
                existing = await self.get_block_insight(insight.block_id)
                if existing:
                    return await self.update_insight(insight)
                    
                db_insight = InsightModel(
                    block_id=insight.block_id,
                    document_id=insight.document_id,
                    page_number=insight.page_number,
                    insight=insight.insight,
                    annotations=json.dumps([a.dict() for a in insight.annotations]) if insight.annotations else "[]",
                    conversation_history=json.dumps(insight.conversation_history)
                )
                session.add(db_insight)
                await session.commit()
                return insight
            except IntegrityError:
                await session.rollback()
                # If we hit an integrity error, try updating instead
                return await self.update_insight(insight)

    async def get_block_insight(self, block_id: str) -> Optional[StructuredInsight]:
        async with self.session_factory() as session:
            result = await session.execute(
                select(InsightModel).where(InsightModel.block_id == block_id)
            )
            db_insight = result.scalar_one_or_none()
            if not db_insight:
                return None

            return StructuredInsight(
                block_id=db_insight.block_id,
                document_id=db_insight.document_id,
                page_number=db_insight.page_number,
                insight=db_insight.insight,
                annotations=json.loads(db_insight.annotations) if db_insight.annotations else [],
                conversation_history=json.loads(db_insight.conversation_history)
            )

    async def get_document_insights(self, document_id: str) -> List[StructuredInsight]:
        async with self.session_factory() as session:
            result = await session.execute(
                select(InsightModel).where(InsightModel.document_id == document_id)
            )
            db_insights = result.scalars().all()
            return [
                StructuredInsight(
                    block_id=db_insight.block_id,
                    document_id=db_insight.document_id,
                    page_number=db_insight.page_number,
                    insight=db_insight.insight,
                    annotations=json.loads(db_insight.annotations),
                    conversation_history=json.loads(db_insight.conversation_history)
                )
                for db_insight in db_insights
            ]

    async def update_insight(self, insight: StructuredInsight) -> StructuredInsight:
        async with self.session_factory() as session:
            result = await session.execute(
                select(InsightModel).where(InsightModel.block_id == insight.block_id)
            )
            db_insight = result.scalar_one_or_none()
            if not db_insight:
                return await self.create_insight(insight)

            db_insight.page_number = insight.page_number
            db_insight.insight = insight.insight
            db_insight.annotations = json.dumps([a.dict() for a in insight.annotations])
            db_insight.conversation_history = json.dumps(insight.conversation_history)
            await session.commit()
            return insight

    async def delete_insight(self, block_id: str) -> None:
        async with self.session_factory() as session:
            result = await session.execute(
                select(InsightModel).where(InsightModel.block_id == block_id)
            )
            db_insight = result.scalar_one_or_none()
            if db_insight:
                await session.delete(db_insight)
                await session.commit() 