import { useState, useEffect, useRef } from "react";

const KEY = import.meta.env.VITE_GEMINI_KEY;
const URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + KEY;
const DAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const TODAY = new Date();
const TODAY_KEY = TODAY.toISOString().split("T")[0];
const TODAY_DAY = DAYS[TODAY.getDay()];

function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }
function load(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e) { return null; } }
function fmt(t) { if (!t) return "Any"; const h = parseInt(t); const m = t.split(":")[1]; return (h%12||12)+":"+m+" "+(h>=12?"PM":"AM"); }
function emoji(n) {
  const t = (n||"").toLowerCase();
  if (/bus|trip/.test(t)) return "🚌";
  if (/school|study|exam/.test(t)) return "🎒";
  if (/tuition/.test(t)) return "✏️";
  if (/namaz|prayer|roza/.test(t)) return "🕌";
  if (/sleep|bed/.test(t)) return "🌙";
  if (/eat|food|lunch|dinner/.test(t)) return "🍽️";
  if (/gym|run|exercise/.test(t)) return "💪";
  if (/friend|party/.test(t)) return "🎉";
  if (/park/.test(t)) return "🌳";
  return "📌";
}

export default function App() {
  const [view, setView] = useState("today");
  const [sched, setSched] = useState({});
  const [comps, setComps] = useState({});
  const [msgs, setMsgs] = useState([{r:"ai",t:"Assalam o Alaikum! Tell me your routine.\n\nExample: 'School every day 8am to 1:45pm, tuition 3pm to 5pm every day'"}]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(function() {
    const s = load("s"); if (s) setSched(s);
    const c = load("c"); if (c) setComps(c);
  }, []);

  useEffect(function() {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [msgs]);

  const tasks = (sched[TODAY_DAY]||[]).sort(function(a,b){return (a.start||"zz").localeCompare(b.start||"zz");});
  const done = tasks.filter(function(t){return (comps[TODAY_KEY]||{})[t.name]===true;}).length;

  function mark(name, val) {
    const nc = Object.assign({}, comps);
    if (!nc[TODAY_KEY]) nc[TODAY_KEY] = {};
    if (val===undefined) delete nc[TODAY_KEY][name]; else nc[TODAY_KEY][name] = val;
    setComps(nc); save("c", nc);
  }

  async function send() {
    if (!input.trim()||busy) return;
    const u = input.trim(); setInput("");
    setMsgs(function(p){return [...p,{r:"u",t:u}];}); setBusy(true);
    const sys = "You are a planner AI. Return ONLY valid JSON no markdown.\nSchedule: "+JSON.stringify(sched)+"\nToday: "+TODAY_KEY+" ("+TODAY_DAY+").\nRules: 'every day' for school/work = mon-sat only. Times in HH:MM 24hr.\nReturn: {\"message\":\"short reply\",\"schedule\":{\"monday\":[{\"name\":\"School\",\"start\":\"08:00\",\"end\":\"13:45\"}]}}\nOnly include changed days. No specialEvent needed.";
    try {
      const res = await fetch(URL, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents:[{role:"user",parts:[{text:u}]}],generationConfig:{temperature:0.3,maxOutputTokens:800}})});
      const d = await res.json();
      const txt = (d.candidates?.[0]?.content?.parts?.[0]?.text||"").replace(/```json|```/g,"").trim();
      let p; try{p=JSON.parse(txt);}catch(e){p={message:"Try: School every day 8am to 1:45pm"};}
      if (p.schedule) {
        const ns = Object.assign({}, sched);
        Object.keys(p.schedule).forEach(function(day){
          const tasks = p.schedule[day];
          if (!Array.isArray(tasks)||!tasks.length) return;
          const ex = [...(ns[day]||[])];
          tasks.forEach(function(nt){const i=ex.findIndex(function(t){return t.name.toLowerCase()===nt.name.toLowerCase();});if(i>=0)ex[i]=nt;else ex.push(nt);});
          ns[day] = ex.sort(function(a,b){return (a.start||"zz").localeCompare(b.start||"zz");});
        });
        setSched(ns); save("s", ns);
      }
      setMsgs(function(prev){return [...prev,{r:"ai",t:p.message||"Done! Check Today tab."}];});
    } catch(e) {
      setMsgs(function(prev){return [...prev,{r:"ai",t:"Error. Check your Gemini API key in Netlify."}];});
    }
    setBusy(false);
  }

  const W = "#FFF8E7", B = "#E8D8A0", O = "#E76F51", F = "Nunito,sans-serif";

  if (view==="chat") return (
    <div style={{display:"flex",flexDirection:"column",height:"100dvh",background:"#FFFDF7"}}>
      <div style={{background:W,padding:"52px 20px 16px",borderBottom:"2px solid "+B}}>
        <div style={{fontFamily:F,fontWeight:900,fontSize:22,color:"#2C2C2C"}}>🤖 AI Planner</div>
        <div style={{fontFamily:F,fontSize:12,color:"#AAA"}}>Powered by Google Gemini (Free)</div>
      </div>
      <div ref={ref} style={{flex:1,overflowY:"auto",padding:"16px 16px 140px"}}>
        {msgs.map(function(m,i){return(
          <div key={i} style={{display:"flex",justifyContent:m.r==="u"?"flex-end":"flex-start",marginBottom:10}}>
            <div style={{maxWidth:"78%",padding:"10px 14px",fontFamily:F,fontSize:14,lineHeight:1.6,whiteSpace:"pre-line",background:m.r==="u"?O:W,color:m.r==="u"?"#fff":"#2C2C2C",fontWeight:600,borderRadius:m.r==="u"?"18px 18px 4px 18px":"18px 18px 18px 4px",border:m.r==="ai"?"1.5px solid "+B:"none"}}>{m.t}</div>
          </div>
        );})}
        {busy&&<div style={{fontFamily:F,fontSize:13,color:"#AAA",padding:"10px 0"}}>Thinking...</div>}
      </div>
      <div style={{position:"fixed",bottom:68,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,padding:"10px 14px",background:"linear-gradient(0deg,#FFFDF7 75%,transparent)",zIndex:10}}>
        <div style={{display:"flex",gap:8}}>
          <input value={input} onChange={function(e){setInput(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")send();}} placeholder="Tell me your routine..." style={{flex:1,border:"2px solid "+B,borderRadius:14,padding:"12px 16px",fontFamily:F,fontSize:14,outline:"none",background:W}}/>
          <button onClick={send} style={{width:50,height:50,borderRadius:14,border:"none",background:input.trim()?O:"#EEE",color:input.trim()?"#fff":"#CCC",fontSize:18,cursor:"pointer"}}>↑</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{background:"#FFFDF7",minHeight:"100dvh",paddingBottom:80}}>
      <div style={{background:W,padding:"52px 20px 16px",borderBottom:"2px solid "+B}}>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
          <div>
            <div style={{fontFamily:F,fontSize:12,color:"#AAA",fontWeight:600}}>{TODAY.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
            <div style={{fontFamily:F,fontWeight:900,fontSize:26,color:"#2C2C2C"}}>☀️ {view==="today"?"Today":"Weekly"}</div>
          </div>
          {view==="today"&&tasks.length>0&&<div style={{textAlign:"right"}}><div style={{fontFamily:F,fontWeight:900,fontSize:32,color:O,lineHeight:1}}>{done}/{tasks.length}</div><div style={{fontFamily:F,fontSize:10,color:"#BBB"}}>DONE</div></div>}
        </div>
        {view==="today"&&tasks.length>0&&<div style={{marginTop:10,height:6,background:"#EEE5C0",borderRadius:10}}><div style={{height:"100%",background:O,borderRadius:10,width:(done/tasks.length*100)+"%",transition:"width 0.4s"}}/></div>}
      </div>

      <div style={{padding:"16px"}}>
        {view==="today"&&(tasks.length===0?(
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <div style={{fontSize:48,marginBottom:12}}>📋</div>
            <div style={{fontFamily:F,fontWeight:800,fontSize:16,color:"#AAA",marginBottom:20}}>No tasks yet! Go to Chat tab.</div>
            <button onClick={function(){setView("chat");}} style={{padding:"12px 28px",background:O,color:"#fff",border:"none",borderRadius:12,fontFamily:F,fontWeight:800,fontSize:14,cursor:"pointer"}}>Open Chat</button>
          </div>
        ):tasks.map(function(t,i){
          const d=(comps[TODAY_KEY]||{})[t.name]===true;
          const sk=(comps[TODAY_KEY]||{})[t.name]===false;
          return(
            <div key={i} style={{display:"grid",gridTemplateColumns:"36px 76px 1fr",marginBottom:8,alignItems:"center"}}>
              <div onClick={function(){mark(t.name,d?undefined:true);}} style={{width:28,height:28,borderRadius:7,border:"2.5px solid "+(d?O:B),background:d?O:W,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto"}}>
                {d&&<span style={{color:"#fff",fontWeight:900}}>✓</span>}
              </div>
              <div style={{background:W,border:"1.5px solid "+B,borderRadius:8,padding:"6px 4px",marginRight:6,textAlign:"center",fontFamily:F,fontWeight:800,fontSize:10,color:d?"#CCC":"#555",textDecoration:d?"line-through":"none"}}>{fmt(t.start)}</div>
              <div style={{background:d?"#F5F5F5":"#fff",border:"1.5px solid "+(d?"#EEE":B),borderRadius:8,padding:"8px 10px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{t.emoji||emoji(t.name)}</span>
                <span style={{fontFamily:F,fontWeight:700,fontSize:13,color:d?"#BBB":"#2C2C2C",textDecoration:d?"line-through":"none",flex:1}}>{t.name}</span>
                <span onClick={function(){mark(t.name,sk?undefined:false);}} style={{cursor:"pointer",fontSize:13,color:sk?O:"#CCC"}}>✕</span>
              </div>
            </div>
          );
        }))}

        {view==="weekly"&&(
          <div>
            {DAYS.slice(1).concat(DAYS[0]).map(function(day){
              const dayTasks = sched[day]||[];
              if (!dayTasks.length) return null;
              return(
                <div key={day} style={{marginBottom:16}}>
                  <div style={{fontFamily:F,fontWeight:800,fontSize:12,color:"#888",letterSpacing:1,textTransform:"uppercase",marginBottom:8,paddingBottom:4,borderBottom:"2px solid "+B}}>{day}</div>
                  {dayTasks.map(function(t,i){return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid #F5EDD0"}}>
                      <span style={{fontSize:16}}>{t.emoji||emoji(t.name)}</span>
                      <span style={{fontFamily:F,fontWeight:700,fontSize:13,flex:1}}>{t.name}</span>
                      <span style={{fontFamily:F,fontSize:11,color:"#AAA"}}>{fmt(t.start)}</span>
                    </div>
                  );})}
                </div>
              );
            })}
            {Object.keys(sched).length===0&&<div style={{textAlign:"center",padding:"60px 0",fontFamily:F,color:"#AAA",fontSize:14}}>No schedule yet. Go to Chat!</div>}
          </div>
        )}
      </div>

      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:W,borderTop:"2px solid "+B,display:"flex",zIndex:30}}>
        {[{id:"today",l:"Today",ic:"☀️"},{id:"weekly",l:"Weekly",ic:"📅"},{id:"chat",l:"Chat",ic:"💬"}].map(function(n){return(
          <button key={n.id} onClick={function(){setView(n.id);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"10px 0 12px",color:view===n.id?O:"#CCC",background:"none",border:"none",cursor:"pointer",fontFamily:F,fontSize:10,fontWeight:800,borderTop:view===n.id?"3px solid "+O:"3px solid transparent"}}>
            <span style={{fontSize:22}}>{n.ic}</span><span>{n.l}</span>
          </button>
        );})}
      </div>
    </div>
  );
  }
      
