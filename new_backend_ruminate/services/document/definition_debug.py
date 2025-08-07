# new_backend_ruminate/services/document/definition_debug.py
import json
from typing import Optional
from datetime import datetime

class DefinitionDebugger:
    """Simple debug system for definition generation"""
    
    # Global flag to enable/disable debug mode
    DEBUG_MODE = True
    
    @classmethod
    def log_definition_context(
        cls,
        term: str,
        document_title: str,
        document_summary: Optional[str],
        full_context: str,
        system_prompt: str,
        user_prompt: str
    ) -> None:
        """Log the full context being sent for definition generation"""
        if not cls.DEBUG_MODE:
            return
            
        debug_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "term": term,
            "document_title": document_title,
            "document_summary": document_summary,
            "context_length": len(full_context),
            "context_preview": full_context[:500] + "..." if len(full_context) > 500 else full_context,
            "full_context": full_context,
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
            "total_chars": len(system_prompt) + len(user_prompt)
        }
        
        # Write to debug file
        with open("/tmp/definition_debug.json", "w") as f:
            json.dump(debug_data, f, indent=2)
            
        print(f"[DefinitionDebug] Logged context for term: {term}")
    
    @classmethod
    def enable_debug(cls):
        """Enable debug mode"""
        cls.DEBUG_MODE = True
        
    @classmethod
    def disable_debug(cls):
        """Disable debug mode"""
        cls.DEBUG_MODE = False