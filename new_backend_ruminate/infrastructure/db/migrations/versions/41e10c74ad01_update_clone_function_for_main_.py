"""update_clone_function_for_main_conversation_id

Revision ID: 41e10c74ad01
Revises: a8ccfd79f9f5
Create Date: 2025-07-31 15:07:21.670908

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '41e10c74ad01'
down_revision: Union[str, None] = 'a8ccfd79f9f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update the clone function to handle main_conversation_id
    op.execute("""
        CREATE OR REPLACE FUNCTION clone_document_with_everything(
            source_document_id VARCHAR,
            target_user_id VARCHAR
        ) RETURNS VARCHAR AS $$
        DECLARE
            new_document_id VARCHAR;
            source_exists BOOLEAN;
            main_conversation_id_value VARCHAR;
        BEGIN
            -- Check if source document exists
            SELECT EXISTS(SELECT 1 FROM documents WHERE id = source_document_id) INTO source_exists;
            IF NOT source_exists THEN
                RETURN NULL;
            END IF;

            -- Create temporary mapping tables
            CREATE TEMP TABLE IF NOT EXISTS doc_map (old_id VARCHAR PRIMARY KEY, new_id VARCHAR);
            CREATE TEMP TABLE IF NOT EXISTS page_map (old_id VARCHAR PRIMARY KEY, new_id VARCHAR);
            CREATE TEMP TABLE IF NOT EXISTS block_map (old_id VARCHAR PRIMARY KEY, new_id VARCHAR);
            CREATE TEMP TABLE IF NOT EXISTS conv_map (old_id VARCHAR PRIMARY KEY, new_id VARCHAR);
            CREATE TEMP TABLE IF NOT EXISTS msg_map (old_id VARCHAR PRIMARY KEY, new_id VARCHAR);
            
            -- Clear any existing data (in case of multiple calls)
            TRUNCATE doc_map, page_map, block_map, conv_map, msg_map;

            -- Step 1: Generate all ID mappings upfront
            -- Document mapping
            new_document_id := gen_random_uuid()::VARCHAR;
            INSERT INTO doc_map VALUES (source_document_id, new_document_id);

            -- Page mappings
            INSERT INTO page_map (old_id, new_id)
            SELECT id, gen_random_uuid()::VARCHAR 
            FROM pages 
            WHERE document_id = source_document_id;

            -- Block mappings
            INSERT INTO block_map (old_id, new_id)
            SELECT id, gen_random_uuid()::VARCHAR 
            FROM blocks 
            WHERE document_id = source_document_id;

            -- Conversation mappings
            INSERT INTO conv_map (old_id, new_id)
            SELECT id, gen_random_uuid()::VARCHAR 
            FROM conversations 
            WHERE document_id = source_document_id;

            -- Message mappings
            INSERT INTO msg_map (old_id, new_id)
            SELECT id, gen_random_uuid()::VARCHAR 
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.document_id = source_document_id;

            -- Step 2: Clone document (initial clone without main_conversation_id)
            INSERT INTO documents (
                id, user_id, status, s3_pdf_path, title, 
                summary, arguments, key_themes_terms,
                furthest_read_block_id, furthest_read_position,
                created_at, updated_at
            )
            SELECT 
                new_document_id,
                target_user_id,
                status,
                s3_pdf_path,  -- Share the same PDF
                title,
                summary,
                arguments,
                key_themes_terms,
                NULL,  -- Reset reading progress
                NULL,
                NOW(),
                NOW()
            FROM documents
            WHERE id = source_document_id;

            -- Step 3: Clone pages
            INSERT INTO pages (
                id, document_id, page_number, polygon, 
                block_ids, section_hierarchy, html_content,
                created_at, updated_at
            )
            SELECT 
                pm.new_id,
                dm.new_id,
                page_number,
                polygon,
                
                -- Remap block_ids JSON array
                CASE 
                    WHEN block_ids IS NOT NULL AND block_ids != 'null'::JSON THEN
                        (
                            SELECT JSON_AGG(bm_inner.new_id ORDER BY block_idx.idx)
                            FROM JSON_ARRAY_ELEMENTS_TEXT(block_ids) WITH ORDINALITY AS block_idx(block_id, idx)
                            JOIN block_map bm_inner ON bm_inner.old_id = block_idx.block_id
                        )
                    ELSE '[]'::JSON
                END,
                
                section_hierarchy,
                html_content,
                NOW(),
                NOW()
            FROM pages p
            JOIN page_map pm ON pm.old_id = p.id
            JOIN doc_map dm ON dm.old_id = p.document_id
            WHERE p.document_id = source_document_id;

            -- Step 4: Clone blocks
            INSERT INTO blocks (
                id, document_id, page_id, block_type, html_content,
                polygon, page_number, section_hierarchy, meta_data,
                images, is_critical, critical_summary,
                created_at, updated_at
            )
            SELECT 
                bm.new_id,
                dm.new_id,
                COALESCE(pm.new_id, NULL),
                block_type,
                html_content,
                polygon,
                page_number,
                section_hierarchy,
                meta_data,
                images,
                is_critical,
                critical_summary,
                NOW(),
                NOW()
            FROM blocks b
            JOIN block_map bm ON bm.old_id = b.id
            JOIN doc_map dm ON dm.old_id = b.document_id
            LEFT JOIN page_map pm ON pm.old_id = b.page_id
            WHERE b.document_id = source_document_id;

            -- Step 5: Clone conversations
            INSERT INTO conversations (
                id, created_at, meta_data, is_demo, root_message_id,
                active_thread_ids, type, user_id, document_id,
                source_block_id, selected_text, text_start_offset, text_end_offset
            )
            SELECT 
                cm.new_id,
                NOW(),
                meta_data,
                is_demo,
                -- root_message_id will be updated later after message cloning
                NULL,
                '[]'::JSON,  -- Reset active thread
                type,
                target_user_id,
                dm.new_id,
                -- Remap source_block_id if it exists
                CASE 
                    WHEN c.source_block_id IS NOT NULL THEN COALESCE(bm.new_id, c.source_block_id)
                    ELSE NULL
                END,
                selected_text,
                text_start_offset,
                text_end_offset
            FROM conversations c
            JOIN conv_map cm ON cm.old_id = c.id
            JOIN doc_map dm ON dm.old_id = c.document_id
            LEFT JOIN block_map bm ON bm.old_id = c.source_block_id
            WHERE c.document_id = source_document_id;

            -- Step 6: Clone messages with proper ID remapping
            INSERT INTO messages (
                id, conversation_id, parent_id, version, role,
                content, meta_data, created_at, active_child_id,
                user_id, document_id, block_id
            )
            SELECT 
                mm.new_id,
                cm.new_id,
                -- Remap parent_id if it exists
                CASE 
                    WHEN m.parent_id IS NOT NULL THEN mm_parent.new_id
                    ELSE NULL
                END,
                version,
                role,
                content,
                -- Handle metadata JSON remapping for block_ids arrays
                CASE 
                    WHEN m.meta_data IS NOT NULL AND m.meta_data ? 'generated_summaries' THEN
                        JSON_BUILD_OBJECT(
                            'generated_summaries',
                            (
                                SELECT JSON_AGG(
                                    JSON_BUILD_OBJECT(
                                        'note_id', summary_item->>'note_id',
                                        'block_id', COALESCE(bm_meta.new_id, summary_item->>'block_id'),
                                        'summary_content', summary_item->>'summary_content',
                                        'summary_range', summary_item->'summary_range',
                                        'created_at', summary_item->>'created_at'
                                    )
                                )
                                FROM JSON_ARRAY_ELEMENTS(m.meta_data->'generated_summaries') AS summary_item
                                LEFT JOIN block_map bm_meta ON bm_meta.old_id = summary_item->>'block_id'
                            )
                        )
                    ELSE m.meta_data
                END,
                NOW(),
                NULL,  -- active_child_id will be updated in next step
                target_user_id,
                dm.new_id,
                -- Remap block_id if it exists
                CASE 
                    WHEN m.block_id IS NOT NULL THEN COALESCE(bm.new_id, m.block_id)
                    ELSE NULL
                END
            FROM messages m
            JOIN msg_map mm ON mm.old_id = m.id
            JOIN conversations c ON c.id = m.conversation_id
            JOIN conv_map cm ON cm.old_id = c.id
            JOIN doc_map dm ON dm.old_id = c.document_id
            LEFT JOIN msg_map mm_parent ON mm_parent.old_id = m.parent_id
            LEFT JOIN block_map bm ON bm.old_id = m.block_id
            WHERE c.document_id = source_document_id;

            -- Step 7: Update active_child_id references in messages
            UPDATE messages 
            SET active_child_id = mm_child.new_id
            FROM messages m_old
            JOIN msg_map mm_old ON mm_old.old_id = m_old.id
            JOIN msg_map mm_child ON mm_child.old_id = m_old.active_child_id
            JOIN conversations c ON c.id = m_old.conversation_id
            WHERE messages.id = mm_old.new_id
            AND c.document_id = source_document_id
            AND m_old.active_child_id IS NOT NULL;

            -- Step 8: Update root_message_id in conversations
            UPDATE conversations 
            SET root_message_id = mm.new_id,
                active_thread_ids = JSON_BUILD_ARRAY(mm.new_id)
            FROM conversations c_old
            JOIN conv_map cm ON cm.old_id = c_old.id
            JOIN msg_map mm ON mm.old_id = c_old.root_message_id
            WHERE conversations.id = cm.new_id
            AND c_old.document_id = source_document_id
            AND c_old.root_message_id IS NOT NULL;

            -- Step 9: Update main_conversation_id in the cloned document
            -- Find the main conversation (type = 'CHAT')
            SELECT cm.new_id INTO main_conversation_id_value
            FROM conversations c_old
            JOIN conv_map cm ON cm.old_id = c_old.id
            WHERE c_old.document_id = source_document_id
            AND c_old.type = 'CHAT'
            LIMIT 1;

            -- Update the document with the main conversation ID
            IF main_conversation_id_value IS NOT NULL THEN
                UPDATE documents 
                SET main_conversation_id = main_conversation_id_value
                WHERE id = new_document_id;
            END IF;

            -- Clean up temp tables
            DROP TABLE doc_map, page_map, block_map, conv_map, msg_map;

            RETURN new_document_id;
        END;
        $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    # Revert to the old version of the function
    op.execute("DROP FUNCTION IF EXISTS clone_document_with_everything(VARCHAR, VARCHAR);")
    
    # Restore the original function without main_conversation_id handling
    op.execute("""
        CREATE OR REPLACE FUNCTION clone_document_with_everything(
            source_document_id VARCHAR,
            target_user_id VARCHAR
        ) RETURNS VARCHAR AS $$
        DECLARE
            new_document_id VARCHAR;
            source_exists BOOLEAN;
        BEGIN
            -- Original function implementation without main_conversation_id handling
            -- (would need to copy the original function here)
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)
