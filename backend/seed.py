import asyncio
from database import AsyncSessionLocal
from models import Seat, SeatStatus

async def seed_seats():
    async with AsyncSessionLocal() as db:
        # Create 10 dummy seats
        for i in range(1, 11):
            new_seat = Seat(status=SeatStatus.available)
            db.add(new_seat)
        await db.commit()
        print("10 seats successfully added to the database!")

if __name__ == "__main__":
    asyncio.run(seed_seats())
