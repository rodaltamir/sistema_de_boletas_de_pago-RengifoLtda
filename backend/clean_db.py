from app.db.session import engine; from sqlalchemy import text;
with engine.connect() as conn:
    conn.execute(text('DELETE FROM rengifoltda.employees WHERE id=1'))
    conn.commit()
