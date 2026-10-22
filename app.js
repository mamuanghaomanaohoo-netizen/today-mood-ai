(() => {
'use strict';
const cfg = window.TODAY_MOOD_CONFIG || {};
const $ = id => document.getElementById(id);
const MOODS = [
 ['happy','😄','มีความสุข'],['calm','😌','สงบ'],['loved','🥰','อบอุ่น'],['neutral','😐','เฉย ๆ'],
 ['sad','😢','เศร้า'],['angry','😠','โกรธ'],['anxious','😰','กังวล'],['tired','😴','เหนื่อย'],
 ['confused','😕','สับสน'],['excited','🤩','ตื่นเต้น'],['lonely','🥺','เหงา'],['overwhelmed','😵‍💫','หนักใจ']
];
let supabaseClient, user, selectedMood = '', signUpMode = false;
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mood = id => MOODS.find(x=>x[0]===id) || MOODS[3];
function message(text,error=false){$('notice').textContent=text;$('notice').classList.remove('hidden','error');if(error)$('notice').classList.add('error');}
function clearMessage(){$('notice').classList.add('hidden');}
function dateTime(iso){return new Date(iso).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});}
function drawMoods(){
 $('moods').innerHTML=MOODS.map(m=>`<button type="button" class="mood ${selectedMood===m[0]?'active':''}" data-mood="${m[0]}" aria-pressed="${selectedMood===m[0]}"><span class="emoji">${m[1]}</span><span>${m[2]}</span></button>`).join('');
 document.querySelectorAll('[data-mood]').forEach(b=>b.addEventListener('click',()=>{selectedMood=b.dataset.mood;drawMoods()}));
}
function showApp(session){
 user=session?.user||null;
 $('auth').classList.toggle('hidden',!!user);$('app').classList.toggle('hidden',!user);
 if(user){$('who').textContent='เข้าสู่ระบบ: '+user.email;loadProfileAndData();}
}
async function loadProfileAndData(){
 const {data:profile,error}=await supabaseClient.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(error) console.error(error);
 $('admin').classList.toggle('hidden',profile?.role!=='admin');
 await loadEntries();
}
async function loadEntries(){
 $('history').innerHTML='<p class="empty">กำลังโหลดข้อมูล…</p>';
 const {data,error}=await supabaseClient.from('mood_entries').select('id,mood,intensity,reason,note,created_at').order('created_at',{ascending:false}).limit(100);
 if(error){message('โหลดข้อมูลไม่สำเร็จ: '+error.message,true);return;}
 const rows=data||[];$('total').textContent=rows.length;
 $('average').textContent=rows.length?(rows.reduce((a,e)=>a+e.intensity,0)/rows.length).toFixed(1):'—';
 if(!rows.length){$('history').innerHTML='<div class="empty">📔<br>ยังไม่มีบันทึก เริ่มเช็กอินครั้งแรกได้เลย</div>';$('most').textContent='เริ่มบันทึกอารมณ์เพื่อดูภาพรวม';return;}
 const counts={};rows.forEach(e=>counts[e.mood]=(counts[e.mood]||0)+1);
 const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0], tm=mood(top[0]);
 $('most').textContent=`${tm[1]} อารมณ์ที่บันทึกบ่อย: ${tm[2]} (${top[1]} ครั้งในรายการล่าสุด)`;
 $('history').innerHTML=rows.map(e=>{const m=mood(e.mood);return `<article class="entry"><div class="entrytop"><div class="entryemoji">${m[1]}</div><div class="entrymain"><b>${m[2]} · ${e.intensity}/5</b><small>${dateTime(e.created_at)}</small></div><button class="delete" data-delete="${esc(e.id)}">ลบ</button></div><span class="tag">${esc(e.reason)}</span>${e.note?`<p class="entrynote">${esc(e.note)}</p>`:''}</article>`}).join('');
 document.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('ต้องการลบบันทึกนี้หรือไม่?'))return;const {error}=await supabaseClient.from('mood_entries').delete().eq('id',b.dataset.delete);if(error)message('ลบไม่สำเร็จ: '+error.message,true);else{message('ลบบันทึกแล้ว');await loadEntries();}}));
}
async function loadAdminStats(){
 $('adminStats').innerHTML='<p class="muted">กำลังโหลดสถิติ…</p>';
 const {data,error}=await supabaseClient.rpc('admin_mood_summary');
 if(error){$('adminStats').innerHTML='';message('โหลดสถิติผู้ดูแลไม่ได้ ตรวจสอบว่าได้รัน schema.sql และบัญชีนี้มี role=admin แล้ว',true);return;}
 const s=data?.[0]||data||{};
 $('adminStats').innerHTML=`<div class="adminrow"><span>จำนวนผู้ใช้</span><b>${Number(s.user_count||0)}</b></div><div class="adminrow"><span>จำนวนบันทึกทั้งหมด</span><b>${Number(s.entry_count||0)}</b></div><div class="adminrow"><span>ระดับเฉลี่ยรวม / 5</span><b>${s.average_intensity==null?'—':Number(s.average_intensity).toFixed(1)}</b></div><p class="tiny">สถิตินี้ไม่แสดงอีเมล รายบุคคล หรือข้อความบันทึกส่วนตัว</p>`;
}
async function init(){
 drawMoods();$('intensity').addEventListener('input',e=>$('levelText').textContent=e.target.value);
 if(!cfg.SUPABASE_URL||cfg.SUPABASE_URL.includes('ใส่_')||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_ANON_KEY.includes('ใส่_')){
   message('ต้องตั้งค่า config.js ด้วย Supabase Project URL และ publishable/anon key ก่อน ระบบออนไลน์จึงจะเชื่อมต่อได้',true);$('authSubmit').disabled=true;return;
 }
 if(!window.supabase){message('โหลด Supabase client ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต',true);return;}
 supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 $('authForm').addEventListener('submit',async e=>{
   e.preventDefault();clearMessage();const email=$('email').value.trim(),password=$('password').value;
   $('authSubmit').disabled=true;
   try{
     const result=signUpMode?await supabaseClient.auth.signUp({email,password}):await supabaseClient.auth.signInWithPassword({email,password});
     if(result.error)throw result.error;
     if(signUpMode&&!result.data.session){message('สมัครบัญชีแล้ว กรุณาตรวจอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ');}
     else{message(signUpMode?'สร้างบัญชีสำเร็จ':'เข้าสู่ระบบสำเร็จ');showApp(result.data.session);}
   }catch(err){message(err.message||'เกิดข้อผิดพลาด',true)}
   finally{$('authSubmit').disabled=false;}
 });
 $('toggleAuth').addEventListener('click',()=>{signUpMode=!signUpMode;$('authTitle').textContent=signUpMode?'สร้างบัญชี':'เข้าสู่ระบบ';$('authSubmit').textContent=signUpMode?'สมัครสมาชิก':'เข้าสู่ระบบ';$('toggleAuth').textContent=signUpMode?'กลับไปเข้าสู่ระบบ':'สร้างบัญชี';$('password').autocomplete=signUpMode?'new-password':'current-password';clearMessage();});
 $('signOut').addEventListener('click',async()=>{await supabaseClient.auth.signOut();showApp(null);message('ออกจากระบบแล้ว');});
 $('refresh').addEventListener('click',loadEntries);$('loadAdmin').addEventListener('click',loadAdminStats);
 $('save').addEventListener('click',async()=>{
   clearMessage();if(!selectedMood){message('เลือกอารมณ์ก่อนบันทึกนะ',true);return;}
   const payload={user_id:user.id,mood:selectedMood,intensity:Number($('intensity').value),reason:$('reason').value,note:$('note').value.trim()||null};
   $('save').disabled=true;
   const {error}=await supabaseClient.from('mood_entries').insert(payload);
   $('save').disabled=false;
   if(error){message('บันทึกไม่สำเร็จ: '+error.message,true);return;}
   selectedMood='';$('note').value='';$('intensity').value=3;$('levelText').textContent='3';drawMoods();message('บันทึกความรู้สึกแล้ว 💗');await loadEntries();
 });
 
const aiChat=$('aiChat');
let aiMode='both';

document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
  aiMode=b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));
}));

const addAiBubble=(text,kind)=>{
  const el=document.createElement('div');
  el.className='ai-bubble '+(kind==='user'?'ai-user':'ai-reply');
  el.textContent=text;
  aiChat.appendChild(el);
  aiChat.scrollTop=aiChat.scrollHeight;
  return el;
};


function localMoodReply(text,mode){
  const t=text.toLowerCase();

  const library={
    happy:[
      ['การได้พบเจอเรื่องดี ๆ เป็นสิ่งที่มีคุณค่า อย่าลืมให้เวลากับตัวเองได้ชื่นชมช่วงเวลาดี ๆ เหล่านี้',['จดบันทึกสิ่งดี ๆ ที่เกิดขึ้นในวันนี้','แบ่งปันความสุขกับคนที่ไว้ใจ','ให้รางวัลตัวเองด้วยกิจกรรมที่ชื่นชอบ'],'อย่าลืมชื่นชมความพยายามของตัวเอง'],
      ['ความสุขไม่จำเป็นต้องเป็นเรื่องใหญ่ บางครั้งช่วงเวลาดี ๆ เล็กน้อยก็ทำให้วันหนึ่งมีความหมาย',['ลองบันทึกความทรงจำที่ประทับใจ','ใช้เวลากับกิจกรรมที่ทำให้รู้สึกมีความสุข','แบ่งปันความรู้สึกดี ๆ ให้คนรอบข้าง'],'ให้ความสำคัญกับความสุขเล็ก ๆ ในแต่ละวัน']
    ],
    calm:[
      ['การได้ใช้เวลาอย่างสงบเป็นโอกาสที่ดีในการดูแลตัวเอง ลองรักษาช่วงเวลาดี ๆ นี้ไว้',['พักสายตาจากหน้าจอสักครู่','ฟังเพลงที่ช่วยให้รู้สึกผ่อนคลาย','ทำกิจกรรมที่ชื่นชอบโดยไม่ต้องเร่งรีบ'],'คุณไม่จำเป็นต้องรีบทำทุกอย่างตลอดเวลา'],
      ['เมื่อรู้สึกสงบ ลองใช้เวลานี้กลับมาสังเกตความต้องการของตัวเอง',['หายใจเข้าออกช้า ๆ ตามธรรมชาติ','เลือกอยู่ในพื้นที่ที่รู้สึกสบายใจ','ใช้เวลาชื่นชมสิ่งดี ๆ รอบตัว'],'การดูแลใจเริ่มต้นได้จากช่วงเวลาเล็ก ๆ']
    ],
    loved:[
      ['การได้รับความรักและความเข้าใจช่วยให้เรารู้สึกอบอุ่น อย่าลืมส่งต่อความอ่อนโยนนั้นให้ตัวเองด้วย',['ใช้เวลากับคนที่ทำให้รู้สึกสบายใจ','บอกความรู้สึกดี ๆ กับคนสำคัญ','ให้เวลาตัวเองได้พักเมื่อรู้สึกเหนื่อย'],'คุณสมควรได้รับความรักและความเคารพ'],
      ['ความสัมพันธ์ที่ดีเริ่มต้นจากความเข้าใจและการใส่ใจซึ่งกันและกัน',['รับฟังความรู้สึกของตัวเองและผู้อื่น','สื่อสารความต้องการอย่างสุภาพ','ให้ความสำคัญกับขอบเขตของตัวเอง'],'อย่าลืมดูแลตัวเองเช่นเดียวกับที่ดูแลคนสำคัญ']
    ],
    neutral:[
      ['การรู้สึกเฉย ๆ เป็นเรื่องธรรมดา ไม่จำเป็นต้องมีอารมณ์ที่ชัดเจนในทุกวัน',['ทำกิจวัตรตามปกติ','สังเกตว่าร่างกายต้องการพักผ่อนหรือไม่','เลือกทำกิจกรรมเล็ก ๆ ที่เป็นประโยชน์'],'ทุกวันมีคุณค่าในแบบของตัวเอง'],
      ['วันธรรมดาก็เป็นโอกาสในการเรียนรู้และดูแลตัวเองได้',['ลองทำกิจกรรมใหม่ที่สนใจ','ใช้เวลาทบทวนสิ่งที่อยากทำในวันต่อไป','แบ่งเวลาให้ทั้งการทำงานและการพักผ่อน'],'คุณไม่จำเป็นต้องรู้สึกแบบใดแบบหนึ่งตลอดเวลา']
    ],
    sad:[
      ['ไม่เป็นไรหากวันนี้จะเป็นวันที่ยากลำบาก ลองให้เวลากับตัวเองได้พักและค่อย ๆ ดูแลความรู้สึกไปทีละนิด',['ยอมรับความรู้สึกของตัวเองโดยไม่ตำหนิตัวเอง','รับประทานอาหารและดื่มน้ำให้เพียงพอ','พูดคุยกับคนที่ไว้ใจเมื่อรู้สึกพร้อม'],'คุณไม่จำเป็นต้องเข้มแข็งตลอดเวลา'],
      ['ความผิดหวังไม่ได้หมายความว่าคุณไม่มีความสามารถ ทุกคนต่างมีช่วงเวลาที่ไม่เป็นไปตามความคาดหวัง',['ให้เวลาตัวเองทำความเข้าใจกับสิ่งที่เกิดขึ้น','ทบทวนประสบการณ์เมื่อพร้อม','มองหาสิ่งที่สามารถเรียนรู้และพัฒนาต่อได้'],'เหตุการณ์หนึ่งไม่ได้กำหนดคุณค่าทั้งหมดของคุณ'],
      ['หากวันนี้รู้สึกไม่พร้อมที่จะทำหลายสิ่ง ลองเริ่มจากการดูแลความต้องการพื้นฐานของตัวเองก่อน',['ลดภาระที่ยังไม่จำเป็น','ทำกิจกรรมที่ช่วยให้รู้สึกผ่อนคลาย','ขอความช่วยเหลือจากคนที่ไว้ใจเมื่อจำเป็น'],'ค่อย ๆ ก้าวไปตามจังหวะที่เหมาะสมกับตัวเอง']
    ],
    angry:[
      ['ความโกรธเป็นความรู้สึกที่เกิดขึ้นได้ การให้เวลาตัวเองก่อนตอบสนองอาจช่วยให้จัดการสถานการณ์ได้ดีขึ้น',['เว้นระยะจากสถานการณ์ชั่วคราว','รอให้อารมณ์สงบก่อนตอบข้อความหรือพูดคุย','ทบทวนว่าอะไรเป็นสาเหตุของความไม่สบายใจ'],'คุณสามารถแสดงความรู้สึกได้อย่างเหมาะสมและเคารพผู้อื่น'],
      ['บางครั้งความโกรธอาจเกิดร่วมกับความผิดหวังหรือความรู้สึกว่าไม่ได้รับความเข้าใจ',['ลองเขียนสิ่งที่ต้องการสื่อสาร','ทำความเข้าใจความต้องการของตัวเอง','พูดคุยอย่างสุภาพเมื่อทุกฝ่ายพร้อม'],'การสื่อสารอย่างเข้าใจช่วยลดความขัดแย้งได้']
    ],
    anxious:[
      ['เมื่อมีหลายเรื่องให้กังวล ลองกลับมาพิจารณาสิ่งที่สามารถจัดการได้ในปัจจุบัน',['เขียนสิ่งที่กำลังกังวลออกมา','แยกสิ่งที่ควบคุมได้และควบคุมไม่ได้','เลือกจัดการทีละเรื่องตามความสำคัญ'],'คุณไม่จำเป็นต้องมีคำตอบสำหรับทุกเรื่องในทันที'],
      ['หากกำลังกังวลเรื่องเรียนหรือการสอบ การวางแผนเป็นขั้นตอนเล็ก ๆ อาจช่วยให้เริ่มต้นได้ง่ายขึ้น',['เลือกหัวข้อที่ต้องการทบทวนก่อน','แบ่งเวลาอ่านหนังสือเป็นช่วงสั้น ๆ','พักระหว่างการเรียนเพื่อให้สมองได้ผ่อนคลาย'],'การเตรียมตัวทีละน้อยก็เป็นความก้าวหน้า']
    ],
    tired:[
      ['การพักผ่อนเป็นส่วนหนึ่งของการดูแลตัวเอง ลองให้ร่างกายและจิตใจได้ฟื้นตัวก่อนเริ่มต้นอีกครั้ง',['ดื่มน้ำและรับประทานอาหารให้เพียงพอ','พักจากงานที่ยังไม่เร่งด่วน','จัดเวลาเข้านอนให้เหมาะสม'],'การพักไม่ได้ทำให้ความพยายามที่ผ่านมาไร้ความหมาย'],
      ['หากรู้สึกเหนื่อยกับหลายเรื่องพร้อมกัน ลองจัดลำดับสิ่งที่จำเป็นและค่อย ๆ ดำเนินการ',['เขียนรายการสิ่งที่ต้องทำ','เลือกทำเรื่องที่สำคัญก่อน','ขอความช่วยเหลือเมื่อรู้สึกว่าจัดการเพียงลำพังได้ยาก'],'ไม่จำเป็นต้องทำทุกอย่างให้เสร็จพร้อมกัน']
    ],
    confused:[
      ['หากยังไม่แน่ใจว่าจะตัดสินใจอย่างไร ลองให้เวลาตัวเองพิจารณาทางเลือกต่าง ๆ อย่างรอบคอบ',['เขียนทางเลือกที่มีอยู่','พิจารณาข้อดีและข้อจำกัดของแต่ละทาง','ปรึกษาคนที่มีประสบการณ์หรือไว้ใจได้'],'คุณไม่จำเป็นต้องตัดสินใจทุกเรื่องในทันที'],
      ['เมื่อมีความคิดหลายอย่างพร้อมกัน การเรียบเรียงข้อมูลอาจช่วยให้เห็นภาพชัดเจนขึ้น',['เขียนคำถามที่ต้องการคำตอบ','ค้นหาข้อมูลจากแหล่งที่น่าเชื่อถือ','เริ่มจากเรื่องที่สำคัญที่สุด'],'ค่อย ๆ ทำความเข้าใจทีละเรื่องได้']
    ],
    excited:[
      ['ความตื่นเต้นเป็นพลังที่ดีในการเริ่มต้นสิ่งใหม่ ลองนำพลังนี้ไปใช้กับสิ่งที่ตั้งใจไว้',['เขียนเป้าหมายที่ต้องการทำให้สำเร็จ','วางแผนขั้นตอนแรก','เตรียมสิ่งที่จำเป็นล่วงหน้า'],'ขอให้สนุกกับประสบการณ์ใหม่ ๆ'],
      ['เมื่อมีสิ่งที่ตั้งตารอ ลองเตรียมตัวอย่างเหมาะสมเพื่อให้ได้ใช้ช่วงเวลานั้นอย่างเต็มที่',['จัดเตรียมสิ่งที่จำเป็น','กำหนดแผนที่เป็นไปได้จริง','แบ่งเวลาให้การพักผ่อนด้วย'],'ความตื่นเต้นสามารถเป็นจุดเริ่มต้นของสิ่งดี ๆ']
    ],
    lonely:[
      ['การรู้สึกเหงาเป็นเรื่องที่เกิดขึ้นได้ บางครั้งเราอาจต้องการใครสักคนที่พร้อมรับฟัง',['ลองติดต่อเพื่อนหรือคนที่ไว้ใจ','ทำกิจกรรมที่ช่วยให้รู้สึกสบายใจ','เข้าร่วมกิจกรรมที่สนใจเมื่อรู้สึกพร้อม'],'คุณไม่จำเป็นต้องรับมือกับทุกเรื่องเพียงลำพัง'],
      ['หากวันนี้รู้สึกโดดเดี่ยว ลองเริ่มจากการเชื่อมต่อกับผู้คนในแบบที่ตัวเองสบายใจ',['ส่งข้อความทักทายคนใกล้ตัว','ใช้เวลากับงานอดิเรกที่ชื่นชอบ','ลองออกไปทำกิจกรรมในพื้นที่ที่รู้สึกปลอดภัย'],'การสร้างความสัมพันธ์สามารถเริ่มต้นจากก้าวเล็ก ๆ']
    ],
    overwhelmed:[
      ['เมื่อมีหลายสิ่งเกิดขึ้นพร้อมกัน ลองหยุดพักและจัดลำดับความสำคัญก่อนดำเนินการต่อ',['เขียนสิ่งที่ต้องทำทั้งหมด','เลือกเรื่องสำคัญที่สุดหนึ่งเรื่อง','แบ่งงานออกเป็นขั้นตอนเล็ก ๆ'],'คุณไม่จำเป็นต้องจัดการทุกอย่างพร้อมกัน'],
      ['หากรู้สึกว่าภาระต่าง ๆ มากเกินไป การขอความช่วยเหลือและลดสิ่งที่ไม่จำเป็นเป็นทางเลือกที่ทำได้',['เลื่อนงานที่ยังไม่เร่งด่วน','ขอความช่วยเหลือจากคนที่เกี่ยวข้อง','กำหนดเวลาพักระหว่างทำงาน'],'การดูแลตัวเองเป็นส่วนหนึ่งของการจัดการปัญหา']
    ]
  };

  let category='neutral';

  if(/เหงา|คนเดียว|ไม่มีใคร|โดดเดี่ยว/.test(t)) category='lonely';
  else if(/เศร้า|เสียใจ|ร้องไห้|ผิดหวัง|อกหัก/.test(t)) category='sad';
  else if(/เครียด|กังวล|กลัว|กดดัน|สอบ|วิตก|ตื่นตระหนก/.test(t)) category='anxious';
  else if(/เหนื่อย|เพลีย|หมดแรง|ไม่ไหว|ท้อ/.test(t)) category='tired';
  else if(/โกรธ|โมโห|หงุดหงิด|รำคาญ/.test(t)) category='angry';
  else if(/สับสน|ไม่เข้าใจ|ลังเล|ตัดสินใจไม่ได้/.test(t)) category='confused';
  else if(/หนักใจ|รับไม่ไหว|เยอะเกินไป|ถาโถม/.test(t)) category='overwhelmed';
  else if(/ตื่นเต้น|รอไม่ไหว/.test(t)) category='excited';
  else if(/อบอุ่น|ได้รับความรัก|มีคนเข้าใจ/.test(t)) category='loved';
  else if(/สงบ|สบายใจ|ผ่อนคลาย/.test(t)) category='calm';
  else if(/ดีใจ|มีความสุข|สำเร็จ|สนุก|ภูมิใจ/.test(t)) category='happy';

  const items=library[category];
  const item=items[Math.floor(Math.random()*items.length)];
  const tips=item[1].map((tip,i)=>(i+1)+'. '+tip).join('\n');

  if(mode==='listen') return item[0]+'\n\n💗 '+item[2];
  if(mode==='advice') return 'แนวทางดูแลตัวเองที่อาจช่วยได้\n\n'+tips+'\n\n💗 '+item[2];

  return item[0]+'\n\nแนวทางที่ลองทำได้\n'+tips+'\n\n💗 '+item[2];
}

  const t=text.toLowerCase();
  let feeling='ทั่วไป';

  if(/เหงา|คนเดียว|ไม่มีใคร|โดดเดี่ยว/.test(t)) feeling='เหงา';
  else if(/เศร้า|เสียใจ|ร้องไห้|ผิดหวัง|อกหัก/.test(t)) feeling='เศร้า';
  else if(/เครียด|กังวล|กลัว|กดดัน|สอบ|วิตก/.test(t)) feeling='เครียด';
  else if(/เหนื่อย|เพลีย|หมดแรง|ไม่ไหว|ท้อ/.test(t)) feeling='เหนื่อย';
  else if(/โกรธ|โมโห|หงุดหงิด|รำคาญ/.test(t)) feeling='โกรธ';
  else if(/ดีใจ|มีความสุข|สำเร็จ|สนุก|ภูมิใจ/.test(t)) feeling='ดีใจ';

  const replies={
    'เหงา':'ความเหงามันทำให้วันธรรมดาหนักขึ้นได้เหมือนกันนะ',
    'เศร้า':'ฟังดูเป็นเรื่องที่ทำให้มึงรู้สึกแย่มากเลยนะ ไม่จำเป็นต้องรีบทำตัวให้โอเคก็ได้',
    'เครียด':'ดูเหมือนมึงกำลังแบกอะไรหลายอย่างอยู่เลย ค่อย ๆ จัดการทีละเรื่องก็ได้นะ',
    'เหนื่อย':'ถ้าเหนื่อยมากก็พักก่อนได้นะ มึงไม่จำเป็นต้องจัดการทุกอย่างให้เสร็จตอนนี้',
    'โกรธ':'ดูเหมือนเรื่องนี้จะทำให้มึงหงุดหงิดมากเลย ลองเว้นจังหวะก่อนตัดสินใจอะไรตอนอารมณ์แรงก็ได้',
    'ดีใจ':'ดีจังเลย มึงมีสิทธิ์ดีใจกับเรื่องนี้เต็มที่เลยนะ',
    'ทั่วไป':'ขอบคุณที่เล่าให้ฟังนะ บางทีการได้เรียบเรียงความรู้สึกออกมาก็ช่วยให้เราเข้าใจตัวเองขึ้นได้'
  };

  const listen=replies[feeling]+' เล่าเพิ่มได้นะว่าเกิดอะไรขึ้น';
  const advice={
    'เหงา':'ลองทักหาใครสักคนที่คุยด้วยแล้วสบายใจ หรือหาอะไรเล็ก ๆ ทำให้ตัวเองรู้สึกดีขึ้นก่อนก็ได้',
    'เศร้า':'ลองให้เวลาตัวเองพัก แล้วค่อยคิดว่าจะจัดการเรื่องนี้ยังไง ไม่ต้องรีบหาคำตอบทั้งหมดในตอนนี้',
    'เครียด':'ลองเลือกเรื่องที่สำคัญที่สุดแค่หนึ่งเรื่อง แล้วแบ่งเป็นขั้นตอนเล็ก ๆ เริ่มจากขั้นที่ทำได้ตอนนี้',
    'เหนื่อย':'ลองพัก ดื่มน้ำ หรือหยุดงานที่ยังไม่เร่งด่วนสักครู่ แล้วค่อยกลับมาดูว่าจำเป็นต้องทำอะไรก่อน',
    'โกรธ':'ลองถอยออกจากสถานการณ์สักพัก แล้วค่อยกลับมาคุยเมื่อพร้อม จะช่วยให้คิดได้ชัดขึ้น',
    'ดีใจ':'ลองจดจำไว้ว่าอะไรทำให้มึงมีความสุขกับวันนี้ แล้วหาโอกาสทำสิ่งนั้นอีก',
    'ทั่วไป':'ลองเขียนสิ่งที่กำลังคิดอยู่ แล้วแยกดูว่าเรื่องไหนแก้ได้ตอนนี้ และเรื่องไหนยังต้องใช้เวลา'
  };

  if(mode==='listen') return listen;
  if(mode==='advice') return advice[feeling];
  return listen+'\\n\\nถ้าอยากลองทำอะไรสักอย่างตอนนี้: '+advice[feeling];
}

$('aiForm').addEventListener('submit',e=>{
  e.preventDefault();
  const input=$('aiMessage');
  const text=input.value.trim();
  if(!text)return;

  input.value='';
  addAiBubble(text,'user');
  const waiting=addAiBubble('กำลังอ่านข้อความ…','reply');
  $('aiSend').disabled=true;

  setTimeout(()=>{
    waiting.textContent=localMoodReply(text,aiMode);
    $('aiSend').disabled=false;
    input.focus();
  },350);
});

 supabaseClient.auth.onAuthStateChange((_event,session)=>{showApp(session)});
}
document.addEventListener('DOMContentLoaded',init);
})();
