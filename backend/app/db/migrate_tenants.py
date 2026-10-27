import logging
from sqlalchemy import text
from app.db.session import engine

logger = logging.getLogger(__name__)

def migrate_tenants():
    """
    Asegura que todos los esquemas de tenants tengan las tablas requeridas,
    columnas y configuraciones más recientes.
    """
    try:
        with engine.begin() as conn:
            # Asegurar columnas en public.tenants
            conn.execute(text("ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS caja_salud VARCHAR(100) DEFAULT 'Caja Petrolera de Salud'"))
            conn.execute(text("ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS has_eventuales BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS has_vacaciones BOOLEAN DEFAULT FALSE"))

            result = conn.execute(text("SELECT schema_name FROM public.tenants WHERE is_active = true"))
            tenants = [row[0] for row in result.fetchall()]
            
            for schema in tenants:
                logger.info(f"Verificando esquema tenant: {schema}")
                
                # 1. Crear tabla departments si no existe
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS "{schema}".departments (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        account_type VARCHAR(50) DEFAULT 'MANO_DE_OBRA',
                        description VARCHAR(255),
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                '''))
                
                # 2. Agregar columnas a employees si no existen
                conn.execute(text(f'''
                    ALTER TABLE "{schema}".employees 
                    ADD COLUMN IF NOT EXISTS department_id INTEGER,
                    ADD COLUMN IF NOT EXISTS departamento VARCHAR(100),
                    ADD COLUMN IF NOT EXISTS tipo_contrato VARCHAR(50) DEFAULT 'permanente'
                '''))
                
                # 3. Crear tabla accounting_records si no existe
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS "{schema}".accounting_records (
                        id SERIAL PRIMARY KEY,
                        month INTEGER NOT NULL,
                        year INTEGER NOT NULL,
                        payroll_id INTEGER,
                        caja_banco_name VARCHAR(100) DEFAULT 'Caja Moneda Nacional',
                        fecha_pago_gestora VARCHAR(50),
                        fecha_pago_caja VARCHAR(50),
                        fecha_pago_min_trabajo VARCHAR(50),
                        data_json TEXT NOT NULL,
                        is_customized BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                '''))
                
                # 4. Crear tabla patronal_details si no existe
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS "{schema}".patronal_details (
                        id SERIAL PRIMARY KEY,
                        payroll_id INTEGER,
                        employee_id INTEGER NOT NULL,
                        month INTEGER NOT NULL,
                        year INTEGER NOT NULL,
                        total_ganado NUMERIC(12, 2) NOT NULL DEFAULT 0,
                        cns NUMERIC(12, 2) NOT NULL DEFAULT 0,
                        afp NUMERIC(12, 2) NOT NULL DEFAULT 0,
                        fonvi NUMERIC(12, 2) NOT NULL DEFAULT 0,
                        aps NUMERIC(12, 2) NOT NULL DEFAULT 0,
                        total_aportes NUMERIC(12, 2) NOT NULL DEFAULT 0,
                        provision_aguinaldo NUMERIC(12, 2) NOT NULL DEFAULT 0,
                        provision_indemnizacion NUMERIC(12, 2) NOT NULL DEFAULT 0,
                        total_provisiones NUMERIC(12, 2) NOT NULL DEFAULT 0,
                        total_carga_patronal NUMERIC(12, 2) NOT NULL DEFAULT 0,
                        is_customized BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                '''))

                # 5. Crear tablas de aguindaldos si no existen
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS "{schema}".aguinaldo_payrolls (
                        id SERIAL PRIMARY KEY,
                        year INTEGER NOT NULL,
                        is_closed BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                '''))

                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS "{schema}".aguinaldo_slips (
                        id SERIAL PRIMARY KEY,
                        aguinaldo_payroll_id INTEGER NOT NULL,
                        employee_id INTEGER NOT NULL,
                        haber_basico NUMERIC(12, 2) DEFAULT 0,
                        bono_antiguedad NUMERIC(12, 2) DEFAULT 0,
                        bono_produccion NUMERIC(12, 2) DEFAULT 0,
                        subsidio_frontera NUMERIC(12, 2) DEFAULT 0,
                        trabajo_extraordinario NUMERIC(12, 2) DEFAULT 0,
                        pago_dominical NUMERIC(12, 2) DEFAULT 0,
                        otros_bonos NUMERIC(12, 2) DEFAULT 0,
                        promedio_total_ganado NUMERIC(12, 2) DEFAULT 0,
                        meses_trabajados NUMERIC(5, 2) DEFAULT 12,
                        total_aguinaldo NUMERIC(12, 2) DEFAULT 0,
                        is_customized BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                '''))

                # 6. Crear tablas de planilla de eventuales si no existen
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS "{schema}".eventual_payrolls (
                        id SERIAL PRIMARY KEY,
                        month INTEGER NOT NULL,
                        year INTEGER NOT NULL,
                        is_closed BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                '''))

                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS "{schema}".eventual_payslips (
                        id SERIAL PRIMARY KEY,
                        eventual_payroll_id INTEGER NOT NULL,
                        employee_id INTEGER NOT NULL,
                        dias_pagados INTEGER DEFAULT 30,
                        horas_pagadas NUMERIC(5, 2) DEFAULT 8,
                        haber_basico NUMERIC(12, 2) NOT NULL,
                        bono_antiguedad NUMERIC(12, 2) DEFAULT 0,
                        bono_produccion NUMERIC(12, 2) DEFAULT 0,
                        subsidio_frontera NUMERIC(12, 2) DEFAULT 0,
                        trabajo_extraordinario NUMERIC(12, 2) DEFAULT 0,
                        pago_dominical NUMERIC(12, 2) DEFAULT 0,
                        otros_bonos NUMERIC(12, 2) DEFAULT 0,
                        subsidio_natalidad NUMERIC(12, 2) DEFAULT 0,
                        total_ganado NUMERIC(12, 2) NOT NULL,
                        aporte_gestora NUMERIC(12, 2) NOT NULL,
                        rc_iva NUMERIC(12, 2) DEFAULT 0,
                        anticipos NUMERIC(12, 2) DEFAULT 0,
                        faltas NUMERIC(12, 2) DEFAULT 0,
                        otros_descuentos NUMERIC(12, 2) DEFAULT 0,
                        total_descuentos NUMERIC(12, 2) NOT NULL,
                        liquido_pagable NUMERIC(12, 2) NOT NULL,
                        is_customized BOOLEAN DEFAULT FALSE
                    )
                '''))

                conn.execute(text(f'''
                    ALTER TABLE "{schema}".eventual_payslips
                    ADD COLUMN IF NOT EXISTS faltas NUMERIC(12, 2) DEFAULT 0;
                '''))

                # 7. Crear tabla de control de vacaciones si no existe
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS "{schema}".vacation_records (
                        id SERIAL PRIMARY KEY,
                        employee_id INTEGER NOT NULL,
                        tipo VARCHAR(50) NOT NULL,
                        fecha_inicio DATE NOT NULL,
                        fecha_fin DATE NOT NULL,
                        fecha_solicitud DATE,
                        dias NUMERIC(5, 1) NOT NULL,
                        fechas_detalle TEXT,
                        motivo VARCHAR(255),
                        gestion INTEGER NOT NULL,
                        aprobado_por VARCHAR(100),
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                    ALTER TABLE "{schema}".vacation_records ADD COLUMN IF NOT EXISTS fecha_solicitud DATE;
                '''))
                
                # 8. Sembrar departamentos predeterminados si no existen
                dept_res = conn.execute(text(f'SELECT COUNT(*) FROM "{schema}".departments'))
                dept_count = dept_res.scalar()
                
                if dept_count == 0:
                    conn.execute(text(f'''
                        INSERT INTO "{schema}".departments (name, account_type, description)
                        VALUES 
                            ('Administración', 'ADMINISTRACION', 'Personal directivo, administrativo y de gestión'),
                            ('Mano de Obra / Producción', 'MANO_DE_OBRA', 'Personal operativo, técnico y de planta')
                    '''))
                
                depts = conn.execute(text(f'SELECT id, name, account_type FROM "{schema}".departments')).fetchall()
                adm_dept = next((d for d in depts if d[2] == "ADMINISTRACION"), None)
                mo_dept = next((d for d in depts if d[2] == "MANO_DE_OBRA"), None) or (depts[0] if depts else None)
                
                if adm_dept and mo_dept:
                    conn.execute(text(f'''
                        UPDATE "{schema}".employees
                        SET department_id = {adm_dept[0]}, departamento = '{adm_dept[1]}'
                        WHERE department_id IS NULL AND (
                            LOWER(ocupacion) LIKE '%admin%' OR 
                            LOWER(ocupacion) LIKE '%geren%' OR 
                            LOWER(ocupacion) LIKE '%conta%' OR 
                            LOWER(ocupacion) LIKE '%secret%' OR
                            LOWER(ocupacion) LIKE '%asist%'
                        )
                    '''))
                    
                    conn.execute(text(f'''
                        UPDATE "{schema}".employees
                        SET department_id = {mo_dept[0]}, departamento = '{mo_dept[1]}'
                        WHERE department_id IS NULL
                    '''))
                    
        print("Migracion de tenants completada exitosamente.")
    except Exception as e:
        print(f"Error ejecutando migracion de tenants: {e}")
