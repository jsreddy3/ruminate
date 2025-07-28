"""RDS (PostgreSQL) implementation of DocumentRepositoryInterface"""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface
from new_backend_ruminate.domain.document.entities import Document, Page, Block, DocumentStatus, BlockType
from new_backend_ruminate.infrastructure.document.models import DocumentModel, PageModel, BlockModel
from datetime import datetime


class RDSDocumentRepository(DocumentRepositoryInterface):
    """PostgreSQL implementation of document repository"""
    
    # Document operations
    async def create_document(self, document: Document, session: AsyncSession) -> Document:
        """Create a new document"""
        db_document = DocumentModel(
            id=document.id,
            user_id=document.user_id,
            status=document.status.value if isinstance(document.status, DocumentStatus) else document.status,
            s3_pdf_path=document.s3_pdf_path,
            title=document.title,
            summary=document.summary,
            arguments=document.arguments,
            key_themes_terms=document.key_themes_terms,
            processing_error=document.processing_error,
            marker_job_id=document.marker_job_id,
            marker_check_url=document.marker_check_url,
            created_at=document.created_at,
            updated_at=document.updated_at
        )
        
        session.add(db_document)
        await session.commit()
        await session.refresh(db_document)
        
        return self._to_domain_document(db_document)
    
    async def get_document(self, document_id: str, session: AsyncSession) -> Optional[Document]:
        """Get a document by ID"""
        result = await session.execute(
            select(DocumentModel).where(DocumentModel.id == document_id)
        )
        db_document = result.scalar_one_or_none()
        
        if db_document:
            return self._to_domain_document(db_document)
        return None
    
    async def get_documents_by_user(self, user_id: str, session: AsyncSession) -> List[Document]:
        """Get all documents for a user"""
        result = await session.execute(
            select(DocumentModel)
            .where(DocumentModel.user_id == user_id)
            .order_by(DocumentModel.created_at.desc())
        )
        db_documents = result.scalars().all()
        
        return [self._to_domain_document(doc) for doc in db_documents]
    
    async def update_document(self, document: Document, session: AsyncSession) -> Document:
        """Update an existing document"""
        result = await session.execute(
            select(DocumentModel).where(DocumentModel.id == document.id)
        )
        db_document = result.scalar_one_or_none()
        
        if not db_document:
            raise ValueError(f"Document {document.id} not found")
        
        # Update fields
        db_document.status = document.status.value if isinstance(document.status, DocumentStatus) else document.status
        db_document.s3_pdf_path = document.s3_pdf_path
        db_document.title = document.title
        db_document.summary = document.summary
        db_document.arguments = document.arguments
        db_document.key_themes_terms = document.key_themes_terms
        db_document.processing_error = document.processing_error
        db_document.marker_job_id = document.marker_job_id
        db_document.marker_check_url = document.marker_check_url
        db_document.updated_at = datetime.now()
        
        await session.commit()
        await session.refresh(db_document)
        
        return self._to_domain_document(db_document)
    
    async def delete_document(self, document_id: str, session: AsyncSession) -> bool:
        """Delete a document"""
        result = await session.execute(
            select(DocumentModel).where(DocumentModel.id == document_id)
        )
        db_document = result.scalar_one_or_none()
        
        if db_document:
            await session.delete(db_document)
            await session.commit()
            return True
        return False
    
    # Page operations
    async def create_pages(self, pages: List[Page], session: AsyncSession) -> List[Page]:
        """Create multiple pages"""
        db_pages = []
        for page in pages:
            db_page = PageModel(
                id=page.id,
                document_id=page.document_id,
                page_number=page.page_number,
                polygon=page.polygon,
                block_ids=page.block_ids,
                section_hierarchy=page.section_hierarchy,
                html_content=page.html_content,
                created_at=page.created_at,
                updated_at=page.updated_at
            )
            session.add(db_page)
            db_pages.append(db_page)
        
        await session.commit()
        
        # Refresh all pages
        for db_page in db_pages:
            await session.refresh(db_page)
        
        return [self._to_domain_page(p) for p in db_pages]
    
    async def get_pages_by_document(self, document_id: str, session: AsyncSession) -> List[Page]:
        """Get all pages for a document"""
        result = await session.execute(
            select(PageModel)
            .where(PageModel.document_id == document_id)
            .order_by(PageModel.page_number)
        )
        db_pages = result.scalars().all()
        
        return [self._to_domain_page(page) for page in db_pages]
    
    async def get_page(self, page_id: str, session: AsyncSession) -> Optional[Page]:
        """Get a specific page"""
        result = await session.execute(
            select(PageModel).where(PageModel.id == page_id)
        )
        db_page = result.scalar_one_or_none()
        
        if db_page:
            return self._to_domain_page(db_page)
        return None
    
    # Block operations
    async def create_blocks(self, blocks: List[Block], session: AsyncSession) -> List[Block]:
        """Create multiple blocks"""
        db_blocks = []
        for block in blocks:
            db_block = BlockModel(
                id=block.id,
                document_id=block.document_id,
                page_id=block.page_id,
                block_type=block.block_type.value if block.block_type else None,
                html_content=block.html_content,
                polygon=block.polygon,
                page_number=block.page_number,
                section_hierarchy=block.section_hierarchy,
                metadata=block.metadata,
                images=block.images,
                is_critical=block.is_critical,
                critical_summary=block.critical_summary,
                created_at=block.created_at,
                updated_at=block.updated_at
            )
            session.add(db_block)
            db_blocks.append(db_block)
        
        await session.commit()
        
        # Refresh all blocks
        for db_block in db_blocks:
            await session.refresh(db_block)
        
        return [self._to_domain_block(b) for b in db_blocks]
    
    async def get_blocks_by_document(self, document_id: str, session: AsyncSession) -> List[Block]:
        """Get all blocks for a document"""
        result = await session.execute(
            select(BlockModel)
            .where(BlockModel.document_id == document_id)
            .order_by(BlockModel.page_number, BlockModel.id)
        )
        db_blocks = result.scalars().all()
        
        return [self._to_domain_block(block) for block in db_blocks]
    
    async def get_blocks_by_page(self, page_id: str, session: AsyncSession) -> List[Block]:
        """Get all blocks for a page"""
        result = await session.execute(
            select(BlockModel)
            .where(BlockModel.page_id == page_id)
            .order_by(BlockModel.id)
        )
        db_blocks = result.scalars().all()
        
        return [self._to_domain_block(block) for block in db_blocks]
    
    async def get_block(self, block_id: str, session: AsyncSession) -> Optional[Block]:
        """Get a specific block"""
        result = await session.execute(
            select(BlockModel).where(BlockModel.id == block_id)
        )
        db_block = result.scalar_one_or_none()
        
        if db_block:
            return self._to_domain_block(db_block)
        return None
    
    async def update_block(self, block: Block, session: AsyncSession) -> Block:
        """Update a block (for critical content analysis)"""
        result = await session.execute(
            select(BlockModel).where(BlockModel.id == block.id)
        )
        db_block = result.scalar_one_or_none()
        
        if not db_block:
            raise ValueError(f"Block {block.id} not found")
        
        # Update critical content fields
        db_block.is_critical = block.is_critical
        db_block.critical_summary = block.critical_summary
        db_block.updated_at = datetime.now()
        
        await session.commit()
        await session.refresh(db_block)
        
        return self._to_domain_block(db_block)
    
    async def get_critical_blocks(self, document_id: str, session: AsyncSession) -> List[Block]:
        """Get all critical blocks for a document"""
        result = await session.execute(
            select(BlockModel)
            .where(and_(
                BlockModel.document_id == document_id,
                BlockModel.is_critical == True
            ))
            .order_by(BlockModel.page_number, BlockModel.id)
        )
        db_blocks = result.scalars().all()
        
        return [self._to_domain_block(block) for block in db_blocks]
    
    async def get_pages_in_range(
        self, 
        document_id: str, 
        center_page: int, 
        radius: int, 
        session: AsyncSession
    ) -> List[Page]:
        """Get pages in range [center_page - radius, center_page + radius]"""
        result = await session.execute(
            select(PageModel)
            .where(
                and_(
                    PageModel.document_id == document_id,
                    PageModel.page_number >= center_page - radius,
                    PageModel.page_number <= center_page + radius
                )
            )
            .order_by(PageModel.page_number)
        )
        db_pages = result.scalars().all()
        return [self._to_domain_page(page) for page in db_pages]
    
    # Helper methods to convert between domain and DB models
    def _to_domain_document(self, db_document: DocumentModel) -> Document:
        """Convert DB model to domain entity"""
        return Document(
            id=db_document.id,
            user_id=db_document.user_id,
            status=DocumentStatus(db_document.status),
            s3_pdf_path=db_document.s3_pdf_path,
            title=db_document.title,
            summary=db_document.summary,
            arguments=db_document.arguments,
            key_themes_terms=db_document.key_themes_terms,
            processing_error=db_document.processing_error,
            marker_job_id=db_document.marker_job_id,
            marker_check_url=db_document.marker_check_url,
            created_at=db_document.created_at,
            updated_at=db_document.updated_at
        )
    
    def _to_domain_page(self, db_page: PageModel) -> Page:
        """Convert DB model to domain entity"""
        return Page(
            id=db_page.id,
            document_id=db_page.document_id,
            page_number=db_page.page_number,
            polygon=db_page.polygon,
            block_ids=db_page.block_ids,
            section_hierarchy=db_page.section_hierarchy,
            html_content=db_page.html_content,
            created_at=db_page.created_at,
            updated_at=db_page.updated_at
        )
    
    def _to_domain_block(self, db_block: BlockModel) -> Block:
        """Convert DB model to domain entity"""
        return Block(
            id=db_block.id,
            document_id=db_block.document_id,
            page_id=db_block.page_id,
            block_type=BlockType(db_block.block_type) if db_block.block_type else None,
            html_content=db_block.html_content,
            polygon=db_block.polygon,
            page_number=db_block.page_number,
            section_hierarchy=db_block.section_hierarchy,
            metadata=db_block.metadata,
            images=db_block.images,
            is_critical=db_block.is_critical,
            critical_summary=db_block.critical_summary,
            created_at=db_block.created_at,
            updated_at=db_block.updated_at
        )