import bcrypt

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

from app.db.session import SessionLocal
from app.models.user import User

db = SessionLocal()
user = db.query(User).filter_by(email="audirengifo.ltda@gmail.com").first()
if user:
    user.hashed_password = get_password_hash("boletas26")
    user.is_superuser = True
    db.commit()
    print("Admin user updated")
else:
    new_user = User(
        name="Administrador Rengifo",
        username="admin_rengifo",
        email="audirengifo.ltda@gmail.com",
        hashed_password=get_password_hash("boletas26"),
        is_superuser=True
    )
    db.add(new_user)
    db.commit()
    print("Admin user created")
