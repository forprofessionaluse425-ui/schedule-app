import { useState, useEffect, useRef } from "react";

const DAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const DAY_COL = ["M","T","W","T","F","S","S"];
const DAY_ORDER = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const TODAY = new Date();
const TODAY_KEY = TODAY.toISOString().split("T")[0];
const TODAY_DAY = DAYS[TODAY.getDay()];

const SECTIONS = [
  { id:"morning",   label:"Morning",   color:"#AED6F1", text:"#1A5276", from:4,  to:12 },
  { id:"afternoon", label:"Afternoon", color:"#F1948A", text:"#7B241C", from:12, to:17 },
  { id:"evening",   label:"Evening",   color:"#F8C8D4", text:"#922B21", from:17, to:24 },
  { id:"anytime",   label:"Tasks",     color:"#D5F5E3", text:"#1E8449", from:-1, to:-1 },
];

// ── GEMINI API ─────────────────────────────────────────────
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_KEY;

async function askGemini(systemPrompt, userMessage) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        { role: "user", parts: [{ text: userMessage }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1200,
      }
    })
  });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ── HELPERS ────────────────────────────────────────────────
function saveLocal(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
function loadLocal(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch(e) { return null; }
}

function fmt(t) {
  if (!t) return "";
  const h = parseInt(t.split(":")[0]);
  const m = t.split(":")[1];
  return (h % 12 || 12) + ":" + m + " " + (h >= 12 ? "PM" : "AM");
}

function getEmoji(name, cat) {
  const t = ((name||"") + " " + (cat||"")).toLowerCase();
  if (/bus|trip|travel|tour|excursion|picnic/.test(t)) return "🚌";
  if (/school|study|class|college|education|exam/.test(t)) return "🎒";
  if (/tuition|coaching|tutoring/.test(t)) return "✏️";
  if (/prayer|namaz|salah|mosque|roza|dua|quran/.test(t)) return "🕌";
  if (/sleep|bed|rest|nap/.test(t)) return "🌙";
  if (/breakfast/.test(t)) return "🍳";
  if (/lunch|dinner|meal|eat|food|tiffin/.test(t)) return "🍽️";
  if (/gym|exercise|workout|run|fitness|yoga/.test(t)) return "💪";
  if (/cricket|football|sport/.test(t)) return "🏏";
  if (/friend|party|birthday|hang|gather|celebrat|outing/.test(t)) return "🎉";
  if (/home|house|family/.test(t)) return "🏠";
  if (/read|book|novel|library/.test(t)) return "📖";
  if (/work|office|meeting|job/.test(t)) return "💼";
  if (/shop|market|buy|store/.test(t)) return "🛍️";
  if (/doctor|hospital|clinic|medicine|health/.test(t)) return "🏥";
  if (/coffee|tea|break|relax|chill/.test(t)) return "☕";
  if (/wake|wakeup|alarm/.test(t)) return "⏰";
  if (/bath|shower|hygiene|skincare/.test(t)) return "🚿";
  if (/walk|stroll/.test(t)) return "🚶";
  if (/park|garden|nature/.test(t)) return "🌳";
  return "📌";
}

function getWeekDays() {
  const dow = TODAY.getDay();
  const mon = new Date(TODAY);
  mon.setDate(TODAY.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({length:7}, function(_, i) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const key = d.toISOString().split("T")[0];
    return { key, day: DAYS[d.getDay()], isToday: key === TODAY_KEY };
  });
}
const WEEKDAYS = getWeekDays();

// ── APP ────────────────────────────────────────────────────
export default function App() {
  const [view, setView]         = useState("today");
  const [schedule, setSchedule] = useState({});
  const [special, setSpecial]   = useState({});
  const [comps, setComps]       = useState({});
  const [msgs, setMsgs]         = useState([{
    r:"ai",
    t:"Assalam o Alaikum! 👋\n\nTell me your daily routine and I will build your planner.\n\nExample:\n\"I go to school every day from 8am to 1:45pm. Tuition 3pm to 5pm every day.\"\n\nPowered by Google Gemini (Free) ✨"
  }]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const chatRef = useRef(null);

  useEffect(function() {
    const s = loadLocal("dp_sched"); if (s) setSchedule(s);
    const e = loadLocal("dp_events"); if (e) setSpecial(e);
    const c = loadLocal("dp_comps"); if (c) setComps(c);
  }, []);

  useEffect(function() {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs, loading]);

  function mark(name, val) {
    const prev = comps[TODAY_KEY] || {};
    const next = Object.assign({}, prev);
    if (val === undefined) { delete next[name]; } else { next[name] = val; }
    const nc = Object.assign({}, comps, {[TODAY_KEY]: next});
    setComps(nc);
    saveLocal("dp_comps", nc);
  }

  const todayTasks = [
    ...(schedule[TODAY_DAY] || []),
    ...(special[TODAY_KEY] || []).map(function(x) { return Object.assign({}, x, {isSpecial:true}); })
  ].sort(function(a,b) { return (a.start||"zz").localeCompare(b.start||"zz"); });

  const todayComps = comps[TODAY_KEY] || {};
  const todayDone = todayTasks.filter(function(t) { return todayComps[t.name] === true; }).length;

  const allWeekTasks = [];
  const seen = new Set();
  DAY_ORDER.forEach(function(day) {
    (schedule[day]||[]).forEach(function(t) {
      if (!seen.has(t.name)) { seen.add(t.name); allWeekTasks.push(t); }
    });
  });
  (special[TODAY_KEY]||[]).forEach(function(t) {
    if (!seen.has(t.name)) { seen.add(t.name); allWeekTasks.push(Object.assign({},t,{isSpecial:true})); }
  });

  const weekScore = (function() {
    let total = 0, done = 0;
    WEEKDAYS.forEach(function(wd) {
      (schedule[wd.day]||[]).forEach(function(t) {
        total++;
        if (comps[wd.key] && comps[wd.key][t.name] === true) done++;
      });
    });
    return total ? Math.round((done/total)*100) : 0;
  })();

  async function send() {
    if (!input.trim() || loading) return;
    const u = input.trim();
    setInput("");
    setMsgs(function(p) { return [...p, {r:"u", t:u}]; });
    setLoading(true);

    const tomorrow = new Date(TODAY.getTime()+86400000).toISOString().split("T")[0];
    const nextSun = (function() {
      const d = new Date(TODAY);
      while (DAYS[d.getDay()] !== "sunday") d.setDate(d.getDate()+1);
      return d.toISOString().split("T")[0];
    })();

    const systemPrompt =
      "You are a daily planner AI. Parse natural language and return ONLY valid JSON with no markdown, no code blocks, no extra text.\n" +
      "Current schedule: " + JSON.stringify(schedule) + "\n" +
      "Today: " + TODAY_KEY + " (" + TODAY_DAY + "). Tomorrow: " + tomorrow + ". Next Sunday: " + nextSun + ".\n" +
      "STRICT RULES:\n" +
      "- every day for school or tuition or work = monday to saturday ONLY, never sunday\n" +
      "- every day for habits or prayers or personal = all 7 days including sunday\n" +
      "- All times must be 24hr HH:MM format\n" +
      "- Merge tasks by name, update if exists, add if new\n" +
      "- Always pick best emoji for each task\n" +
      "Return ONLY this JSON, nothing else:\n" +
      "{\"message\":\"short friendly reply\",\"schedule\":{\"monday\":[{\"name\":\"School\",\"start\":\"08:00\",\"end\":\"13:45\",\"category\":\"education\",\"emoji\":\"🎒\"}]},\"specialEvent\":{\"date\":\"YYYY-MM-DD\",\"event\":{\"name\":\"Park\",\"start\":\"09:00\",\"end\":null,\"category\":\"other\",\"emoji\":\"🌳\"}}}\n" +
      "Only include days and fields that are changing. Leave out specialEvent if not needed.";

    try {
      const txt = await askGemini(systemPrompt, u);
      let p;
      try {
        const clean = txt.replace(/```json|```/g,"").trim();
        p = JSON.parse(clean);
      } catch(e) {
        p = { message: "Try: School every day 8am to 1:45pm" };
      }

      let ns = Object.assign({}, schedule);
      let ne = Object.assign({}, special);

      if (p.schedule) {
        Object.keys(p.schedule).forEach(function(day) {
          const tasks = p.schedule[day];
          if (!Array.isArray(tasks) || !tasks.length) return;
          const ex = [...(ns[day]||[])];
          tasks.forEach(function(nt) {
            const i = ex.findIndex(function(t) { return t.name.toLowerCase() === nt.name.toLowerCase(); });
            if (i >= 0) ex[i] = nt; else ex.push(nt);
          });
          ns[day] = ex.sort(function(a,b) { return (a.start||"zz").localeCompare(b.start||"zz"); });
        });
        setSchedule(ns);
        saveLocal("dp_sched", ns);
      }

      if (p.specialEvent && p.specialEvent.date && p.specialEvent.event) {
        const date = p.specialEvent.date;
        const event = p.specialEvent.event;
        const ex = [...(ne[date]||[])];
        const i = ex.findIndex(function(e) { return e.name.toLowerCase() === event.name.toLowerCase(); });
        if (i >= 0) ex[i] = event; else ex.push(event);
        ne[date] = ex;
        setSpecial(ne);
        saveLocal("dp_events", ne);
      }

      setMsgs(function(prev) { return [...prev, {r:"ai", t: p.message || "Done! Check your Today tab."}]; });
    } catch(e) {
      setMsgs(function(prev) { return [...prev, {r:"ai", t:"Something went wrong. Check your Gemini API key."}]; });
    }
    setLoading(false);
  }

  function voice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported. Use Chrome."); return; }
    const r = new SR();
    r.onstart = function() { setListening(true); };
    r.onend = function() { setListening(false); };
    r.onresult = function(e) { setInput(e.results[0][0].transcript); };
    r.start();
  }

  // ── COLORS ─────────────────────────────────────────────────
  const cream  = "#FFFDF7";
  const gold   = "#FFF8E7";
  const border = "#E8D8A0";
  const orange = "#E76F51";
  const font   = "Nunito,sans-serif";

  // ── TODAY VIEW ─────────────────────────────────────────────
  function TodayView() {
    const sections = SECTIONS.map(function(sec) {
      const tasks = sec.id === "anytime"
        ? todayTasks.filter(function(t){return !t.start;})
        : todayTasks.filter(function(t){ const h=parseInt(t.start||"-1"); return h>=sec.from&&h<sec.to; });
      return Object.assign({},sec,{tasks});
    }).filter(function(s){return s.tasks.length>0;});

    return (
      <div style={{background:cream, minHeight:"100dvh", paddingBottom:90}}>
        <div style={{background:gold, padding:"52px 20px 18px", borderBottom:"2px solid "+border}}>
          <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:4}}>
            <span style={{fontSize:32}}>☀️</span>
            <div>
              <div style={{fontFamily:font, fontWeight:900, fontSize:24, color:"#2C2C2C"}}>Daily Routine</div>
              <div style={{fontFamily:font, fontSize:12, color:"#999", fontWeight:600}}>
                {TODAY.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
              </div>
            </div>
            <div style={{marginLeft:"auto", textAlign:"right"}}>
              <div style={{fontFamily:font, fontWeight:900, fontSize:28, color:"#2C2C2C", lineHeight:1}}>{todayDone}/{todayTasks.length}</div>
              <div style={{fontFamily:font, fontSize:10, color:"#BBB", fontWeight:700}}>DONE</div>
            </div>
          </div>
          {todayTasks.length > 0 && (
            <div style={{marginTop:12, height:7, background:"#EEE5C0", borderRadius:10}}>
              <div style={{height:"100%", background:"linear-gradient(90deg,#F4A261,"+orange+")", borderRadius:10, width:(todayDone/todayTasks.length*100)+"%", transition:"width 0.5s"}}/>
            </div>
          )}
        </div>

        {todayTasks.length === 0 ? (
          <div style={{textAlign:"center", padding:"80px 24px"}}>
            <div style={{fontSize:56, marginBottom:16}}>📋</div>
            <div style={{fontFamily:font, fontWeight:800, fontSize:18, color:"#2C2C2C", marginBottom:8}}>Your planner is empty!</div>
            <div style={{fontFamily:font, fontSize:13, color:"#AAA", marginBottom:24, lineHeight:1.7}}>Go to Chat and tell me your daily routine</div>
            <button onClick={function(){setView("chat");}} style={{padding:"12px 28px", background:orange, color:"#fff", border:"none", borderRadius:14, cursor:"pointer", fontFamily:font, fontWeight:800, fontSize:14}}>Open Chat</button>
          </div>
        ) : (
          <div style={{padding:"16px 16px 0"}}>
            <div style={{display:"grid", gridTemplateColumns:"36px 78px 1fr", marginBottom:8}}>
              <div/>
              <div style={{fontFamily:font, fontWeight:800, fontSize:11, color:"#888", textAlign:"center", background:"#F0E6C0", borderRadius:8, padding:"5px 0", marginRight:6}}>TIME</div>
              <div style={{fontFamily:font, fontWeight:800, fontSize:11, color:"#888", textAlign:"center", background:"#F0E6C0", borderRadius:8, padding:"5px 0"}}>TO-DO</div>
            </div>
            {sections.map(function(sec) {
              return (
                <div key={sec.id} style={{marginBottom:16}}>
                  <div style={{background:sec.color, borderRadius:10, padding:"6px 14px", marginBottom:8, textAlign:"center"}}>
                    <span style={{fontFamily:font, fontWeight:900, fontSize:13, color:sec.text, letterSpacing:1}}>{sec.label.toUpperCase()}</span>
                  </div>
                  {sec.tasks.map(function(task, i) {
                    const done    = todayComps[task.name] === true;
                    const skipped = todayComps[task.name] === false;
                    const emoji   = task.emoji || getEmoji(task.name, task.category||"");
                    return (
                      <div key={i} style={{display:"grid", gridTemplateColumns:"36px 78px 1fr", marginBottom:7, alignItems:"center"}}>
                        <div onClick={function(){mark(task.name, done?undefined:true);}}
                          style={{width:28, height:28, borderRadius:7, border:"2.5px solid "+(done?orange:border), background:done?orange:gold, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto", transition:"all 0.2s"}}>
                          {done && <span style={{color:"#fff", fontSize:16, fontWeight:900}}>✓</span>}
                        </div>
                        <div style={{background:gold, border:"1.5px solid "+border, borderRadius:9, padding:"7px 4px", marginRight:6, textAlign:"center", fontFamily:font, fontWeight:800, fontSize:10, color:done?"#CCC":"#555", textDecoration:done?"line-through":"none"}}>
                          {task.start ? fmt(task.start) : "Any"}
                        </div>
                        <div style={{background:done?"#F5F5F5":"#fff", border:"1.5px solid "+(done?"#EEE":border), borderRadius:9, padding:"8px 10px", display:"flex", alignItems:"center", gap:7}}>
                          <span style={{fontSize:18, flexShrink:0}}>{emoji}</span>
                          <span style={{fontFamily:font, fontWeight:700, fontSize:13, color:done?"#BBB":"#2C2C2C", textDecoration:done?"line-through":"none", flex:1}}>
                            {task.name}
                            {task.isSpecial && <span style={{marginLeft:5, fontSize:9, color:orange, fontWeight:800}}>★</span>}
                          </span>
                          <div onClick={function(){mark(task.name, skipped?undefined:false);}}
                            style={{cursor:"pointer", fontSize:13, color:skipped?orange:"#CCC", flexShrink:0}}>✕</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── WEEKLY VIEW ────────────────────────────────────────────
  function WeeklyView() {
    const sections = SECTIONS.map(function(sec) {
      const tasks = allWeekTasks.filter(function(t) {
        if (sec.id==="anytime") return !t.start;
        const h = parseInt(t.start||"-1");
        return h>=sec.from && h<sec.to;
      });
      return Object.assign({},sec,{tasks});
    }).filter(function(s){return s.tasks.length>0;});

    return (
      <div style={{background:cream, minHeight:"100dvh", paddingBottom:90}}>
        <div style={{background:gold, padding:"52px 20px 18px", borderBottom:"2px solid "+border}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:font, fontSize:10, color:"#AAA", fontWeight:700, letterSpacing:1.5}}>THIS WEEK</div>
              <div style={{fontFamily:font, fontWeight:900, fontSize:24, color:"#2C2C2C", fontStyle:"italic"}}>Weekly Progress</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:font, fontWeight:900, fontSize:36, color:orange, lineHeight:1}}>{weekScore}%</div>
              <div style={{fontFamily:font, fontSize:10, color:"#BBB", fontWeight:700}}>DONE</div>
            </div>
          </div>
        </div>

        {allWeekTasks.length === 0 ? (
          <div style={{textAlign:"center", padding:"80px 24px"}}>
            <div style={{fontFamily:font, fontWeight:800, fontSize:16, color:"#AAA"}}>No schedule yet.</div>
            <button onClick={function(){setView("chat");}} style={{marginTop:16, padding:"12px 28px", background:orange, color:"#fff", border:"none", borderRadius:12, cursor:"pointer", fontFamily:font, fontWeight:800, fontSize:13}}>Open Chat</button>
          </div>
        ) : (
          <div style={{overflowX:"auto", padding:"16px 12px 0"}}>
            <table style={{width:"100%", borderCollapse:"collapse", tableLayout:"fixed", minWidth:340}}>
              {sections.map(function(sec) {
                return (
                  <tbody key={sec.id}>
                    <tr>
                      <td style={{background:sec.color, padding:"8px 10px", fontFamily:font, fontWeight:900, fontSize:13, color:sec.text, width:"44%"}}>{sec.label}</td>
                      {DAY_COL.map(function(d,i){
                        return <td key={i} style={{background:sec.color, padding:"8px 0", textAlign:"center", fontFamily:font, fontWeight:900, fontSize:12, color:WEEKDAYS[i]&&WEEKDAYS[i].isToday?orange:sec.text}}>{d}</td>;
                      })}
                    </tr>
                    {sec.tasks.map(function(task,ti){
                      const emoji = task.emoji || getEmoji(task.name, task.category||"");
                      return (
                        <tr key={ti} style={{background:ti%2===0?cream:"#FFF8EE"}}>
                          <td style={{padding:"8px 10px", border:"1px solid #F0E6C0"}}>
                            <div style={{display:"flex", alignItems:"center", gap:6}}>
                              <span style={{fontSize:14}}>{emoji}</span>
                              <span style={{fontFamily:font, fontWeight:700, fontSize:12, color:"#2C2C2C"}}>{ti+1}. {task.name}</span>
                            </div>
                          </td>
                          {WEEKDAYS.map(function(wd,di){
                            const sched = (schedule[wd.day]||[]).some(function(t){return t.name===task.name;}) || (task.isSpecial&&wd.key===TODAY_KEY);
                            const done  = comps[wd.key]&&comps[wd.key][task.name]===true;
                            return (
                              <td key={di} onClick={function(){if(wd.isToday) mark(task.name,done?undefined:true);}}
                                style={{textAlign:"center", padding:"8px 0", border:"1px sol
