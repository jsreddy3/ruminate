"""Test what Marker returns for italics in test_sup.pdf"""
import asyncio
import json
from infrastructure.document_processing.marker_client import MarkerClient
from pathlib import Path

async def test_marker():
    """Test what Marker returns for test_sup.pdf, focusing on italics"""
    client = MarkerClient()
    
    test_pdf = Path("tests/test_sup.pdf")
    if not test_pdf.exists():
        print("tests/test_sup.pdf not found!")
        return
    
    print(f"Processing {test_pdf}...\n")
    
    # Read the PDF
    with open(test_pdf, "rb") as f:
        content = f.read()
    
    # Process with Marker
    try:
        response = await client.process_document(content, "test_sup.pdf")
        
        if response.pages:
            for i, page in enumerate(response.pages):
                blocks = page.get('blocks', [])
                
                for j, block in enumerate(blocks):
                    html = block.get('html', '')
                    
                    # Look for the ENGLISH dictionary block specifically
                    if 'ENGLISH' in html and 'uncomfortable' in html:
                        print(f"\n=== FOUND ENGLISH BLOCK (Block {j}) ===")
                        print(f"Block Type: {block.get('block_type')}")
                        print(f"\nRAW HTML:")
                        print(repr(html))
                        print(f"\nFORMATTED HTML:")
                        print(html)
                        
                        # Check for italic tags
                        print(f"\n--- ITALIC TAG ANALYSIS ---")
                        if '<i>' in html or '</i>' in html:
                            print("✓ Found <i> tags")
                        if '<em>' in html or '</em>' in html:
                            print("✓ Found <em> tags")
                        if 'italic' in html.lower():
                            print("✓ Found 'italic' in HTML")
                        if not ('<i>' in html or '<em>' in html):
                            print("✗ NO italic tags found!")
                        
                        # Show what should be italicized
                        print("\n--- EXPECTED ITALICS ---")
                        print("Should be italic: 'uncomfortable, uneasy, gloomy, dismal, uncanny, ghastly'")
                        print("Should be italic: '(of a house)'")
                        print("Should be italic: '(of a person)'")
                    
                    # Also check any block that might have italic content
                    elif '<i>' in html or '<em>' in html:
                        print(f"\n=== Block {j} with italics ===")
                        print(f"HTML: {html}")
                
                # Summary at the end
                print(f"\n=== SUMMARY FOR PAGE {i} ===")
                italic_blocks = [j for j, block in enumerate(blocks) if '<i>' in block.get('html', '') or '<em>' in block.get('html', '')]
                print(f"Total blocks: {len(blocks)}")
                print(f"Blocks with italic tags: {len(italic_blocks)}")
                if italic_blocks:
                    print(f"Italic block numbers: {italic_blocks}")
                else:
                    print("NO blocks contain italic tags!")
                        
    except Exception as e:
        print(f"Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_marker())