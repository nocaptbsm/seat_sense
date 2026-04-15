import asyncio
from sqlalchemy import select, update
from database import AsyncSessionLocal
from models import Student

async def update_students():
    async with AsyncSessionLocal() as db:
        
        # 1. Update John Doe (1042) to Abhishek Ranjan
        result = await db.execute(select(Student).where(Student.student_id == 1042))
        student_1042 = result.scalars().first()
        
        if student_1042:
            student_1042.name = "Abhishek Ranjan"
            student_1042.email = "abhishek@example.com"
            db.add(student_1042)
            print("✅ Successfully updated student 1042 to Abhishek Ranjan")
        else:
            print("⚠️ Could not find Student 1042 to update.")

        # 2. Add Adarsh Kumar (1043)
        existing_1043 = await db.execute(select(Student).where(Student.student_id == 1043))
        if not existing_1043.scalars().first():
            new_student = Student(
                student_id=1043,
                name="Adarsh Kumar",
                email="adarsh@example.com",
                phone="555-0200"
            )
            db.add(new_student)
            print("✅ Successfully added new student: Adarsh Kumar (ID: 1043)")
        else:
            print("⚠️ Adarsh Kumar (ID 1043) already exists!")

        # Commit changes to the database
        await db.commit()

if __name__ == "__main__":
    asyncio.run(update_students())
