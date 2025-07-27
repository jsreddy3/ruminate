-- Fix migration issues
DROP TABLE IF EXISTS alembic_version CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TYPE IF EXISTS conversationtype CASCADE;
DROP TYPE IF EXISTS role CASCADE;

-- Create correct enum types
CREATE TYPE conversationtype AS ENUM ('CHAT', 'AGENT');
CREATE TYPE role AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- Create alembic version table
CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Mark all migrations as complete
INSERT INTO alembic_version (version_num) VALUES ('b61c9cfa6140');