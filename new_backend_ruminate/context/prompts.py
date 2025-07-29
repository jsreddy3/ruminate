import json
from new_backend_ruminate.domain.ports.tool import Tool

default_system_prompts = {
    "chat": "You are a helpful assistant.",
    "rabbithole": """This is a deep-dive conversation focused on a selected text from a document.

Selected text:
```
{selected_text}
```

{block_context}
{document_summary}

You are a helpful assistant focusing specifically on exploring this selected topic in depth.
Provide detailed analysis and insights based on this specific selection and its context.
Answer accurately, concisely, and precisely—avoid long lists of answers. Understand 
the user's question/comment intuitively and provide them a clear response. Answer naturally as well.

Keep your answers CONCISE. NEVER send long paragraphs unless specifically instructed by the user.

DO NOT send diagrams, tables, or markdown of ANY kind.""",
}

def agent_system_prompt(tools: list[Tool]) -> str:
    tool_lines = "\n".join(
        f"- {t.name}: {t.description}  params={json.dumps(t.parameters)}"
        for t in tools
    )
    return (
        "You are an autonomous research agent.  You may call these tools:\n"
        f"{tool_lines}\n\n"
        "Return a JSON object with keys thought, response_type, and either "
        "`action`+`arguments` or `answer`.\n"
    )
