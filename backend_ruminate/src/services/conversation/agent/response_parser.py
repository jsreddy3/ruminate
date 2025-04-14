from typing import Dict, Any
import logging
import re
import json

logger = logging.getLogger(__name__)

class AgentResponseParser:
    """
    Parser for agent responses to extract structured information.
    This handles parsing and validating the JSON responses from the LLM agent.
    """
    
    def __init__(self):
        logger.debug("AgentResponseParser initialized")
    
    def parse_agent_response(self, response: str) -> Dict[str, Any]:
        """
        Parse the agent's response to extract the JSON action.
        This is a fallback method when structured JSON response fails.
        """
        logger.debug("Parsing agent response")
        # Look for JSON objects in the response
        try:
            # Find JSON-like structures - anything between { and }
            json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
            matches = re.findall(json_pattern, response)
            logger.debug(f"Found {len(matches)} potential JSON matches in response")
            
            if matches:
                # Try to parse each match as JSON
                for match in matches:
                    try:
                        data = json.loads(match)
                        
                        # Validate the structure
                        if "thought" in data and ("action" in data and "action_input" in data or "answer" in data):
                            return data
                    except json.JSONDecodeError:
                        continue
            
            # If no valid JSON found, try to extract structured fields
            logger.debug("No valid JSON found, trying to extract structured fields")
            thought_match = re.search(r'thought:?\s*(.*?)(?=\n\s*action:|\n\s*answer:|$)', response, re.IGNORECASE | re.DOTALL)
            
            if "ANSWER FOR USER:" in response:
                # Extract the answer after this marker
                answer_match = re.search(r'ANSWER FOR USER:(.*?)$', response, re.IGNORECASE | re.DOTALL)
                if answer_match:
                    return {
                        "thought": thought_match.group(1).strip() if thought_match else "Finalizing answer",
                        "response_type": "answer",
                        "answer": answer_match.group(1).strip()
                    }
            
            action_match = re.search(r'action:?\s*(.*?)(?=\n|$)', response, re.IGNORECASE)
            action_input_match = re.search(r'action_input:?\s*(.*?)(?=\n|$)', response, re.IGNORECASE)
            
            if thought_match and action_match and action_input_match:
                return {
                    "thought": thought_match.group(1).strip(),
                    "response_type": "action",
                    "action": action_match.group(1).strip(),
                    "action_input": action_input_match.group(1).strip()
                }
            
            # If we still couldn't parse it, return a default searching action
            logger.warning("Couldn't parse structured fields either, returning default action")
            return {
                "thought": "I need to search the document",
                "response_type": "action",
                "action": "GET_PAGE",
                "action_input": "1"
            }
            
        except Exception as e:
            logger.error(f"Error parsing agent response: {e}")
            # Fallback
            return {
                "thought": "I need to search the document",
                "response_type": "action",
                "action": "GET_PAGE",
                "action_input": "1"
            }
    
    def validate_agent_action(self, action_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate the agent action data and ensure it has the correct format.
        Returns the validated data or an error dictionary.
        """
        # Check if required fields are present
        if "thought" not in action_data:
            return {"error": "Missing 'thought' field in agent response"}
            
        if "response_type" not in action_data:
            return {"error": "Missing 'response_type' field in agent response"}
        
        response_type = action_data.get("response_type")
        
        # Validate based on response type
        if response_type == "action":
            if "action" not in action_data:
                return {"error": "Missing 'action' field for action response"}
                
            if "action_input" not in action_data:
                return {"error": "Missing 'action_input' field for action response"}
                
            # Validate action type
            valid_actions = ["GET_PAGE", "GET_BLOCK"]
            if action_data["action"] not in valid_actions:
                return {"error": f"Invalid action '{action_data['action']}'. Must be one of: {', '.join(valid_actions)}"}
                
        elif response_type == "answer":
            if "answer" not in action_data:
                return {"error": "Missing 'answer' field for answer response"}
        else:
            return {"error": f"Invalid response_type '{response_type}'. Must be 'action' or 'answer'"}
            
        return action_data