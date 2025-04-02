"""
Authority Dictionary Builder

This module provides functionality to build a dictionary of legal case references
from chunk analysis results.
"""

import json
import re
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class AuthorityDictionaryBuilder:
    """
    Builds and maintains a dictionary of legal case authorities.
    """
    
    def __init__(self):
        self.authorities = {}
        
    def add_authority(self, authority_ref: Dict[str, Any], chunk_id: str):
        """
        Add an authority reference to the dictionary.
        
        Args:
            authority_ref: The authority reference dict with 'quote' and 'label' fields
            chunk_id: The ID of the chunk containing this reference
        """
        if 'quote' not in authority_ref:
            return
            
        quote = authority_ref['quote']
        
        # Try to extract a case name from the quote
        case_name = self._extract_case_name(quote)
        if not case_name:
            return
            
        # Use the extracted case name as the key
        if case_name not in self.authorities:
            self.authorities[case_name] = {
                "canonical_name": self._get_canonical_name(quote),
                "variations": [quote],
                "referenced_in": [chunk_id],
                "labels": [authority_ref.get("label", "")]
            }
        else:
            # Update existing entry
            if quote not in self.authorities[case_name]["variations"]:
                self.authorities[case_name]["variations"].append(quote)
            if chunk_id not in self.authorities[case_name]["referenced_in"]:
                self.authorities[case_name]["referenced_in"].append(chunk_id)
            if authority_ref.get("label") and authority_ref["label"] not in self.authorities[case_name]["labels"]:
                self.authorities[case_name]["labels"].append(authority_ref["label"])
    
    def _extract_case_name(self, quote: str) -> Optional[str]:
        """
        Extract a standardized case name from a quote.
        
        Args:
            quote: The case citation quote
            
        Returns:
            A standardized case name or None if not found
        """
        # Simple regex to match common case citation patterns like "Name v. Name"
        pattern = r'([A-Z][a-zA-Z\s]+\s+v\.\s+[A-Z][a-zA-Z\s]+)'
        match = re.search(pattern, quote)
        
        if match:
            # Normalize the case name - lowercase and replace spaces with underscores
            case_name = match.group(1).strip()
            normalized = case_name.lower().replace(' ', '_').replace('.', '')
            return normalized
            
        # Try to match standalone case names (like "Lawrence")
        pattern = r'([A-Z][a-zA-Z]+),\s*\d'
        match = re.search(pattern, quote)
        if match:
            case_name = match.group(1).strip()
            return case_name.lower()
            
        return None
    
    def _get_canonical_name(self, quote: str) -> str:
        """
        Get the canonical display name for a case from the quote.
        
        Args:
            quote: The case citation quote
            
        Returns:
            The canonical display name for the case
        """
        # Simple regex to extract the case name for display
        pattern = r'([A-Z][a-zA-Z\s]+\s+v\.\s+[A-Z][a-zA-Z\s]+)'
        match = re.search(pattern, quote)
        
        if match:
            return match.group(1).strip()
        
        # If we can't extract a full name, use the quote itself
        return quote.split(',')[0].strip()
    
    def get_dictionary(self) -> Dict[str, Any]:
        """
        Get the complete authority dictionary.
        
        Returns:
            The authority dictionary
        """
        return {"cases": self.authorities}
    
    def save_dictionary(self, filepath: str):
        """
        Save the authority dictionary to a JSON file.
        
        Args:
            filepath: Path to save the dictionary
        """
        with open(filepath, 'w') as f:
            json.dump({"cases": self.authorities}, f, indent=2) 