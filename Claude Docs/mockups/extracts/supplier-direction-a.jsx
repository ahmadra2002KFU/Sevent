// direction-a.jsx — Sevent supplier onboarding, Direction A.
// "Restrained / product." Cobalt primary, warm neutrals, generous whitespace.
// Subtle motion: validation ticks pulse, step transitions use a soft slide.
// Live preview card sits quietly in the side rail.

const AShell = ({ children, noNav=false, step=null }) => (
  <div className="mk" style={{ background:C.n50 }}>
    {!noNav && <ATopbar step={step}/>}
    <div style={{ padding: noNav ? 0 : '24px 40px 40px', height:noNav ? '100%' : 'calc(100% - 64px)', overflow:'hidden' }}>
      {children}
    </div>
  </div>
);

const ATopbar = ({ step }) => (
  <div style={{
    height:64, borderBottom:`1px solid ${C.n200}`, background:'#fff',
    display:'flex', alignItems:'center', padding:'0 40px', gap:24,
  }}>
    <SeventLogo size={22}/>
    <div style={{ flex:1 }}/>
    <div style={{ fontSize:13, color:C.n600 }}>{step ? `الخطوة ${ar(step)} من ٣` : ''}</div>
    <div style={{ width:1, height:24, background:C.n200 }}/>
    <button style={{ fontSize:13, color:C.n600, display:'flex', alignItems:'center', gap:6 }}>
      <Icon name="arabic" size={16}/> العربية
    </button>
    <button style={{ fontSize:13, color:C.n600 }}>حفظ والخروج</button>
    <div style={{
      width:34, height:34, borderRadius:17, background:C.cobalt100, color:C.cobalt500,
      display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13,
    }}>أس</div>
  </div>
);

// ── Screen 1: Sign-up (split hero) ─────────────────────────────────────
const ASignup = () => (
  <div className="mk" style={{ display:'flex', background:C.n50 }}>
    {/* left: value prop */}
    <div style={{ width:520, background:C.navy900, color:'#fff', padding:'56px 48px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 20% 0%, ${C.cobalt500}55, transparent 50%)` }}/>
      <div style={{ position:'relative', zIndex:1 }}>
        <SeventLogo size={26} tone="white"/>
        <h1 style={{ fontSize:42, fontWeight:800, lineHeight:1.2, marginTop:48, letterSpacing:-0.5 }}>
          انضمّ لأكبر سوق<br/>فعاليات في المملكة.
        </h1>
        <p style={{ fontSize:15.5, color:'rgba(255,255,255,.72)', marginTop:16, lineHeight:1.75, maxWidth:400 }}>
          {AR.signup.sub}
        </p>
        <ul style={{ marginTop:44, display:'grid', gap:22 }}>
          {AR.signup.why.map((w,i)=>(
            <li key={i} style={{ display:'flex', gap:14 }}>
              <div style={{
                width:40, height:40, borderRadius:10, background:'rgba(30,123,216,.22)',
                color:'#7ab8ff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              }}><Icon name={w.icon} size={20}/></div>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{w.t}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,.6)', marginTop:2, lineHeight:1.6 }}>{w.d}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ position:'absolute', bottom:36, insetInlineStart:48, fontSize:12, color:'rgba(255,255,255,.5)' }}>
        معتمد من الهيئة العامة للترفيه · يعمل في ١٢ مدينة سعودية
      </div>
    </div>

    {/* right: form */}
    <div style={{ flex:1, padding:'80px 72px', overflowY:'auto' }}>
      <div style={{ maxWidth:420 }}>
        <div style={{ fontSize:12.5, color:C.cobalt500, fontWeight:700, letterSpacing:.5 }}>حساب مزوّد خدمة</div>
        <h2 style={{ fontSize:30, fontWeight:800, color:C.navy900, marginTop:8, letterSpacing:-0.5 }}>
          {AR.signup.title}
        </h2>
        <p style={{ fontSize:14.5, color:C.n600, marginTop:10, lineHeight:1.7 }}>
          لديك حساب؟ <a style={{ color:C.cobalt500, fontWeight:600 }}>{AR.signup.signin}</a>
        </p>

        <div style={{ marginTop:32, display:'grid', gap:16 }}>
          <AField label={AR.signup.email} value="nawaf@luxstudio.sa" valid/>
          <AField label={AR.signup.phone} value="٠٥٠ ١٢٣ ٤٥٦٧" prefix="🇸🇦 +966"/>
          <AField label={AR.signup.password} type="password" value="••••••••••" hint={AR.signup.passwordHint}/>
        </div>

        <label style={{ display:'flex', gap:10, alignItems:'flex-start', marginTop:22, fontSize:13, color:C.n600, lineHeight:1.6 }}>
          <span style={{
            width:18, height:18, borderRadius:4, background:C.cobalt500,
            display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', marginTop:2, flexShrink:0,
          }}><Icon name="check" size={13} strokeWidth={3}/></span>
          <span>{AR.signup.terms}</span>
        </label>

        <button style={{
          width:'100%', padding:'14px 16px', borderRadius:10, background:C.cobalt500, color:'#fff',
          fontWeight:700, fontSize:15, marginTop:24, boxShadow:'0 4px 14px rgba(30,123,216,.3)',
        }}>{AR.signup.cta}</button>

        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'28px 0', color:C.n400, fontSize:12 }}>
          <div style={{ flex:1, height:1, background:C.n200 }}/>
          <span>أو</span>
          <div style={{ flex:1, height:1, background:C.n200 }}/>
        </div>

        <button style={{
          width:'100%', padding:'12px 16px', borderRadius:10, border:`1px solid ${C.n200}`,
          background:'#fff', color:C.n900, fontWeight:600, fontSize:14, display:'flex',
          alignItems:'center', justifyContent:'center', gap:10,
        }}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" style={{height:16, width:16}} onError={e=>e.target.style.display='none'}/>
          أكمل باستخدام جوجل
        </button>
      </div>
    </div>
  </div>
);

const AField = ({ label, value, type='text', hint, prefix, valid }) => (
  <div>
    <label style={{ fontSize:13, color:C.n900, fontWeight:600, display:'block', marginBottom:6 }}>{label}</label>
    <div style={{
      position:'relative', display:'flex', alignItems:'center',
      border:`1px solid ${valid ? C.ok500 : C.n200}`, borderRadius:8, background:'#fff',
    }}>
      {prefix && <span style={{ padding:'0 12px', color:C.n600, fontSize:13, borderInlineEnd:`1px solid ${C.n200}` }}>{prefix}</span>}
      <input type={type} defaultValue={value} style={{
        flex:1, padding:'11px 14px', border:0, outline:0, background:'transparent', fontSize:14,
      }}/>
      {valid && (
        <span style={{ padding:'0 12px', color:C.ok500, display:'flex' }}>
          <Icon name="check-circle" size={18} strokeWidth={2}/>
        </span>
      )}
    </div>
    {hint && <div style={{ fontSize:12, color:C.n600, marginTop:5 }}>{hint}</div>}
  </div>
);

// ── Screen 2: Path picker (freelancer vs company) ──────────────────────
const APath = () => (
  <AShell>
    <div style={{ maxWidth:880, margin:'40px auto 0' }}>
      <ResumeCard percent={8} step={1}/>

      <div style={{ textAlign:'center', padding:'20px 0 32px' }}>
        <div style={{ display:'inline-block', padding:'5px 12px', borderRadius:20, background:C.cobalt100,
          color:C.cobalt500, fontSize:12, fontWeight:700 }}>قبل أن نبدأ</div>
        <h1 style={{ fontSize:34, fontWeight:800, color:C.navy900, marginTop:16, letterSpacing:-0.5 }}>
          {AR.path.title}
        </h1>
        <p style={{ fontSize:15, color:C.n600, marginTop:10, lineHeight:1.7 }}>{AR.path.sub}</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <APathCard title={AR.path.freelancerT} desc={AR.path.freelancerD} icon="user"
          steps={['هوية وطنية','شهادة آيبان','نبذة قصيرة']} eta="٥ دقائق"/>
        <APathCard title={AR.path.companyT} desc={AR.path.companyD} icon="building"
          steps={['سجل تجاري','شهادة آيبان','ملف الشركة (اختياري)']} eta="٨ دقائق" active
          tag="شارة مزوّد موثّق"/>
      </div>

      <div style={{ display:'flex', justifyContent:'center', marginTop:32, gap:12 }}>
        <button style={{ padding:'12px 28px', fontSize:14, color:C.n600 }}>{AR.wizard.back}</button>
        <button style={{
          padding:'12px 28px', borderRadius:10, background:C.navy900, color:'#fff',
          fontWeight:700, fontSize:14.5, display:'flex', alignItems:'center', gap:8,
        }}>{AR.path.cta} <Icon name="chevron-left" size={16}/></button>
      </div>
    </div>
  </AShell>
);

const APathCard = ({ title, desc, icon, steps, eta, active, tag }) => (
  <div style={{
    background:'#fff', borderRadius:14, padding:28,
    border:`2px solid ${active ? C.cobalt500 : C.n200}`,
    boxShadow: active ? '0 10px 30px rgba(30,123,216,.12)' : 'var(--shadow)',
    position:'relative',
  }}>
    {tag && <div style={{
      position:'absolute', top:-12, insetInlineEnd:20, background:C.gold500, color:'#fff',
      fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6,
      display:'flex', alignItems:'center', gap:5,
    }}><Icon name="badge-check" size={12} strokeWidth={2.4}/> {tag}</div>}
    <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
      <div style={{
        width:52, height:52, borderRadius:12,
        background: active ? C.cobalt500 : C.cobalt100,
        color: active ? '#fff' : C.cobalt500,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}><Icon name={icon} size={26}/></div>
      <div style={{ flex:1 }}>
        <h3 style={{ fontSize:19, fontWeight:800, color:C.navy900 }}>{title}</h3>
        <p style={{ fontSize:13.5, color:C.n600, marginTop:5, lineHeight:1.65 }}>{desc}</p>
      </div>
      {active && <span style={{
        width:22, height:22, borderRadius:11, background:C.cobalt500, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}><Icon name="check" size={14} strokeWidth={3}/></span>}
    </div>

    <div style={{ marginTop:20, paddingTop:16, borderTop:`1px solid ${C.n200}` }}>
      <div style={{ fontSize:11, color:C.n600, fontWeight:600, letterSpacing:.4, marginBottom:10 }}>
        ما ستحتاجه
      </div>
      <ul style={{ display:'grid', gap:8 }}>
        {steps.map((s,i)=>(
          <li key={i} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13.5, color:C.n900 }}>
            <Icon name="dot" size={6} style={{ color:C.cobalt500 }}/> {s}
          </li>
        ))}
      </ul>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:16, fontSize:12, color:C.n600 }}>
        <Icon name="clock" size={13}/> يستغرق {eta} تقريباً
      </div>
    </div>
  </div>
);

// ── Wizard shell with stepper + side preview ───────────────────────────
const AWizardShell = ({ step, children, previewData }) => (
  <AShell step={step}>
    <div style={{ maxWidth:1180, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 340px', gap:32, height:'100%' }}>
      <div style={{ overflowY:'auto', paddingInlineEnd:8 }}>
        <AStepper current={step}/>
        {children}
      </div>
      <APreviewRail data={previewData} step={step}/>
    </div>
  </AShell>
);

const AStepper = ({ current }) => {
  const steps = [AR.wizard.step1, AR.wizard.step2, AR.wizard.step3];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:28 }}>
      {steps.map((s,i)=>{
        const done = i+1 < current, active = i+1 === current;
        return (
          <React.Fragment key={i}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{
                width:28, height:28, borderRadius:14,
                background: done ? C.ok500 : active ? C.cobalt500 : C.n200,
                color: done || active ? '#fff' : C.n600,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700,
              }}>
                {done ? <Icon name="check" size={14} strokeWidth={3}/> : ar(i+1)}
              </div>
              <span style={{ fontSize:13.5, fontWeight: active ? 700 : 500,
                color: active ? C.navy900 : C.n600 }}>{s}</span>
            </div>
            {i < steps.length-1 && (
              <div style={{ flex:1, height:2, background: done ? C.ok500 : C.n200, margin:'0 16px', borderRadius:1 }}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const APreviewRail = ({ data, step }) => (
  <div style={{ position:'sticky', top:0, alignSelf:'start' }}>
    <div style={{ fontSize:11, color:C.n600, fontWeight:700, letterSpacing:.4, marginBottom:8 }}>
      معاينة حيّة · كما سيراها المنظّمون
    </div>
    <ProfilePreview {...data}/>
    <div style={{
      marginTop:16, padding:'12px 14px', background:C.cobalt100, borderRadius:10,
      fontSize:12.5, color:C.navy900, lineHeight:1.6, display:'flex', gap:10,
    }}>
      <Icon name="sparkles" size={16} style={{ color:C.cobalt500, flexShrink:0, marginTop:2 }}/>
      <span>
        {step===1 && 'أكمل حقل النبذة لتحفّز ثقة المنظّمين — ملفات مكتملة تحصل على طلبات عروض أكثر بـ٤٠٪.'}
        {step===2 && 'الفئات الدقيقة تجذب طلبات عروض أعلى جودة. ٣–٤ فئات أفضل من ١٠.'}
        {step===3 && 'شهادة الآيبان تضمن وصول أرباحك خلال ٢٤ ساعة من انتهاء الفعالية.'}
      </span>
    </div>
  </div>
);

// ── Screen 3: Step 1 — business info ───────────────────────────────────
const AStep1 = () => {
  const preview = { name:'استوديو أضواء الرياض', bio:'إضاءة مسرح وإنتاج بصري لفعاليات مؤسسات المملكة منذ ٢٠١٩.',
    city:'الرياض', categories:[], accent:C.cobalt500 };
  return (
    <AWizardShell step={1} previewData={preview}>
      <h2 style={{ fontSize:24, fontWeight:800, color:C.navy900 }}>{AR.wizard.step1}</h2>
      <p style={{ fontSize:13.5, color:C.n600, marginTop:6, lineHeight:1.7 }}>
        ستظهر هذه المعلومات في ملفك العام — يمكنك تعديلها لاحقاً.
      </p>

      <div style={{
        marginTop:18, padding:14, border:`1px dashed ${C.cobalt500}55`, borderRadius:10,
        background:`${C.cobalt100}55`, display:'flex', alignItems:'center', gap:12,
      }}>
        <div style={{ width:36, height:36, borderRadius:10, background:'#fff', color:C.cobalt500,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon name="link" size={18}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:C.navy900 }}>{AR.wizard.importUrl}</div>
          <div style={{ fontSize:12, color:C.n600, marginTop:2 }}>{AR.wizard.importUrlSub}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input placeholder="https://" style={{
            padding:'8px 12px', border:`1px solid ${C.n200}`, borderRadius:7, background:'#fff',
            fontSize:13, width:180, outline:0,
          }}/>
          <button style={{ padding:'8px 14px', borderRadius:7, background:C.navy900, color:'#fff', fontWeight:600, fontSize:13 }}>
            {AR.wizard.importUrlCta}
          </button>
        </div>
      </div>

      <div style={{ marginTop:24, display:'grid', gap:20 }}>
        <AField label={AR.wizard.businessName} value="استوديو أضواء الرياض" valid/>

        <div>
          <label style={{ fontSize:13, color:C.n900, fontWeight:600, display:'block', marginBottom:6 }}>
            {AR.wizard.bio}
          </label>
          <div style={{ border:`1px solid ${C.cobalt500}`, borderRadius:8, background:'#fff',
            boxShadow:`0 0 0 3px ${C.cobalt500}22` }}>
            <textarea defaultValue="إضاءة مسرح وإنتاج بصري لفعاليات مؤسسات المملكة منذ ٢٠١٩. فريق من ١٢ مهندساً ومعدات بمواصفات عالمية."
              style={{ width:'100%', padding:'11px 14px', border:0, outline:0, background:'transparent',
                fontSize:14, resize:'none', minHeight:80, fontFamily:'inherit', lineHeight:1.7 }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'6px 12px', borderTop:`1px solid ${C.n200}`, fontSize:11.5, color:C.n600 }}>
              <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                <Icon name="check-circle" size={12} style={{ color:C.ok500 }}/> {AR.wizard.draftSaved}
              </span>
              <span>{ar(127)}/٢٤٠</span>
            </div>
          </div>
          <div style={{ fontSize:12, color:C.n600, marginTop:5 }}>{AR.wizard.bioHint}</div>
        </div>

        <AField label={AR.wizard.crNumber} value="١٠١٠٢٣٤٥٦٧" valid hint={AR.wizard.crNumberHint}/>

        <div style={{
          padding:'10px 14px', borderRadius:8, background:C.ok100,
          display:'flex', alignItems:'center', gap:10, fontSize:13, color:C.navy900,
        }}>
          <Icon name="shield" size={16} style={{ color:C.ok500 }}/>
          <span><b>تحقّق تلقائي من واثق:</b> استوديو أضواء الرياض · نشط · الرياض · منذ ٢٠١٩</span>
          <Icon name="check-circle" size={16} style={{ color:C.ok500, marginInlineStart:'auto' }}/>
        </div>

        <div>
          <label style={{ fontSize:13, color:C.n900, fontWeight:600, display:'block', marginBottom:6 }}>
            {AR.wizard.baseCity}
          </label>
          <div style={{ display:'flex', alignItems:'center', gap:10,
            padding:'11px 14px', border:`1px solid ${C.n200}`, borderRadius:8, background:'#fff' }}>
            <Icon name="map-pin" size={16} style={{ color:C.n600 }}/>
            <span style={{ fontSize:14, fontWeight:500 }}>الرياض</span>
            <Icon name="chevron-down" size={16} style={{ color:C.n600, marginInlineStart:'auto' }}/>
          </div>
        </div>

        <div>
          <label style={{ fontSize:13, color:C.n900, fontWeight:600, display:'block', marginBottom:6 }}>
            {AR.wizard.serviceArea}
          </label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'10px',
            border:`1px solid ${C.n200}`, borderRadius:8, background:'#fff', minHeight:48, alignItems:'center' }}>
            {['الرياض','الدمام','الخبر','جدة'].map(c=>(
              <span key={c} style={{
                background:C.cobalt100, color:C.cobalt500, fontSize:13, fontWeight:600,
                padding:'4px 10px', borderRadius:15, display:'inline-flex', alignItems:'center', gap:6,
              }}>{c} <Icon name="x" size={12}/></span>
            ))}
            <input placeholder="أضِف مدينة…" style={{ border:0, outline:0, padding:'4px 8px', fontSize:13, flex:1, minWidth:120 }}/>
          </div>
        </div>

        <div>
          <label style={{ fontSize:13, color:C.n900, fontWeight:600, display:'block', marginBottom:8 }}>
            {AR.wizard.languages}
          </label>
          <div style={{ display:'flex', gap:8 }}>
            {[['ar','العربية',true],['en','English',true],['ur','اردو',false]].map(([k,l,sel])=>(
              <span key={k} style={{
                padding:'8px 16px', borderRadius:20, fontSize:13, fontWeight:600,
                border:`1px solid ${sel ? C.cobalt500 : C.n200}`,
                background: sel ? C.cobalt100 : '#fff',
                color: sel ? C.cobalt500 : C.n600,
                display:'inline-flex', alignItems:'center', gap:6,
              }}>
                {sel && <Icon name="check" size={13} strokeWidth={3}/>}
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>

      <AWizNav nextLabel={AR.wizard.continue}/>
    </AWizardShell>
  );
};

const AWizNav = ({ showBack=true, nextLabel=AR.wizard.continue }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:32,
    paddingTop:20, borderTop:`1px solid ${C.n200}` }}>
    {showBack ? <button style={{ padding:'11px 20px', fontSize:14, color:C.n600, fontWeight:600,
      display:'flex', alignItems:'center', gap:6 }}>
      <Icon name="chevron-right" size={16}/> {AR.wizard.back}
    </button> : <div/>}
    <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:12, color:C.n600 }}>
      <Icon name="check-circle" size={13} style={{ color:C.ok500 }}/> {AR.wizard.draftSaved}
      <button style={{
        padding:'12px 28px', borderRadius:10, background:C.navy900, color:'#fff',
        fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:8, marginInlineStart:8,
      }}>{nextLabel} <Icon name="chevron-left" size={16}/></button>
    </div>
  </div>
);

// ── Screen 4: Step 2 — categories + segments ───────────────────────────
const AStep2 = () => {
  const preview = { name:'استوديو أضواء الرياض', bio:'إضاءة مسرح وإنتاج بصري لفعاليات مؤسسات المملكة منذ ٢٠١٩.',
    city:'الرياض', categories:['إضاءة المسرح','أنظمة الصوت','بث مباشر'], accent:C.cobalt500 };
  const selected = ['إضاءة المسرح','أنظمة الصوت','بث مباشر'];
  const all = ['إضاءة المسرح','أنظمة الصوت','إضاءة معمارية','تصوير فوتوغرافي','تصوير فيديو + بث مباشر','شاشات LED','مسارح متنقّلة','ضيافة فاخرة','تغطية قهوة عربية','ورود وتنسيق'];

  return (
    <AWizardShell step={2} previewData={preview}>
      <h2 style={{ fontSize:24, fontWeight:800, color:C.navy900 }}>{AR.wizard.step2}</h2>
      <p style={{ fontSize:13.5, color:C.n600, marginTop:6, lineHeight:1.7 }}>
        {AR.wizard.categoriesHint}
      </p>

      <div style={{ marginTop:24 }}>
        <label style={{ fontSize:13, color:C.n900, fontWeight:600, display:'block', marginBottom:10 }}>
          {AR.wizard.categories} <span style={{ color:C.n600, fontWeight:400 }}>· {ar(selected.length)} من ٦</span>
        </label>

        {/* selected chips */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          {selected.map(s=>(
            <span key={s} style={{
              padding:'8px 14px', borderRadius:20, background:C.cobalt500, color:'#fff',
              fontSize:13, fontWeight:600, display:'inline-flex', alignItems:'center', gap:8,
            }}>
              <Icon name="check" size={13} strokeWidth={3}/> {s}
              <button style={{ color:'rgba(255,255,255,.7)' }}><Icon name="x" size={13}/></button>
            </span>
          ))}
        </div>

        {/* search */}
        <div style={{ position:'relative', marginBottom:16 }}>
          <input placeholder="ابحث عن فئة…" style={{
            width:'100%', padding:'11px 14px 11px 40px', border:`1px solid ${C.n200}`, borderRadius:8,
            background:'#fff', fontSize:13.5, outline:0,
          }}/>
        </div>

        {/* all as pill cloud */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {all.map(c=> {
            const sel = selected.includes(c);
            return (
              <button key={c} style={{
                padding:'9px 16px', borderRadius:20, fontSize:13, fontWeight:500,
                border:`1px solid ${sel ? C.cobalt500 : C.n200}`,
                background: sel ? C.cobalt100 : '#fff',
                color: sel ? C.cobalt500 : C.n900,
                display:'inline-flex', alignItems:'center', gap:6,
              }}>
                <Icon name={sel ? 'check' : 'plus'} size={13} strokeWidth={sel ? 3 : 2.4}/>
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop:32 }}>
        <label style={{ fontSize:13, color:C.n900, fontWeight:600, display:'block', marginBottom:6 }}>
          {AR.wizard.segments}
        </label>
        <p style={{ fontSize:12.5, color:C.n600, marginBottom:12 }}>{AR.wizard.segmentsHint}</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {SEGMENTS.map((s,i)=>{
            const sel = i < 3;
            return (
              <button key={s.s} style={{
                padding:'14px', borderRadius:10, textAlign:'start',
                border:`1px solid ${sel ? C.cobalt500 : C.n200}`,
                background: sel ? C.cobalt100 : '#fff',
                display:'flex', alignItems:'center', gap:10,
              }}>
                <span style={{
                  width:20, height:20, borderRadius:4, flexShrink:0,
                  border:`1.8px solid ${sel ? C.cobalt500 : C.n400}`,
                  background: sel ? C.cobalt500 : '#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  {sel && <Icon name="check" size={12} strokeWidth={3} style={{color:'#fff'}}/>}
                </span>
                <span style={{ fontSize:13.5, fontWeight:600 }}>{s.ar}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AWizNav/>
    </AWizardShell>
  );
};

// ── Screen 5: Step 3 — documents + logo ────────────────────────────────
const AStep3 = () => {
  const preview = { name:'استوديو أضواء الرياض', bio:'إضاءة مسرح وإنتاج بصري لفعاليات مؤسسات المملكة منذ ٢٠١٩.',
    city:'الرياض', categories:['إضاءة المسرح','أنظمة الصوت','بث مباشر'], accent:C.cobalt500,
    logo:null };
  return (
    <AWizardShell step={3} previewData={preview}>
      <h2 style={{ fontSize:24, fontWeight:800, color:C.navy900 }}>{AR.wizard.step3}</h2>
      <p style={{ fontSize:13.5, color:C.n600, marginTop:6, lineHeight:1.7 }}>
        نحتاج هذه المستندات لإصدار شارة مزوّد موثّق وصرف أرباحك.
      </p>

      <div style={{ marginTop:24, display:'grid', gap:16 }}>
        {/* Logo uploader — with preview */}
        <AUploader label={AR.wizard.logoLabel} hint={AR.wizard.logoHint} type="image" uploaded/>
        <AUploader label={AR.wizard.iban} hint={AR.wizard.ibanHint} type="pdf" uploaded filename="IBAN_SNB_4821.pdf" size="٢٤٧ ك.ب" verified/>
        <AUploader label={AR.wizard.companyProfile} hint={AR.wizard.companyProfileHint} type="pdf" optional/>
      </div>

      <div style={{
        marginTop:22, padding:14, borderRadius:10, background:C.warn100,
        border:`1px solid ${C.warn500}33`,
        fontSize:13, color:C.navy900, lineHeight:1.6, display:'flex', gap:10,
      }}>
        <Icon name="shield" size={18} style={{ color:C.warn500, flexShrink:0, marginTop:1 }}/>
        <span>
          <b>مستنداتك بأمان:</b> لن تُعرض للمنظّمين. يطّلع عليها فقط فريق التوثيق الداخلي.
        </span>
      </div>

      <AWizNav nextLabel={AR.wizard.submit}/>
    </AWizardShell>
  );
};

const AUploader = ({ label, hint, type, uploaded, filename, size, verified, optional }) => (
  <div>
    <label style={{ fontSize:13, color:C.n900, fontWeight:600, display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
      {label}
      {optional && <span style={{ fontSize:11, color:C.n400, fontWeight:500 }}>(اختياري)</span>}
    </label>
    {uploaded ? (
      <div style={{
        border:`1px solid ${C.ok500}`, background:C.ok100, borderRadius:8, padding:'12px 14px',
        display:'flex', alignItems:'center', gap:12,
      }}>
        <div style={{ width:40, height:40, borderRadius:8, background:'#fff', display:'flex',
          alignItems:'center', justifyContent:'center', color:type==='image'?C.cobalt500:C.navy900 }}>
          {type==='image' ? <Icon name="image" size={22}/> : <Icon name="file" size={20}/>}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:C.n900 }}>
            {type==='image' ? 'logo.svg' : filename}
          </div>
          <div style={{ fontSize:12, color:C.n600, marginTop:2, display:'flex', alignItems:'center', gap:8 }}>
            <span>{type==='image' ? '١٢ ك.ب · SVG' : size}</span>
            {verified && <span style={{ color:C.ok500, display:'flex', alignItems:'center', gap:3 }}>
              <Icon name="check-circle" size={12} strokeWidth={2.2}/> مُتحقق
            </span>}
          </div>
        </div>
        <button style={{ fontSize:12.5, color:C.n600, fontWeight:600 }}>استبدال</button>
      </div>
    ) : (
      <div style={{
        border:`1.5px dashed ${C.n200}`, borderRadius:8, padding:'22px 18px',
        display:'flex', alignItems:'center', gap:14, background:'#fff',
      }}>
        <div style={{ width:44, height:44, borderRadius:10, background:C.n100, color:C.n600,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon name="upload" size={22}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13.5, color:C.n900 }}>
            <span style={{ color:C.cobalt500, fontWeight:700 }}>اضغط للرفع</span> أو اسحب الملف هنا
          </div>
          <div style={{ fontSize:12, color:C.n600, marginTop:3 }}>{hint}</div>
        </div>
      </div>
    )}
  </div>
);

// ── Screen 6: Pending review ───────────────────────────────────────────
const APending = () => (
  <AShell>
    <div style={{ maxWidth:980, margin:'24px auto 0' }}>
      <div style={{
        background:'linear-gradient(135deg, #fff 0%, ' + C.cobalt100 + '55 100%)',
        border:`1px solid ${C.n200}`, borderRadius:16, padding:32,
        display:'flex', alignItems:'flex-start', gap:24,
      }}>
        <div style={{
          width:72, height:72, borderRadius:36, background:'#fff',
          border:`3px solid ${C.cobalt500}`, flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:C.cobalt500, position:'relative',
        }}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ position:'absolute', inset:-3 }}>
            <circle cx="36" cy="36" r="34" fill="none" stroke={C.cobalt500} strokeWidth="3" strokeDasharray="50 214" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 36 36" to="360 36 36" dur="2s" repeatCount="indefinite"/>
            </circle>
          </svg>
          <Icon name="shield" size={32}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12.5, color:C.cobalt500, fontWeight:700, letterSpacing:.3 }}>
            حالة الطلب · قيد المراجعة
          </div>
          <h1 style={{ fontSize:30, fontWeight:800, color:C.navy900, marginTop:8, letterSpacing:-0.4 }}>
            {AR.pending.title}
          </h1>
          <p style={{ fontSize:14.5, color:C.n600, marginTop:10, lineHeight:1.7, maxWidth:600 }}>
            {AR.pending.sub} سنرسل إشعاراً على <b style={{ color:C.navy900 }}>nawaf@luxstudio.sa</b> فور اعتماد ملفك.
          </p>
          <div style={{ display:'flex', gap:10, marginTop:18 }}>
            <button style={{ padding:'10px 18px', borderRadius:8, background:C.navy900, color:'#fff', fontWeight:600, fontSize:13.5 }}>
              {AR.pending.cta}
            </button>
            <button style={{ padding:'10px 18px', borderRadius:8, background:'#fff', border:`1px solid ${C.n200}`,
              color:C.n900, fontWeight:600, fontSize:13.5, display:'flex', alignItems:'center', gap:6 }}>
              <Icon name="chat" size={15}/> {AR.pending.chatCta}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:20, marginTop:20 }}>
        {/* Checklist */}
        <div style={{ background:'#fff', border:`1px solid ${C.n200}`, borderRadius:14, padding:'18px 20px' }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:C.navy900 }}>{AR.pending.checklistTitle}</h3>
          <ul>
            {AR.pending.checks.map(c => <ChecklistRow key={c.k} item={c}/>)}
          </ul>
        </div>

        {/* Timeline */}
        <div>
          <div style={{ background:'#fff', border:`1px solid ${C.n200}`, borderRadius:14, padding:'18px 20px', marginBottom:16 }}>
            <h3 style={{ fontSize:15, fontWeight:700, color:C.navy900, marginBottom:14 }}>{AR.pending.timelineTitle}</h3>
            <div style={{ position:'relative', paddingInlineStart:16 }}>
              <div style={{ position:'absolute', insetInlineStart:6, top:4, bottom:4, width:1.5, background:C.n200 }}/>
              {AR.pending.timeline.map((t,i)=>(
                <div key={i} style={{ position:'relative', paddingBottom:16 }}>
                  <div style={{
                    position:'absolute', insetInlineStart:-12, top:2, width:13, height:13, borderRadius:7,
                    background: i===0 ? C.cobalt500 : '#fff', border:`2px solid ${i===0 ? C.cobalt500 : C.n200}`,
                  }}/>
                  <div style={{ fontSize:13.5, fontWeight:700, color:C.navy900 }}>{t.t}</div>
                  <div style={{ fontSize:12, color:C.n600, marginTop:2 }}>{t.d}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:C.navy900, color:'#fff', borderRadius:14, padding:'20px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-30, insetInlineEnd:-30, width:120, height:120, borderRadius:60,
              background:`${C.cobalt500}44`, filter:'blur(30px)' }}/>
            <Icon name="sparkles" size={22} style={{ color:C.gold500 }}/>
            <div style={{ fontSize:14.5, fontWeight:700, marginTop:10, lineHeight:1.5 }}>
              أكمل ملفك العام لتحصل على طلبات أكثر
            </div>
            <p style={{ fontSize:12.5, color:'rgba(255,255,255,.65)', marginTop:6, lineHeight:1.65 }}>
              أضِف صور أعمال سابقة، معرض مشاريع، وباقات جاهزة — يتضاعف عدد الطلبات عادةً بعد إكمال هذه البنود.
            </p>
            <button style={{ marginTop:14, padding:'8px 14px', borderRadius:7,
              background:'rgba(255,255,255,.15)', color:'#fff', fontSize:12.5, fontWeight:600 }}>
              ابدأ بينما تنتظر ←
            </button>
          </div>
        </div>
      </div>
    </div>
  </AShell>
);

// ── Screen 7: Approved / first login ──────────────────────────────────
const AApproved = () => (
  <AShell>
    <div style={{ maxWidth:1060, margin:'16px auto 0' }}>
      {/* celebration banner */}
      <div style={{
        background:`linear-gradient(105deg, ${C.ok500} 0%, ${C.cobalt500} 100%)`,
        borderRadius:16, padding:'28px 32px', color:'#fff', position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
          {Array.from({length:14}).map((_,i)=>(
            <div key={i} style={{
              position:'absolute', top:Math.random()*100+'%', insetInlineStart:Math.random()*100+'%',
              width:6+Math.random()*4, height:10+Math.random()*6,
              background:[C.gold500,'#fff',C.cobalt100][i%3], borderRadius:1,
              transform:`rotate(${Math.random()*360}deg)`, opacity:.8,
            }}/>
          ))}
        </div>
        <div style={{ position:'relative', display:'flex', alignItems:'center', gap:24 }}>
          <div style={{ width:64, height:64, borderRadius:32, background:'rgba(255,255,255,.2)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Icon name="badge-check" size={34}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12.5, fontWeight:700, letterSpacing:.4, opacity:.85 }}>مبروك، نوّاف</div>
            <h1 style={{ fontSize:30, fontWeight:800, marginTop:4, letterSpacing:-0.4 }}>
              {AR.welcome.congrats}
            </h1>
            <p style={{ fontSize:14.5, opacity:.9, marginTop:8, lineHeight:1.7, maxWidth:600 }}>
              {AR.welcome.sub}
            </p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button style={{ padding:'10px 20px', borderRadius:9, background:'#fff', color:C.navy900, fontWeight:700, fontSize:13.5 }}>
              {AR.welcome.cta1} ({ar(3)})
            </button>
            <button style={{ padding:'10px 20px', borderRadius:9, background:'rgba(0,0,0,.15)', color:'#fff', fontWeight:600, fontSize:13.5, border:'1px solid rgba(255,255,255,.2)' }}>
              {AR.welcome.cta2}
            </button>
          </div>
        </div>
      </div>

      {/* First-run dashboard */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginTop:20 }}>
        <AKpi label="طلبات العروض" value={ar(3)} sub="جديد" accent={C.cobalt500}/>
        <AKpi label="زيارات ملفك" value={ar(12)} sub="آخر ٢٤ ساعة" accent={C.ok500}/>
        <AKpi label="وقت الاستجابة" value={`${ar(2)}س`} sub="متوسط" accent={C.gold500}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20, marginTop:20 }}>
        <div style={{ background:'#fff', border:`1px solid ${C.n200}`, borderRadius:14, padding:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:15, fontWeight:700, color:C.navy900 }}>طلبات عروض مناسبة لك</h3>
            <button style={{ fontSize:12.5, color:C.cobalt500, fontWeight:600 }}>عرض الكل</button>
          </div>
          {[
            { org:'أرامكو · فعالية تدريبية', city:'الرياض', date:'٢ مايو', budget:'٣٥–٥٠ ألف ر.س', match:92 },
            { org:'Noon.com · إطلاق منتج', city:'جدة', date:'١٨ مايو', budget:'٦٠–٨٠ ألف ر.س', match:84 },
            { org:'نيوم · ورشة إعلامية', city:'تبوك', date:'٢٥ مايو', budget:'٢٠–٣٠ ألف ر.س', match:71 },
          ].map((r,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 0',
              borderTop: i?`1px solid ${C.n200}`:'none' }}>
              <div style={{ width:42, height:42, borderRadius:8, background:C.n100, color:C.n600,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>
                {r.org.split(' ')[0].slice(0,2)}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.navy900 }}>{r.org}</div>
                <div style={{ fontSize:12, color:C.n600, marginTop:3, display:'flex', alignItems:'center', gap:10 }}>
                  <span><Icon name="map-pin" size={11}/> {r.city}</span>
                  <span><Icon name="clock" size={11}/> {r.date}</span>
                  <span>{r.budget}</span>
                </div>
              </div>
              <div style={{ textAlign:'end' }}>
                <div style={{ fontSize:12, fontWeight:700, color: r.match>80 ? C.ok500 : C.gold500 }}>
                  {ar(r.match)}٪ تطابق
                </div>
                <button style={{ fontSize:12, color:C.cobalt500, fontWeight:600, marginTop:4 }}>أرسل عرضاً ←</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background:'#fff', border:`1px solid ${C.n200}`, borderRadius:14, padding:'20px' }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:C.navy900 }}>{AR.welcome.tourTitle}</h3>
          <p style={{ fontSize:12.5, color:C.n600, marginTop:6, lineHeight:1.6 }}>
            تعرّف على ميزاتك الأساسية في جولة سريعة.
          </p>
          <div style={{ marginTop:14, display:'grid', gap:10 }}>
            {[
              { t:'كيف تكتب عرضاً يربح', d:'٣ نصائح من أفضل المزوّدين', done:true },
              { t:'جدولة التقويم ومنع التعارض', d:'سيطر على توفّرك', done:false },
              { t:'إدارة الباقات والأسعار', d:'حدِّد أسعارك بذكاء', done:false },
            ].map((x,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
                background: x.done ? C.ok100 : C.n100, borderRadius:10 }}>
                <div style={{ width:28, height:28, borderRadius:14, background:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color: x.done ? C.ok500 : C.n600 }}>
                  {x.done ? <Icon name="check" size={15} strokeWidth={3}/> : <Icon name="eye" size={14}/>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.navy900 }}>{x.t}</div>
                  <div style={{ fontSize:11.5, color:C.n600, marginTop:1 }}>{x.d}</div>
                </div>
                <Icon name="chevron-left" size={14} style={{ color:C.n600 }}/>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </AShell>
);

const AKpi = ({ label, value, sub, accent }) => (
  <div style={{ background:'#fff', border:`1px solid ${C.n200}`, borderRadius:12, padding:'16px 18px',
    display:'flex', alignItems:'center', gap:14 }}>
    <div style={{ width:36, height:36, borderRadius:10, background:accent+'22', color:accent,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Icon name="trending" size={18}/>
    </div>
    <div>
      <div style={{ fontSize:11.5, color:C.n600, fontWeight:600 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color:C.navy900, lineHeight:1.1, marginTop:2 }}>{value}</div>
      <div style={{ fontSize:11, color:C.n600 }}>{sub}</div>
    </div>
  </div>
);

// ── Export screen list ─────────────────────────────────────────────────
const directionAScreens = [
  { id:'a1', label:'1 · إنشاء الحساب', render: () => <ASignup/> },
  { id:'a2', label:'2 · اختيار المسار', render: () => <APath/> },
  { id:'a3', label:'3 · الخطوة ١: معلومات النشاط', render: () => <AStep1/> },
  { id:'a4', label:'4 · الخطوة ٢: الفئات', render: () => <AStep2/> },
  { id:'a5', label:'5 · الخطوة ٣: التوثيق', render: () => <AStep3/> },
  { id:'a6', label:'6 · قيد المراجعة', render: () => <APending/> },
  { id:'a7', label:'7 · تم الاعتماد', render: () => <AApproved/> },
];

Object.assign(window, { directionAScreens, AStep2 });
