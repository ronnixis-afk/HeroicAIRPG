import os
import re

directories_to_check = [
    'd:/Eric/App/Heroic AI RPG/heroic-ai-rpg/src/services',
    'd:/Eric/App/Heroic AI RPG/heroic-ai-rpg/src/hooks/social',
    'd:/Eric/App/Heroic AI RPG/heroic-ai-rpg/src/hooks/combat/resolution'
]

files = []
for d in directories_to_check:
    for root, _, fs in os.walk(d):
        for f in fs:
            if f.endswith('.ts') or f.endswith('.tsx'):
                files.append(os.path.join(root, f))

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find anywhere thinkingBudget: \d+ appears and replace it.
    new_content = re.sub(r'thinkingBudget:\s*(1536|10240)\b', 'thinkingBudget: -1', content)

    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print('Updated', file_path)

for file_path in files:
    process_file(file_path)
