const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const json = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "ใช้ได้เฉพาะ POST" });
  if (!process.env.OPENAI_API_KEY) return json(500, { error: "ยังไม่ได้ตั้งค่า OPENAI_API_KEY ใน Netlify" });
  let body;
  try { body = JSON.parse(request.body || "{}"); } catch { return json(400, { error: "รูปแบบข้อความไม่ถูกต้อง" }); }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const mode = ["listen", "advice", "both"].includes(body.mode) ? body.mode : "both";
  if (!message) return json(400, { error: "พิมพ์ข้อความก่อนนะ" });
  if (message.length > 2000) return json(400, { error: "ข้อความยาวเกินไป (สูงสุด 2,000 ตัวอักษร)" });
  const modeGuide = {
    listen: "เน้นรับฟังและสะท้อนความรู้สึกก่อน อย่ารีบเสนอวิธีแก้ ถามคำถามอ่อนโยนได้ไม่เกินหนึ่งข้อ",
    advice: "ช่วยคิดทางเลือกที่เป็นรูปธรรม 2-3 ข้อ เล็กและทำได้จริง อย่าตัดสินใจแทนผู้ใช้",
    both: "เริ่มจากรับฟังและยอมรับความรู้สึก จากนั้นค่อยเสนอทางเลือกเล็ก ๆ หากเหมาะสม"
  }[mode];
  const instructions = `คุณคือ Mood Companion ของแอป Today Mood พูดภาษาไทยเป็นธรรมชาติ อบอุ่น เคารพผู้ใช้ ไม่ตัดสิน ไม่บังคับให้คิดบวก และไม่อ้างว่าเป็นมนุษย์หรือนักบำบัด ${modeGuide} ตอบกระชับประมาณ 2-5 ประโยค ถ้าไม่แน่ใจให้ถามอย่างอ่อนโยน อย่าวินิจฉัยโรคหรือแนะนำยา อย่ากดดันให้ผู้ใช้เปิดเผยข้อมูลส่วนตัว หากผู้ใช้บอกว่าตกอยู่ในอันตรายทันทีหรืออาจทำร้ายตัวเอง ให้ตอบด้วยความห่วงใย แนะนำให้ติดต่อผู้ใหญ่หรือคนที่ไว้ใจได้ที่อยู่ใกล้ตัวทันที และติดต่อบริการฉุกเฉินในพื้นที่ ไม่ใช้คำพูดตำหนิหรือทำให้รู้สึกผิด`;
  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", instructions, input: message, max_output_tokens: 350 })
    });
    const result = await upstream.json();
    if (!upstream.ok) {
      console.error("OpenAI API error", upstream.status, result?.error?.type || "unknown");
      return json(upstream.status === 429 ? 429 : 502, { error: upstream.status === 429 ? "คำขอถึงขีดจำกัดหรือเครดิต API ไม่พอ ตรวจสอบ Usage/Billing ของ OpenAI" : "บริการ AI ตอบกลับไม่สำเร็จ ตรวจสอบ API key และสิทธิ์การใช้งาน" });
    }
    const reply = (result.output || []).flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text).join("\n").trim();
    if (!reply) return json(502, { error: "AI ยังไม่ได้ส่งข้อความตอบกลับ ลองใหม่อีกครั้ง" });
    return json(200, { reply });
  } catch (error) {
    console.error("Mood Companion request failed", error?.name || "Error");
    return json(502, { error: "เชื่อมต่อบริการ AI ไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
};
