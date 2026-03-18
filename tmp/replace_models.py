import os
import re

src_dir = 'd:/Eric/App/Heroic AI RPG/heroic-ai-rpg/src/services'
files = [os.path.join(src_dir, f) for f in os.listdir(src_dir) if f.endswith('.ts') or f.endswith('.tsx')]

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    def repl(m):
        block = m.group(0)
        
        # Low thinking models
        if 'gemini-flash-lite-latest' in block or 'gemini-3.0-flash-lite' in block or 'gemini-2.5-flash-lite' in block:
            block = re.sub(r"'gemini-(?:flash-lite-latest|3\.0-flash-lite|2\.5-flash-lite)'", "'gemini-3.1-flash-lite'", block)
            if 'thinkingBudget' in block:
                block = re.sub(r'thinkingBudget:\s*\d+', 'thinkingBudget: 0', block)
            
        # High thinking models
        elif 'gemini-3-flash-preview' in block or 'gemini-3-flash' in block:
            block = re.sub(r"'gemini-(?:3-flash-preview|3-flash)'", "'gemini-3.1-flash-lite'", block)
            if 'thinkingBudget' in block:
                block = re.sub(r'thinkingBudget:\s*\d+', 'thinkingBudget: 4000', block)
            else:
                if 'config: {' in block:
                    block = block.replace('config: {', 'config: {\n                thinkingConfig: { thinkingBudget: 4000 },')
                else:
                    # Inject config entirely after model: '...'
                    block = re.sub(r"(model:\s*'gemini-3\.1-flash-lite',)", r"\1\n            config: { thinkingConfig: { thinkingBudget: 4000 } },", block)
                
        return block

    # We match await ai.models.generateContent({ ... }) blocks or similar
    new_content = re.sub(r'ai\.models\.generateContent\(\{[\s\S]*?\}\)', repl, content)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print('Updated', file_path)

for file_path in files:
    process_file(file_path)
