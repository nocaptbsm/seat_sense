import asyncio
from database import AsyncSessionLocal
from models import Student

async def seed_student():
    async with AsyncSessionLocal() as db:
        # Create a dummy student with ID 1042
        new_student = Student(
            student_id=1042,
            name="John Doe",
            email="john.doe@example.com",
            phone="555-0100"
        )
        db.add(new_student)
        await db.commit()
        print("Student #1042 (John Doe) successfully added to the database!")

if __name__ == "__main__":
    asyncio.run(seed_student())
