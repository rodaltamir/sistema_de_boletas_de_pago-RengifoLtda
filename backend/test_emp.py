from app.db.session import engine; from sqlalchemy import text; 
with engine.connect() as conn:
    res = conn.execute(text('SELECT * FROM rengifoltda.employees'))
    print(res.fetchall())
