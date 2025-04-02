from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
import json
import os
from src.models.viewer.page import Page
from src.models.viewer.block import Block
from src.models.base.document import Document
from src.repositories.interfaces.document_repository import DocumentRepository

class JSONDocumentRepository(DocumentRepository):
    """Local JSON implementation of DocumentRepository."""
    
    def __init__(self, data_dir: str = "local_db"):
        """Initialize local JSON document repository.
        
        Args:
            data_dir: Directory to store JSON files in
        """
        self.data_dir = data_dir
        self._ensure_dirs()
        
        # In-memory stores for quick access
        self.documents: Dict[str, Document] = {}
        self.pages: Dict[str, Page] = {}
        self.blocks: Dict[str, Block] = {}
    
    def _ensure_dirs(self):
        """Create data directories if they don't exist"""
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "documents"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "pages"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "blocks"), exist_ok=True)
    
    async def store_document(self, document: Document, session: Optional[AsyncSession] = None) -> None:
        """Store a document in memory and on disk"""
        self.documents[document.id] = document
        path = os.path.join(self.data_dir, "documents", f"{document.id}.json")
        with open(path, 'w') as f:
            f.write(document.json())
    
    async def get_document(self, document_id: str, session: Optional[AsyncSession] = None) -> Optional[Document]:
        """Get a document by ID"""
        if document_id in self.documents:
            return self.documents[document_id]
            
        path = os.path.join(self.data_dir, "documents", f"{document_id}.json")
        if os.path.exists(path):
            with open(path, 'r') as f:
                return Document.parse_raw(f.read())
        return None
    
    async def store_pages(self, pages: List[Page], session: Optional[AsyncSession] = None) -> None:
        """Store pages in memory and on disk"""
        for page in pages:
            self.pages[page.id] = page
            path = os.path.join(self.data_dir, "pages", f"{page.id}.json")
            with open(path, 'w') as f:
                f.write(page.json())
    
    async def get_document_pages(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Page]:
        """Get all pages for a document"""
        pages = []
        pages_dir = os.path.join(self.data_dir, "pages")
        for filename in os.listdir(pages_dir):
            if not filename.endswith('.json'):
                continue
                
            path = os.path.join(pages_dir, filename)
            with open(path, 'r') as f:
                page = Page.parse_raw(f.read())
                if page.document_id == document_id:
                    pages.append(page)
        return pages
    
    async def store_blocks(self, blocks: List[Block], session: Optional[AsyncSession] = None) -> None:
        """Store blocks in memory and on disk"""
        for block in blocks:
            self.blocks[block.id] = block
            path = os.path.join(self.data_dir, "blocks", f"{block.id}.json")
            with open(path, 'w') as f:
                f.write(block.json())
    
    async def get_page_blocks(self, page_id: str, session: Optional[AsyncSession] = None) -> List[Block]:
        """Get all blocks for a page"""
        blocks = []
        blocks_dir = os.path.join(self.data_dir, "blocks")
        for filename in os.listdir(blocks_dir):
            if not filename.endswith('.json'):
                continue
                
            path = os.path.join(blocks_dir, filename)
            with open(path, 'r') as f:
                block = Block.parse_raw(f.read())
                if block.page_id == page_id:
                    blocks.append(block)
        return blocks
    
    async def get_block(self, block_id: str, session: Optional[AsyncSession] = None) -> Optional[Block]:
        """Get a block by ID"""
        if block_id in self.blocks:
            return self.blocks[block_id]
            
        path = os.path.join(self.data_dir, "blocks", f"{block_id}.json")
        if os.path.exists(path):
            with open(path, 'r') as f:
                return Block.parse_raw(f.read())
        return None

    async def get_blocks(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Block]:
        """Get all blocks for a document"""
        blocks = []
        blocks_dir = os.path.join(self.data_dir, "blocks")
        for filename in os.listdir(blocks_dir):
            if filename.endswith(".json"):
                with open(os.path.join(blocks_dir, filename), 'r') as f:
                    block = Block.parse_raw(f.read())
                    if block.document_id == document_id:
                        blocks.append(block)
        return blocks