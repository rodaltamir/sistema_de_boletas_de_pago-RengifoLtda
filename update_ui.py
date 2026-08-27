import os

with open('frontend/src/app/(panel)/boletas/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

word_btn = '<button className="text-xs flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"><File className="w-3 h-3"/> Word</button>'
content = content.replace(word_btn, '')

with open('frontend/src/app/(panel)/boletas/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed word button")