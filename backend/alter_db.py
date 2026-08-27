from app.db.session import engine; from sqlalchemy import text;
with engine.connect() as conn:
    conn.execute(text('ALTER TABLE rengifoltda.employees ADD COLUMN IF NOT EXISTS ext_ci VARCHAR(20)'))
    conn.commit()
