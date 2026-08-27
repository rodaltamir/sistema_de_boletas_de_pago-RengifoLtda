content = r'''# Sistema de Gestión de Boletas de Pago y Planillas

Sistema integral Multi-Tenant para la gestión de recursos humanos, cálculo de planillas, emisión de boletas de pago y cálculo de prefiniquitos (beneficios sociales) adaptado a la **Ley General del Trabajo de Bolivia**. 

## 🚀 Características Principales

* **Arquitectura Multi-Tenant:** Capacidad de gestionar múltiples empresas (Razones Sociales) dentro de una misma instalación, manteniendo las bases de datos y configuraciones completamente aisladas.
* **Gestión de Empleados:** Registro completo de trabajadores (datos personales, ingreso, cargo, sueldo básico).
* **Boletas de Pago Automatizadas:** Cálculo inteligente que incluye:
  * Ingresos (Haber básico, Bono de antigüedad según SMN).
  * Descuentos (AFP 12.71%, RC-IVA, Aportes Solidarios).
  * Horas extras y recargos.
* **Planillas Mensuales:** Generación y visualización consolidada de los pagos de todos los empleados en un mes determinado.
* **Prefiniquitos y Desvinculaciones:** Motor de cálculo exacto de beneficios sociales que contempla Desahucio, Indemnización, Aguinaldos y Vacaciones proporcionales para finiquitar a un empleado.
* **Interfaz de Usuario (UI):** Diseño moderno estilo *Glassmorphism*, 100% responsivo y construido con las mejores prácticas web.

---

## 📸 Capturas de Pantalla (Screenshots)

*Para añadir capturas reales de tu sistema, guarda las imágenes en la carpeta `docs/screenshots/` (créala si no existe en la raíz del proyecto) y guárdalas con los nombres indicados abajo.*

### Panel de Control (Dashboard)
![Panel de Control](./docs/screenshots/dashboard.png)
*Vista principal y selección de la empresa activa.*

### Gestión de Empleados
![Empleados](./docs/screenshots/empleados.png)
*Lista de empleados, estado activo/inactivo y formulario de registro.*

### Emisión de Boletas de Pago
![Boletas](./docs/screenshots/boletas.png)
*Cálculo desglosado de ingresos y deducciones.*

### Prefiniquitos (Liquidación)
![Prefiniquitos](./docs/screenshots/prefiniquitos.png)
*Cálculo de liquidación de beneficios sociales.*

---

## 🛠️ Stack Tecnológico

**Frontend:**
* [Next.js 14](https://nextjs.org/) (React Framework)
* [Tailwind CSS](https://tailwindcss.com/) (Estilos)
* [Framer Motion](https://www.framer.com/motion/) (Animaciones fluidas)
* [Lucide React](https://lucide.dev/) (Íconos)

**Backend:**
* [FastAPI](https://fastapi.tiangolo.com/) (Framework asíncrono y ultra rápido)
* [Python 3.10+](https://www.python.org/)
* [SQLAlchemy](https://www.sqlalchemy.org/) (ORM y manejo dinámico de esquemas Multi-Tenant)
* [PostgreSQL](https://www.postgresql.org/) (Base de Datos Relacional)

---

## ⚙️ Requisitos Previos

Antes de instalar, asegúrate de tener:
1. **Node.js** (v18 o superior).
2. **Python** (v3.10 o superior).
3. **PostgreSQL** instalado y ejecutándose localmente.

---

## 📦 Instalación y Configuración (Entorno de Desarrollo)

### 1. Configurar la Base de Datos (PostgreSQL)
Asegúrate de crear una base de datos principal en PostgreSQL. Por defecto, el sistema intentará conectarse a `postgresql://postgres:postgres@localhost/rengifo_payroll`.
*Puedes cambiar estas credenciales en el archivo `.env` del backend.*

### 2. Levantar el Backend (FastAPI)

Abre una terminal y navega a la carpeta `backend/`:

```bash
cd backend
# 1. Crear entorno virtual (opcional pero recomendado)
python -m venv venv
venv\Scripts\activate  # En Windows

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Ejecutar las migraciones (opcional si usas auto-create)
# python -m alembic upgrade head

# 4. Iniciar el servidor de desarrollo
uvicorn main:app --reload --port 8000
```
*El backend estará disponible en `http://localhost:8000`.*

### 3. Levantar el Frontend (Next.js)

Abre otra terminal y navega a la carpeta `frontend/`:

```bash
cd frontend

# 1. Instalar dependencias de Node
npm install

# 2. Iniciar el servidor de desarrollo
npm run dev
```
*El frontend estará disponible en `http://localhost:3000`.*

---

## 📚 Estructura del Proyecto

```text
sistema_de_boletos_de_pago-rengifo/
│
├── backend/                  # API en Python (FastAPI)
│   ├── app/
│   │   ├── api/              # Rutas (Endpoints)
│   │   ├── models/           # Modelos de SQLAlchemy
│   │   ├── schemas/          # Esquemas Pydantic (Validación)
│   │   └── services/         # Lógica de negocio (Cálculos de ley)
│   └── main.py               # Punto de entrada del Backend
│
└── frontend/                 # Aplicación Web en React (Next.js)
    ├── public/               # Assets estáticos (imágenes, SVGs)
    └── src/
        └── app/
            ├── (panel)/      # Módulos protegidos (Empleados, Boletas, etc.)
            ├── auth/         # Pantallas de Login
            └── globals.css   # Estilos globales y Tailwind
```

---
*Desarrollado para facilitar la gestión contable y laboral en Bolivia.*
'''
with open("README.md", "w", encoding="utf-8") as f:
    f.write(content)