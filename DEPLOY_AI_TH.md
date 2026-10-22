Today Mood + Mood Companion (ทดลอง)

1) สำรองเว็บเดิมไว้ก่อน
2) แตก ZIP นี้ในเครื่อง
3) เปิด config.js แล้วคัดลอกค่า SUPABASE_URL และ SUPABASE_ANON_KEY จาก config.js ของเว็บเดิมมาแทนค่าตัวอย่างในไฟล์นี้ (ห้ามใช้ service_role key)
4) โฟลเดอร์นี้ต้อง deploy ด้วย Netlify ที่รองรับ Functions ไม่ใช่การอัปโหลดไฟล์เดี่ยวแบบ Netlify Drop อย่างเดียว
5) วิธีง่ายสุดคือสร้าง GitHub repository ส่วนตัว อัปโหลดไฟล์/โฟลเดอร์ทั้งหมดนี้ แล้วใน Netlify เลือก Add new site > Import an existing project และเชื่อม repository นั้น
6) ใน Netlify site settings > Environment variables ตรวจสอบว่ามี OPENAI_API_KEY เป็นตัวแปรฝั่ง server อยู่แล้ว จากนั้น trigger deploy ใหม่
7) ทดสอบล็อกอินและบันทึกอารมณ์เดิมก่อน แล้วทดลอง Mood Companion

ความเป็นส่วนตัว: Function นี้ส่งเฉพาะข้อความที่ผู้ใช้พิมพ์ไป OpenAI ไม่ส่งอีเมล, user ID หรือประวัติ mood อัตโนมัติ ไม่บันทึกบทสนทนาในฐานข้อมูลโดยโค้ดนี้ แต่ผู้ให้บริการอาจประมวลผลข้อมูลตามนโยบายของตน หลีกเลี่ยงการใส่ข้อมูลระบุตัวตน

หมายเหตุ: อย่า commit ไฟล์ .env หรือ secret API key ลง GitHub ห้ามใส่ OPENAI_API_KEY ใน config.js/app.js
