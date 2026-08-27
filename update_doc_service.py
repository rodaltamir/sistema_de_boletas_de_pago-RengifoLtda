import os, re

filepath = r"backend\app\services\document_service.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

helper = '''
    @staticmethod
    def _set_cell_value(ws, coord, value):
        for merged_range in ws.merged_cells.ranges:
            if coord in merged_range:
                ws.cell(row=merged_range.min_row, column=merged_range.min_col).value = value
                return
        ws[coord] = value
'''

if "_set_cell_value" not in content:
    content = content.replace("class DocumentService:", "class DocumentService:\n" + helper)

# Replace ws['X9'] = ... with DocumentService._set_cell_value(ws, 'X9', ...)
content = re.sub(r"ws\['([A-Z0-9]+)'\]\s*=\s*(.*)", r"DocumentService._set_cell_value(ws, '\1', \2)", content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated document_service.py with robust cell assignment")