import re

with open('frontend/src/app/(panel)/empleados/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Employee interface
content = re.sub(r'apellidos: string;', 'apellido_paterno: string;\n  apellido_materno: string;', content)

# 2. Update formData state
content = re.sub(r'apellidos: "",', 'apellido_paterno: "",\n    apellido_materno: "",', content)
content = re.sub(r'apellidos: emp\.apellidos', 'apellido_paterno: emp.apellido_paterno,\n      apellido_materno: emp.apellido_materno || ""', content)

# 3. Search logic
content = re.sub(r'emp\.apellidos\.toLowerCase\(\)\.includes', '(emp.apellido_paterno + " " + (emp.apellido_materno || "")).toLowerCase().includes', content)

# 4. Table view
content = re.sub(r'\{\$\{emp\.apellidos\} \$\{emp\.nombres\}\.toUpperCase\(\)\}', '{${emp.apellido_paterno}  .trim().replace(/  +/g, " ").toUpperCase()}', content)

# 5. The search bar
content = re.sub(r'className="w-full pl-12 pr-4 py-2\.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"', 'className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"', content)

# 6. Form fields
form_apellidos = r'''<div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Apellidos \*</label>
                      <input 
                        type="text" required placeholder="Apellidos completos"
                        value={formData.apellidos} onChange={e => setFormData({...formData, apellidos: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>'''

form_new = r'''<div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Ap. Paterno *</label>
                      <input 
                        type="text" required placeholder="Paterno"
                        value={formData.apellido_paterno} onChange={e => setFormData({...formData, apellido_paterno: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Ap. Materno</label>
                      <input 
                        type="text" placeholder="Materno (Opcional)"
                        value={formData.apellido_materno} onChange={e => setFormData({...formData, apellido_materno: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>'''

content = content.replace(form_apellidos, form_new)

# Modify grid cols for Fila 2 to be 3 columns instead of 2 (since we now have Nombres, Paterno, Materno)
content = content.replace('<div className="grid grid-cols-1 md:grid-cols-2 gap-6">', '<div className="grid grid-cols-1 md:grid-cols-3 gap-6">', 1)

with open('frontend/src/app/(panel)/empleados/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)