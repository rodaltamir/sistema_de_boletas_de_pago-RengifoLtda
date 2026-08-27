import os
import re

files = [
    'frontend/src/app/(panel)/boletas/page.tsx',
    'frontend/src/app/(panel)/planillas/page.tsx',
    'frontend/src/app/(panel)/prefiniquitos/page.tsx'
]

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Update Employee interface
    content = re.sub(r'apellidos: string;', 'apellido_paterno: string;\n  apellido_materno: string;', content)
    
    # Update ${emp.apellidos}  -> ${emp.apellido_paterno}  
    content = re.sub(
        r'\{\$\{emp\.apellidos\} \$\{emp\.nombres\}\.toUpperCase\(\)\}', 
        '{${emp.apellido_paterno}  .trim().replace(/  +/g, " ").toUpperCase()}', 
        content
    )
    
    # In prefiniquitos, it might be {emp.apellidos} {emp.nombres} directly without string template
    content = re.sub(
        r'\{emp\.apellidos\} \{emp\.nombres\}', 
        '{${emp.apellido_paterno}  .trim().replace(/  +/g, " ")}', 
        content
    )
    
    # For selectedEmp?.apellidos
    content = re.sub(
        r'\{selectedEmp\?\.apellidos\} \{selectedEmp\?\.nombres\}',
        '{${selectedEmp?.apellido_paterno || ""}  .trim().replace(/  +/g, " ")}',
        content
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Updated frontend files")