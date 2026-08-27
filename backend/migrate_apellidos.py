import os
import sys

# Agrega la ruta base para importar de 'app'
sys.path.insert(0, os.path.abspath('backend'))

from sqlalchemy import text
from app.db.session import engine
from app.models.tenant import Tenant

def migrate():
    with engine.connect() as conn:
        tenants = conn.execute(text("SELECT schema_name FROM tenants")).fetchall()
        for t in tenants:
            schema = t[0]
            print(f"Migrating schema: {schema}")
            
            # Verificar si la columna apellidos existe
            try:
                # Agregar columnas nuevas
                conn.execute(text(f"ALTER TABLE {schema}.employees ADD COLUMN apellido_paterno VARCHAR(100) DEFAULT ''"))
                conn.execute(text(f"ALTER TABLE {schema}.employees ADD COLUMN apellido_materno VARCHAR(100) DEFAULT ''"))
                
                # Migrar datos (split simple por espacio)
                # OJO: Si tienen 3 palabras es complejo, pero pondremos la primera en paterno y el resto en materno
                conn.execute(text(f'''
                    UPDATE {schema}.employees 
                    SET 
                        apellido_paterno = split_part(apellidos, ' ', 1),
                        apellido_materno = substring(apellidos from position(' ' in apellidos) + 1)
                    WHERE apellidos IS NOT NULL AND position(' ' in apellidos) > 0;
                '''))
                conn.execute(text(f'''
                    UPDATE {schema}.employees 
                    SET 
                        apellido_paterno = apellidos,
                        apellido_materno = ''
                    WHERE apellidos IS NOT NULL AND position(' ' in apellidos) = 0;
                '''))
                
                # Dropear columna antigua
                conn.execute(text(f"ALTER TABLE {schema}.employees DROP COLUMN apellidos"))
                
                conn.commit()
                print(f"Migrated {schema} successfully.")
            except Exception as e:
                print(f"Error in {schema}: {e}")
                conn.rollback()

if __name__ == '__main__':
    migrate()