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


function localMoodReply(mood, message = "", mode = "both") {
  const replies = {
    happy: {
      listen: [
        "ดีใจด้วยนะที่วันนี้มีเรื่องดี ๆ เกิดขึ้น อยากเล่าให้ฟังไหมว่าอะไรทำให้ยิ้มได้ขนาดนี้",
        "ฟังแล้วรู้สึกได้เลยว่าวันนี้มีช่วงเวลาดี ๆ เกิดขึ้น เก็บความรู้สึกนี้ไว้เป็นความทรงจำดี ๆ นะ"
      ],
      advice: [
        "ลองจดบันทึกสิ่งดี ๆ ที่เกิดขึ้นวันนี้ไว้ วันไหนที่รู้สึกเหนื่อยอาจกลับมาอ่านแล้วมีกำลังใจขึ้น",
        "ถ้ามีความสุขกับอะไรเป็นพิเศษ ลองแบ่งปันความรู้สึกดี ๆ ให้คนรอบข้างด้วยนะ"
      ]
    },
    calm: {
      listen: [
        "การได้รู้สึกสงบแบบนี้เป็นเรื่องที่ดีนะ ตอนนี้มีอะไรที่ทำให้รู้สึกสบายใจเป็นพิเศษหรือเปล่า",
        "ไม่ต้องรีบทำอะไรไปทุกอย่างก็ได้นะ ลองอยู่กับช่วงเวลาที่สงบนี้สักพัก"
      ],
      advice: [
        "ลองใช้เวลานี้พักจากสิ่งที่วุ่นวาย หายใจช้า ๆ แล้วทำสิ่งที่ช่วยให้ใจสบายต่อไปนะ",
        "การมีเวลาสงบให้ตัวเองบ้างเป็นเรื่องสำคัญ ลองรักษาช่วงเวลาแบบนี้ไว้ในแต่ละวัน"
      ]
    },
    loved: {
      listen: [
        "การรู้สึกว่าได้รับความรักเป็นความรู้สึกที่มีค่านะ วันนี้มีใครทำอะไรให้รู้สึกแบบนี้หรือเปล่า",
        "ฟังดูเป็นความรู้สึกที่อบอุ่นมากเลย อยากเล่าเพิ่มเติมก็ได้นะ"
      ],
      advice: [
        "ถ้ามีคนที่ทำให้รู้สึกดี ลองบอกเขาว่าขอบคุณที่อยู่ข้าง ๆ กันนะ",
        "อย่าลืมมอบความใจดีให้ตัวเองด้วยนะ มึงก็สมควรได้รับความรักและการดูแลเหมือนกัน"
      ]
    },
    neutral: {
      listen: [
        "วันนี้อาจเป็นวันที่ไม่ได้รู้สึกอะไรเป็นพิเศษก็ได้นะ ไม่จำเป็นต้องมีอารมณ์ชัดเจนทุกวัน",
        "เข้าใจนะ บางวันก็เป็นวันธรรมดา ๆ ที่ไม่ได้ดีหรือแย่อะไรเป็นพิเศษ"
      ],
      advice: [
        "ลองทำกิจกรรมเล็ก ๆ ที่ชอบ หรือพักผ่อนตามปกติก็ได้ ไม่ต้องฝืนทำให้วันนี้พิเศษเสมอไป",
        "ลองสังเกตตัวเองระหว่างวันว่าอะไรทำให้รู้สึกสบายใจหรือไม่สบายใจ โดยไม่ต้องตัดสินตัวเองนะ"
      ]
    },
    sad: {
      listen: [
        "ไม่เป็นไรเลยนะที่จะรู้สึกเศร้า มึงไม่จำเป็นต้องรีบทำให้ตัวเองกลับมาร่าเริงก็ได้",
        "ถ้ามีเรื่องที่ทำให้เสียใจ เล่าให้ฟังได้นะ กูจะช่วยรับฟังโดยไม่ตัดสิน"
      ],
      advice: [
        "ลองให้เวลาตัวเองได้พัก ทำสิ่งเล็ก ๆ ที่ช่วยให้สบายใจ และถ้ารู้สึกไม่ไหวก็ลองคุยกับคนที่ไว้ใจนะ",
        "วันนี้ไม่ต้องกดดันตัวเองมากก็ได้ ลองเริ่มจากดูแลตัวเองทีละอย่าง เช่น กินข้าว ดื่มน้ำ หรือพักผ่อน"
      ]
    },
    angry: {
      listen: [
        "ดูเหมือนวันนี้มีบางอย่างทำให้มึงไม่พอใจมากเลย อยากเล่าไหมว่าเกิดอะไรขึ้น",
        "ความโกรธเกิดขึ้นได้ ไม่ได้แปลว่ามึงเป็นคนไม่ดีนะ ลองเล่าออกมาได้ถ้าพร้อม"
      ],
      advice: [
        "ถ้ายังรู้สึกเดือดอยู่ ลองเว้นระยะจากสถานการณ์สักพัก หายใจช้า ๆ แล้วค่อยตัดสินใจว่าจะทำยังไงต่อ",
        "ลองแยกให้ออกว่าอะไรคือสิ่งที่เกิดขึ้น และอะไรคือสิ่งที่มึงอยากให้เปลี่ยน จะช่วยให้คิดทางออกได้ชัดขึ้น"
      ]
    },
    anxious: {
      listen: [
        "การกังวลกับบางเรื่องอาจทำให้เหนื่อยได้เหมือนกันนะ ตอนนี้มีเรื่องไหนที่วนอยู่ในหัวเป็นพิเศษไหม",
        "ไม่ต้องจัดการทุกอย่างให้ได้ในทันทีนะ ค่อย ๆ เล่าทีละเรื่องก็ได้"
      ],
      advice: [
        "ลองเขียนสิ่งที่กังวลออกมา แล้วแยกดูว่าเรื่องไหนที่จัดการได้ตอนนี้กับเรื่องไหนที่ต้องรอไปก่อน",
        "ลองหายใจช้า ๆ แล้วกลับมาอยู่กับสิ่งที่ทำได้ในตอนนี้ทีละอย่างนะ"
      ]
    },
    tired: {
      listen: [
        "วันนี้คงใช้พลังไปเยอะเลยสินะ ถ้าเหนื่อยก็พักได้นะ ไม่จำเป็นต้องฝืนตลอดเวลา",
        "ฟังดูเหมือนมึงต้องการเวลาพักบ้าง วันนี้มีอะไรทำให้เหนื่อยเป็นพิเศษไหม"
      ],
      advice: [
        "ลองพักจากงานสักครู่ ดื่มน้ำ กินอาหารให้เพียงพอ และหาเวลานอนให้เหมาะสมนะ",
        "ถ้าไม่ใช่เรื่องเร่งด่วน ลองแบ่งงานเป็นส่วนเล็ก ๆ แล้วค่อยทำทีละอย่าง ไม่ต้องแบกทุกอย่างพร้อมกัน"
      ]
    },
    confused: {
      listen: [
        "ไม่เป็นไรนะที่ตอนนี้จะยังสับสน บางเรื่องก็ต้องใช้เวลาคิดและทำความเข้าใจ",
        "ถ้ามีหลายเรื่องปนกันอยู่ในหัว ลองเล่าทีละเรื่องก็ได้ เดี๋ยวเราค่อย ๆ เรียบเรียงกัน"
      ],
      advice: [
        "ลองเขียนตัวเลือกที่มี พร้อมข้อดีข้อเสียของแต่ละทาง จะช่วยให้เห็นภาพชัดขึ้น",
        "ไม่จำเป็นต้องรีบตัดสินใจทันทีถ้ายังมีเวลา ลองหาข้อมูลเพิ่มหรือปรึกษาคนที่ไว้ใจได้นะ"
      ]
    },
    excited: {
      listen: [
        "ดูเหมือนมึงกำลังตื่นเต้นกับอะไรบางอย่างเลย มีเรื่องดี ๆ เกิดขึ้นหรือกำลังรออะไรอยู่หรือเปล่า",
        "ความรู้สึกตื่นเต้นแบบนี้น่าสนใจนะ เล่าให้ฟังได้ไหมว่าเกิดอะไรขึ้น"
      ],
      advice: [
        "ลองใช้พลังและความตื่นเต้นนี้วางแผนสิ่งที่อยากทำ แล้วค่อย ๆ ลงมือทีละขั้นนะ",
        "ดีใจไปกับช่วงเวลานี้ได้เต็มที่เลย แต่อย่าลืมพักและดูแลตัวเองด้วยนะ"
      ]
    },
    lonely: {
      listen: [
        "ความเหงาเป็นความรู้สึกที่เกิดขึ้นได้ แม้จะมีคนอยู่รอบตัวก็ตามนะ ถ้าอยากเล่า กูพร้อมรับฟัง",
        "บางครั้งการรู้สึกเหมือนไม่มีใครเข้าใจก็ทำให้เหนื่อยได้เหมือนกัน ตอนนี้มึงกำลังรู้สึกแบบนั้นอยู่ไหม"
      ],
      advice: [
        "ลองส่งข้อความหาเพื่อนหรือคนที่ไว้ใจ แม้จะเริ่มจากการคุยเรื่องเล็ก ๆ ก็ได้",
        "ถ้ายังไม่พร้อมคุยกับใคร ลองทำกิจกรรมที่ช่วยให้รู้สึกเชื่อมโยงกับสิ่งที่ชอบก่อนก็ได้นะ"
      ]
    },
    overwhelmed: {
      listen: [
        "ดูเหมือนตอนนี้มีหลายอย่างเข้ามาพร้อมกันจนรับมือยากเลยนะ ไม่จำเป็นต้องจัดการทุกเรื่องในครั้งเดียว",
        "ถ้าอยากระบายออกมาก่อนก็ได้นะ เราค่อย ๆ ดูทีละเรื่อง ไม่ต้องรีบหาคำตอบทันที"
      ],
      advice: [
        "ลองเลือกจัดการแค่เรื่องที่สำคัญที่สุดหนึ่งเรื่องก่อน ส่วนเรื่องอื่นค่อยกลับมาดูเมื่อพร้อม",
        "พักสักครู่แล้วแบ่งสิ่งที่ต้องทำออกเป็นขั้นเล็ก ๆ นะ ถ้าหนักเกินไป ลองขอความช่วยเหลือจากคนที่ไว้ใจได้"
      ]
    }
  };

  const selected = replies[mood] || replies.neutral;

  if (mode === "listen") {
    return selected.listen[
      Math.floor(Math.random() * selected.listen.length)
    ];
  }

  if (mode === "advice") {
    return selected.advice[
      Math.floor(Math.random() * selected.advice.length)
    ];
  }

  const listen = selected.listen[
    Math.floor(Math.random() * selected.listen.length)
  ];

  const advice = selected.advice[
    Math.floor(Math.random() * selected.advice.length)
  ];

  return `${listen}\n\n${advice}`;
}

function smartMoodReply(text, currentMood, mode) {
  const msg = text.toLowerCase();

  const topics = [
    {
      words: ['สอบ', 'การบ้าน', 'เรียน', 'งาน', 'ส่งงาน', 'คะแนน'],
      listen: 'เรื่องเรียนกับงานอาจทำให้กดดันได้เหมือนกันนะ เล่าให้ฟังได้ว่าเรื่องไหนทำให้มึงหนักใจที่สุด',
      advice: 'ลองแยกงานที่ต้องทำออกเป็นข้อ ๆ แล้วเริ่มจากข้อที่สำคัญหรือใกล้กำหนดส่งที่สุด ไม่ต้องทำทุกอย่างพร้อมกัน'
    },
    {
      words: ['เพื่อน', 'ทะเลาะ', 'ไม่เข้าใจ', 'โกรธ', 'งอน'],
      listen: 'เรื่องความสัมพันธ์กับเพื่อนอาจทำให้รู้สึกหลายอย่างปนกันได้เลยนะ ถ้ามึงอยากเล่า เราค่อย ๆ ทำความเข้าใจว่าเกิดอะไรขึ้นกัน',
      advice: 'ลองให้เวลาตัวเองใจเย็นก่อน แล้วค่อยคุยกันโดยบอกความรู้สึกของตัวเองตรง ๆ โดยไม่กล่าวโทษอีกฝ่าย'
    },
    {
      words: ['แฟน', 'ความรัก', 'เลิกกัน', 'อกหัก', 'คนคุย'],
      listen: 'เรื่องความรักมีผลต่อความรู้สึกของเราได้มากเลยนะ มึงเล่าได้นะว่าเกิดอะไรขึ้น',
      advice: 'ลองถามตัวเองว่าตอนนี้ต้องการอะไรที่สุด เช่น เวลาพักใจ ความชัดเจน หรือการพูดคุยกัน และอย่าลืมดูแลความรู้สึกของตัวเองด้วย'
    },
    {
      words: ['เหงา', 'ไม่มีใคร', 'อยู่คนเดียว', 'โดดเดี่ยว'],
      listen: 'การรู้สึกเหงาแม้จะพยายามใช้ชีวิตตามปกติก็เกิดขึ้นได้ มึงไม่จำเป็นต้องเก็บทุกอย่างไว้คนเดียว เล่าให้กูฟังได้',
      advice: 'ลองทักหาเพื่อนหรือคนที่ไว้ใจสักคน เริ่มจากคุยเรื่องธรรมดาก็ได้ หรือหากยังไม่พร้อม ลองทำกิจกรรมที่ทำให้รู้สึกสบายใจ'
    },
    {
      words: ['เหนื่อย', 'หมดแรง', 'พัก', 'นอนไม่หลับ'],
      listen: 'ฟังดูเหมือนมึงใช้พลังไปเยอะมากเลยนะ ช่วงนี้มีอะไรที่ทำให้เหนื่อยเป็นพิเศษหรือเปล่า',
      advice: 'ถ้าเป็นไปได้ ลองพักจากสิ่งที่ทำอยู่ ดื่มน้ำ กินอาหารให้เพียงพอ และจัดเวลานอนให้เหมาะสม ถ้าอาการต่อเนื่องหรือรบกวนชีวิตประจำวัน ควรปรึกษาผู้เชี่ยวชาญ'
    },
    {
      words: ['กลัว', 'กังวล', 'เครียด', 'คิดมาก', 'อนาคต'],
      listen: 'เวลามีเรื่องให้คิดหลายอย่างพร้อมกัน มันทำให้ใจไม่ค่อยสงบได้จริง ๆ นะ เรื่องไหนที่วนอยู่ในหัวมึงมากที่สุดตอนนี้',
      advice: 'ลองเขียนสิ่งที่กังวลออกมา แล้วแยกเรื่องที่ทำอะไรได้ในวันนี้กับเรื่องที่ยังควบคุมไม่ได้ ค่อยจัดการทีละเรื่องนะ'
    },
    {
      words: ['ครอบครัว', 'พ่อ', 'แม่', 'ที่บ้าน'],
      listen: 'เรื่องในครอบครัวอาจกระทบความรู้สึกเราได้มากเหมือนกันนะ ถ้ามึงพร้อม เล่าได้ว่าเกิดอะไรขึ้น',
      advice: 'ลองหาจังหวะคุยตอนที่ทุกฝ่ายสงบ หรือปรึกษาคนที่ไว้ใจได้หากยังคุยกันยาก มึงไม่จำเป็นต้องแก้ทุกอย่างคนเดียว'
    },
    {
      words: ['ไม่เก่ง', 'ล้มเหลว', 'ผิดหวัง', 'ทำไม่ได้', 'ไร้ค่า'],
      listen: 'การเจอเรื่องที่ไม่เป็นไปอย่างหวังไม่ได้แปลว่ามึงไม่มีความสามารถนะ อยากเล่าไหมว่าเกิดอะไรขึ้น',
      advice: 'ลองมองเรื่องนี้เป็นเหตุการณ์หนึ่ง ไม่ใช่คำตัดสินคุณค่าของตัวเอง แล้วค่อยดูว่ามีอะไรที่เรียนรู้หรือปรับได้บ้าง'
    }
  ];

  const topic = topics.find(t => t.words.some(word => msg.includes(word)));

  if (topic) {
    if (mode === 'listen') return topic.listen;
    if (mode === 'advice') return topic.advice;
    return topic.listen + '\n\n' + topic.advice;
  }

  return localMoodReply(currentMood || 'neutral', text, mode);
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
    waiting.textContent=smartMoodReply(text,selectedMood,aiMode);
    $('aiSend').disabled=false;
    input.focus();
  },350);
});

 supabaseClient.auth.onAuthStateChange((_event,session)=>{showApp(session)});
}
document.addEventListener('DOMContentLoaded',init);
})();
