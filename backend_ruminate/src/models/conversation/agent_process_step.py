from datetime import datetime
from uuid import uuid4
from typing import Optional, Dict, Any
from pydantic import Field
from sqlalchemy import Column, String, Text, Integer, JSON, ForeignKey, Index
from src.database.base import Base
from src.models.base.base_model import BaseModel

class AgentProcessStepType(str):
    THOUGHT = "thought"
    ACTION = "action"
    RESULT = "result"
    ERROR = "error"
    TIMEOUT = "timeout"

class AgentProcessStep(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    conversation_id: str
    user_message_id: str  # The user message that triggered this agent process
    assistant_message_id: Optional[str] = None  # The final answer message (null until completed)
    step_number: int
    step_type: str  # "thought", "action", "result", etc.
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AgentProcessStep':
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        return cls(**data)

class AgentProcessStepModel(Base):
    __tablename__ = "agent_process_steps"
    
    id = Column(String, primary_key=True)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False, index=True)
    user_message_id = Column(String, ForeignKey("messages.id"), nullable=False)
    assistant_message_id = Column(String, ForeignKey("messages.id"), nullable=True)
    step_number = Column(Integer, nullable=False)
    step_type = Column(String, nullable=False)  # "thought", "action", "result", etc.
    content = Column(Text, nullable=False)
    created_at = Column(String)  # Store as ISO format string
    meta_data = Column(JSON, nullable=True)  # Renamed from metadata for SQLAlchemy compatibility
    
    # Create indexes for efficient querying
    __table_args__ = (
        Index('ix_agent_process_steps_user_message_id', 'user_message_id'),
        Index('ix_agent_process_steps_assistant_message_id', 'assistant_message_id'),
    )
