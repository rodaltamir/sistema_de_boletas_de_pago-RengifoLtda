from app.db.session import engine
from app.models.user import User
from app.db.base_class import Base

Base.metadata.create_all(bind=engine)
print('Tables created')
