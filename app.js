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
