import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from dotenv import load_dotenv
from models import Base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Set it in Railway Variables to your PostgreSQL connection string."
    )

# Normalize URL scheme for asyncpg driver
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif not DATABASE_URL.startswith("postgresql+asyncpg://"):
    raise RuntimeError(
        f"DATABASE_URL must start with postgres://, postgresql://, or postgresql+asyncpg://. Got: {DATABASE_URL[:30]}..."
    )

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    from sqlalchemy import select, text
    from models import Seat, SeatStatus

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed seats 1 and 2 if they don't already exist
    async with AsyncSessionLocal() as session:
        for seat_id in [1, 2]:
            existing = await session.get(Seat, seat_id)
            if not existing:
                # Use raw SQL to insert with explicit seat_id (bypassing autoincrement)
                await session.execute(
                    text(
                        "INSERT INTO seats (seat_id, status) "
                        "VALUES (:id, :status) "
                        "ON CONFLICT (seat_id) DO NOTHING"
                    ),
                    {"id": seat_id, "status": SeatStatus.available.value},
                )
        await session.commit()
        print("Default seats (1 and 2) ensured in database.")
