"""add_clone_document_function

Revision ID: 520c47dba994
Revises: add_reading_progress
Create Date: 2025-07-31 12:43:55.829969

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '520c47dba994'
down_revision: Union[str, None] = 'add_reading_progress'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION clone_document_with_everything(
            source_document_id VARCHAR,
            target_user_id VARCHAR
        ) RETURNS VARCHAR AS $$
        DECLARE
            new_document_id VARCHAR;
            source_exists BOOLEAN;
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
            SELECT m.id, gen_random_uuid()::VARCHAR 
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.document_id = source_document_id;

            -- Step 2: Clone document
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

            -- Step 3: Clone pages with remapped block_ids
            INSERT INTO pages (
                id, document_id, page_number, polygon,
                block_ids, section_hierarchy, html_content,
                created_at, updated_at
            )
            SELECT 
                pm.new_id,
                new_document_id,
                p.page_number,
                p.polygon,
                -- Remap block_ids JSON array
                COALESCE(
                    (
                        SELECT json_agg(bm.new_id ORDER BY idx)
                        FROM json_array_elements_text(p.block_ids) WITH ORDINALITY AS elem(old_block_id, idx)
                        JOIN block_map bm ON bm.old_id = elem.old_block_id
                    ),
                    '[]'::json
                ),
                p.section_hierarchy,
                p.html_content,
                NOW(),
                NOW()
            FROM pages p
            JOIN page_map pm ON pm.old_id = p.id
            WHERE p.document_id = source_document_id;

            -- Step 4: Clone blocks
            INSERT INTO blocks (
                id, document_id, page_id, block_type,
                polygon, page_number, section_hierarchy,
                html_content, meta_data, images,
                is_critical, critical_summary,
                created_at, updated_at
            )
            SELECT 
                bm.new_id,
                new_document_id,
                pm.new_id,
                b.block_type,
                b.polygon,
                b.page_number,
                b.section_hierarchy,
                b.html_content,
                b.meta_data,  -- Safe - no IDs here
                b.images,
                b.is_critical,
                b.critical_summary,
                NOW(),
                NOW()
            FROM blocks b
            JOIN block_map bm ON bm.old_id = b.id
            LEFT JOIN page_map pm ON pm.old_id = b.page_id
            WHERE b.document_id = source_document_id;

            -- Step 5: Clone conversations with remapped references
            INSERT INTO conversations (
                id, user_id, type, document_id,
                source_block_id, selected_text,
                text_start_offset, text_end_offset,
                root_message_id, active_thread_ids,
                meta_data, is_demo,
                created_at
            )
            SELECT 
                cm.new_id,
                target_user_id,
                c.type,
                new_document_id,
                bm.new_id,  -- Remap source_block_id
                c.selected_text,
                c.text_start_offset,
                c.text_end_offset,
                NULL,  -- Temporarily NULL, will update
                '[]'::json,  -- Temporarily empty, will update
                c.meta_data,
                c.is_demo,
                NOW()
            FROM conversations c
            JOIN conv_map cm ON cm.old_id = c.id
            LEFT JOIN block_map bm ON bm.old_id = c.source_block_id
            WHERE c.document_id = source_document_id;

            -- Step 6: Clone messages with remapped references
            INSERT INTO messages (
                id, conversation_id, parent_id, version,
                role, content, active_child_id,
                user_id, document_id, block_id,
                meta_data,
                created_at
            )
            SELECT 
                mm.new_id,
                cm.new_id,  -- Remap conversation_id
                pm.new_id,  -- Remap parent_id
                m.version,
                m.role,
                m.content,
                acm.new_id,  -- Remap active_child_id
                target_user_id,
                new_document_id,  -- Always set document_id for cloned messages
                bm.new_id,  -- Remap block_id
                -- Handle meta_data remapping - simplified for JSON type
                CASE 
                    WHEN m.meta_data IS NULL OR m.meta_data::text = '{}'::text THEN 
                        m.meta_data
                    WHEN m.meta_data::jsonb ? 'generated_summaries' THEN
                        json_build_object(
                            'generated_summaries',
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'note_id', summary->>'note_id',
                                        'block_id', COALESCE(
                                            (SELECT new_id FROM block_map WHERE old_id = summary->>'block_id'),
                                            summary->>'block_id'
                                        ),
                                        'summary_content', summary->>'summary_content',
                                        'summary_range', json_build_object(
                                            'from_message_id', COALESCE(
                                                (SELECT new_id FROM msg_map WHERE old_id = summary->'summary_range'->>'from_message_id'),
                                                summary->'summary_range'->>'from_message_id'
                                            ),
                                            'message_count', summary->'summary_range'->>'message_count',
                                            'topic', summary->'summary_range'->>'topic'
                                        ),
                                        'created_at', summary->>'created_at'
                                    )
                                )
                                FROM json_array_elements(m.meta_data->'generated_summaries') AS summary
                            )
                        )
                    ELSE m.meta_data
                END,
                NOW()
            FROM messages m
            JOIN msg_map mm ON mm.old_id = m.id
            JOIN conversations c ON m.conversation_id = c.id
            JOIN conv_map cm ON cm.old_id = c.id
            LEFT JOIN msg_map pm ON pm.old_id = m.parent_id
            LEFT JOIN msg_map acm ON acm.old_id = m.active_child_id
            LEFT JOIN block_map bm ON bm.old_id = m.block_id
            WHERE c.document_id = source_document_id;

            -- Step 7: Update conversations with root_message_id and active_thread_ids
            UPDATE conversations c
            SET 
                root_message_id = (
                    SELECT mm.new_id 
                    FROM conversations old_c
                    JOIN msg_map mm ON mm.old_id = old_c.root_message_id
                    WHERE old_c.id = cm.old_id
                ),
                active_thread_ids = (
                    SELECT COALESCE(
                        (
                            SELECT json_agg(mm.new_id ORDER BY idx)
                            FROM conversations old_c,
                                 json_array_elements_text(old_c.active_thread_ids) WITH ORDINALITY AS elem(old_msg_id, idx)
                            JOIN msg_map mm ON mm.old_id = elem.old_msg_id
                            WHERE old_c.id = cm.old_id
                        ),
                        '[]'::json
                    )
                )
            FROM conv_map cm
            WHERE c.id = cm.new_id;

            -- Clean up temp tables
            DROP TABLE IF EXISTS doc_map, page_map, block_map, conv_map, msg_map;

            RETURN new_document_id;
        END;
        $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS clone_document_with_everything(VARCHAR, VARCHAR);")
