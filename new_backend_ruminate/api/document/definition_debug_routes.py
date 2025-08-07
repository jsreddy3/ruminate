# new_backend_ruminate/api/document/definition_debug_routes.py
from fastapi import APIRouter, Depends, HTTPException
from new_backend_ruminate.dependencies import get_current_user
from new_backend_ruminate.domain.user.entities.user import User
from new_backend_ruminate.services.document.definition_debug import DefinitionDebugger
import json
import os

router = APIRouter(prefix="/definition-debug")

@router.get("/status")
async def get_debug_status(
    current_user: User = Depends(get_current_user)
):
    """Get current debug mode status"""
    return {
        "debug_mode": DefinitionDebugger.DEBUG_MODE,
        "debug_file": "/tmp/definition_debug.json"
    }

@router.post("/toggle")
async def toggle_debug_mode(
    current_user: User = Depends(get_current_user)
):
    """Toggle debug mode on/off"""
    if DefinitionDebugger.DEBUG_MODE:
        DefinitionDebugger.disable_debug()
    else:
        DefinitionDebugger.enable_debug()
    
    return {
        "debug_mode": DefinitionDebugger.DEBUG_MODE,
        "message": f"Debug mode {'enabled' if DefinitionDebugger.DEBUG_MODE else 'disabled'}"
    }

@router.get("/latest")
async def get_latest_debug_data(
    current_user: User = Depends(get_current_user)
):
    """Get the latest debug data"""
    debug_file = "/tmp/definition_debug.json"
    
    if not os.path.exists(debug_file):
        raise HTTPException(status_code=404, detail="No debug data available")
    
    try:
        with open(debug_file, "r") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading debug data: {str(e)}")

@router.delete("/clear")
async def clear_debug_data(
    current_user: User = Depends(get_current_user)
):
    """Clear debug data file"""
    debug_file = "/tmp/definition_debug.json"
    
    try:
        if os.path.exists(debug_file):
            os.remove(debug_file)
        return {"message": "Debug data cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing debug data: {str(e)}")