import bcrypt
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User

def init_db():
    db: Session = SessionLocal()
    
    email = "audirengifo.ltda@gmail.com"
    existing_user = db.query(User).filter(User.email == email).first()
    
    if not existing_user:
        salt = bcrypt.gensalt()
        hashed_pwd = bcrypt.hashpw(b"boletaspago2026", salt).decode("utf-8")
        
        user = User(
            name="Admin Rengifo",
            username="audirengifo",
            email=email,
            hashed_password=hashed_pwd,
            is_superuser=True
        )
        db.add(user)
        db.commit()
        print(f"Usuario {email} inyectado exitosamente con privilegios de administrador.")
    else:
        print(f"El usuario {email} ya existe en la base de datos.")
    
    db.close()

if __name__ == "__main__":
    init_db()
