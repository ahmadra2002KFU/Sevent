// direction-b.jsx — Sevent supplier onboarding, Direction B.
// "Bolder / branded." Full-bleed navy hero, big editorial type, gold+cobalt
// accents, the live profile preview as a co-equal hero element (not a rail).
// Motion is more generous: sparkles on verification, confetti on approval,
// stepper morphs as it progresses.

const BShell = ({ children, dark=false, chrome=true }) => (
  <div className="mk" style={{
    background: dark ? C.navy900 : C.n50,
    color: dark ? '#fff' : C.n900,
    position:'relative', overflow:'hidden',
  }}>
    {chrome && <BTopbar dark={dark}/>}
    {children}
  </div>
);

const BTopbar = ({ dark }) => (
  <div style={{
    height:64, display:'flex', alignItems:'center', padding:'0 40px', gap:20,
    borderBottom: dark ? '1px solid rgba(255,255,255,.1)' : `1px solid ${C.n200}`,
    position:'relative', zIndex:5,
    background: dark ? 'transparent' : '#fff',
  }}>
    <SeventLogo size={22} tone={dark ? 'white' : 'color'}/>
    <div style={{ flex:1 }}/>
    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13,
      color: dark ? 'rgba(255,255,255,.7)' : C.n600,
      padding:'5px 12px', borderRadius:20,
      background: dark ? 'rgba(255,255,255,.08)' : C.n100 }}>
      <Icon name="arabic" size={16}/> العربية · AR
    </div>
    <button style={{ fontSize:13, color: dark ? 'rgba(255,255,255,.7)' : C.n600 }}>
      {AR.wizard.saveAndExit}
    </button>
  </div>
);

// ── Animated navy hero background used by several screens ──────────────
const BHeroBg = ({ children, height='auto' }) => (
  <div style={{
    position:'relative', background:C.navy900, color:'#fff', overflow:'hidden',
    height,
  }}>
    {/* mesh gradient */}
    <div style={{ position:'absolute', inset:0,
      background:`radial-gradient(circle at 15% 20%, ${C.cobalt500}88, transparent 45%),
                  radial-gradient(circle at 85% 85%, ${C.gold500}55, transparent 45%),
                  radial-gradient(circle at 70% 15%, ${C.navy700}, transparent 50%)` }}/>
    {/* arabic-style geometric pattern overlay (very subtle) */}
    <svg style={{ position:'absolute', inset:0, opacity:.07, width:'100%', height:'100%' }}>
      <defs>
        <pattern id="bgeo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M40 0 L80 40 L40 80 L0 40 Z" fill="none" stroke="#fff" strokeWidth="1"/>
          <circle cx="40" cy="40" r="14" fill="none" stroke="#fff" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bgeo)"/>
    </svg>
    {/* floating orbs */}
    <div style={{ position:'absolute', top:-80, insetInlineStart:-60, width:280, height:280, borderRadius:140,
      background:`radial-gradient(circle, ${C.cobalt500}66, transparent 70%)`, filter:'blur(30px)',
      animation:'floatOrb 9s ease-in-out infinite' }}/>
    <div style={{ position:'absolute', bottom:-100, insetInlineEnd:-80, width:320, height:320, borderRadius:160,
      background:`radial-gradient(circle, ${C.gold500}44, transparent 70%)`, filter:'blur(40px)',
      animation:'floatOrb 12s ease-in-out infinite reverse' }}/>
    <div style={{ position:'relative', zIndex:1, height:'100%' }}>{children}</div>
  </div>
);

// ── Screen 1: Sign-up ──────────────────────────────────────────────────
const BSignup = () => (
  <BShell dark chrome={false}>
    <BHeroBg height="100%">
      <div style={{ display:'flex', height:'100%' }}>
        <div style={{ flex:1, padding:'40px 56px 40px 72px', display:'flex', flexDirection:'column' }}>
          <SeventLogo size={24} tone="white"/>
          <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', maxWidth:540 }}>
            <div style={{ display:'inline-flex', alignSelf:'start', alignItems:'center', gap:8,
              padding:'6px 14px', borderRadius:20, background:'rgba(200,153,58,.18)',
              border:`1px solid ${C.gold500}55`, color:C.gold500, fontSize:12, fontWeight:700,
              letterSpacing:.4 }}>
              <Icon name="star" size={13}/> أكثر من ١٢٠٠ مزوّد سعودي يثقون بسِفنت
            </div>
            <h1 style={{ fontSize:58, fontWeight:900, lineHeight:1.08, marginTop:24,
              letterSpacing:-1.2 }}>
              فعالياتك <em style={{ fontStyle:'normal', color:C.gold500 }}>تستحقّ</em><br/>
              منصّة واحدة.
            </h1>
            <p style={{ fontSize:16, color:'rgba(255,255,255,.75)', marginTop:20, lineHeight:1.75, maxWidth:440 }}>
              سِفنت يربط مزوّدي الخدمة بأكثر من ١٤,٠٠٠ منظّم فعاليات في المملكة — طلبات عروض حقيقية، دفع مضمون، وتقويم واحد.
            </p>

            {/* social proof row */}
            <div style={{ display:'flex', alignItems:'center', gap:24, marginTop:40, flexWrap:'wrap' }}>
              {[
                { v:'٣.٢ مليار', l:'ر.س قيمة الحجوزات ٢٠٢٥' },
                { v:'٩٦٪', l:'نسبة رضا المزوّدين' },
                { v:'٢٤س', l:'متوسط صرف الأرباح' },
              ].map((s,i)=>(
                <div key={i} style={{ borderInlineEnd: i<2 ? '1px solid rgba(255,255,255,.15)' : 'none',
                  paddingInlineEnd: i<2 ? 24 : 0 }}>
                  <div style={{ fontSize:26, fontWeight:800, color:C.gold500, letterSpacing:-0.5 }}>{s.v}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', marginTop:2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize:11.5, color:'rgba(255,255,255,.4)', marginTop:20 }}>
            رؤية ٢٠٣٠ · معتمد من الهيئة العامة للترفيه · يعمل في ١٢ مدينة
          </div>
        </div>

        {/* Form card floats */}
        <div style={{ width:520, padding:'40px 56px 40px 0', display:'flex', alignItems:'center' }}>
          <div style={{
            background:'#fff', color:C.n900, borderRadius:20, padding:'36px 36px 28px',
            width:'100%', boxShadow:'0 30px 60px rgba(0,0,0,.25), 0 10px 20px rgba(0,0,0,.15)',
            position:'relative',
          }}>
            <div style={{
              position:'absolute', top:-14, insetInlineStart:36, insetInlineEnd:36, height:4,
              background:`linear-gradient(90deg, ${C.cobalt500}, ${C.gold500})`, borderRadius:2,
            }}/>
            <div style={{ fontSize:12, color:C.cobalt500, fontWeight:800, letterSpacing:.6 }}>SUPPLIER · مزوّد</div>
            <h2 style={{ fontSize:28, fontWeight:800, color:C.navy900, marginTop:6, letterSpacing:-0.5 }}>
              أنشئ حسابك في ٣٠ ثانية
            </h2>

            <div style={{ marginTop:24, display:'grid', gap:14 }}>
              <BField label={AR.signup.email} value="nawaf@luxstudio.sa" valid/>
              <BField label={AR.signup.phone} value="٠٥٠ ١٢٣ ٤٥٦٧" prefix="🇸🇦 +966"/>
              <BField label={AR.signup.password} value="••••••••••" type="password"/>
            </div>

            <button style={{
              width:'100%', padding:'15px 18px', borderRadius:12, marginTop:20,
              background:`linear-gradient(90deg, ${C.navy900}, ${C.cobalt500})`,
              color:'#fff', fontWeight:800, fontSize:15,
              boxShadow:'0 8px 20px rgba(30,123,216,.35)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            }}>
              ابدأ رحلتي مع سِفنت <Icon name="chevron-left" size={17} strokeWidth={2.4}/>
            </button>

            <div style={{ textAlign:'center', marginTop:16, fontSize:12.5, color:C.n600 }}>
              لديك حساب؟ <a style={{ color:C.cobalt500, fontWeight:700 }}>{AR.signup.signin}</a>
            </div>
            <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${C.n200}`,
              display:'flex', alignItems:'center', gap:10, fontSize:11.5, color:C.n600 }}>
              <Icon name="shield" size={14} style={{ color:C.ok500 }}/>
              بياناتك محمية وفق نظام حماية البيانات الشخصية السعودي
            </div>
          </div>
        </div>
      </div>
    </BHeroBg>
  </BShell>
);

const BField = ({ label, value, type='text', prefix, valid }) => (
  <div>
    <label style={{ fontSize:12, color:C.n600, fontWeight:700, display:'block', marginBottom:6,
      letterSpacing:.3 }}>{label}</label>
    <div style={{
      display:'flex', alignItems:'center', position:'relative',
      background:C.n100, borderRadius:10, border:`1.5px solid ${valid ? C.ok500 : 'transparent'}`,
    }}>
      {prefix && <span style={{ padding:'0 12px', color:C.n600, fontSize:13, fontWeight:600,
        borderInlineEnd:`1px solid ${C.n200}` }}>{prefix}</span>}
      <input type={type} defaultValue={value} style={{
        flex:1, padding:'13px 14px', border:0, outline:0, background:'transparent', fontSize:14.5, fontWeight:500,
      }}/>
      {valid && <span style={{ padding:'0 14px', color:C.ok500, display:'flex' }}>
        <Icon name="check-circle" size={18} strokeWidth={2.2}/>
      </span>}
    </div>
  </div>
);

// ── Screen 2: Path picker (full-bleed, big cards) ──────────────────────
const BPath = () => (
  <BShell>
    <BHeroBg height={260}>
      <div style={{ padding:'56px 72px 0', position:'relative' }}>
        <div style={{ fontSize:12, color:C.gold500, fontWeight:800, letterSpacing:1 }}>STEP 01 / 04</div>
        <h1 style={{ fontSize:44, fontWeight:900, marginTop:10, letterSpacing:-0.8, lineHeight:1.1 }}>
          {AR.path.title}
        </h1>
        <p style={{ fontSize:15, color:'rgba(255,255,255,.72)', marginTop:10, maxWidth:580, lineHeight:1.7 }}>
          {AR.path.sub}
        </p>
      </div>
    </BHeroBg>

    <div style={{ marginTop:-80, padding:'0 72px', position:'relative', zIndex:2 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <BPathCard title={AR.path.freelancerT} desc={AR.path.freelancerD} icon="user"
          steps={['هوية وطنية','شهادة آيبان','نبذة قصيرة']} eta="٥ دقائق" color={C.cobalt500}/>
        <BPathCard title={AR.path.companyT} desc={AR.path.companyD} icon="building"
          steps={['سجل تجاري','شهادة آيبان','ملف الشركة (اختياري)']} eta="٨ دقائق" active color={C.gold500}
          tag="شارة مزوّد موثّق"/>
      </div>

      <div style={{ display:'flex', justifyContent:'center', marginTop:44, gap:12, alignItems:'center' }}>
        <div style={{ fontSize:12.5, color:C.n600 }}>
          يمكنك ترقية نوع نشاطك لاحقاً من الإعدادات
        </div>
        <div style={{ width:1, height:16, background:C.n200 }}/>
        <button style={{
          padding:'14px 36px', borderRadius:12,
          background:`linear-gradient(90deg, ${C.navy900}, ${C.cobalt500})`,
          color:'#fff', fontWeight:800, fontSize:15,
          boxShadow:'0 8px 20px rgba(15,46,92,.2)',
          display:'flex', alignItems:'center', gap:10,
        }}>{AR.path.cta} <Icon name="chevron-left" size={17} strokeWidth={2.4}/></button>
      </div>
    </div>
  </BShell>
);

const BPathCard = ({ title, desc, icon, steps, eta, active, color, tag }) => (
  <div style={{
    background:'#fff', borderRadius:20, padding:32, position:'relative', overflow:'hidden',
    border: active ? `2px solid ${color}` : `1px solid ${C.n200}`,
    boxShadow: active ? `0 20px 40px ${color}22, 0 10px 20px rgba(15,46,92,.08)` : '0 4px 12px rgba(15,46,92,.06)',
    transform: active ? 'translateY(-6px)' : 'none',
    transition: 'all .3s',
  }}>
    {active && <div style={{
      position:'absolute', top:0, insetInlineStart:0, insetInlineEnd:0, height:4,
      background:`linear-gradient(90deg, ${C.cobalt500}, ${C.gold500})`,
    }}/>}
    {tag && <div style={{
      position:'absolute', top:20, insetInlineEnd:20,
      padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:800,
      background:`${C.gold500}22`, color:C.gold500, letterSpacing:.3,
      display:'flex', alignItems:'center', gap:5,
    }}><Icon name="badge-check" size={12} strokeWidth={2.4}/> {tag}</div>}

    <div style={{
      width:64, height:64, borderRadius:16,
      background: active ? `linear-gradient(135deg, ${color}, ${C.navy900})` : C.n100,
      color: active ? '#fff' : C.n600,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}><Icon name={icon} size={32}/></div>

    <h3 style={{ fontSize:24, fontWeight:800, color:C.navy900, marginTop:20, letterSpacing:-0.4 }}>{title}</h3>
    <p style={{ fontSize:14, color:C.n600, marginTop:10, lineHeight:1.7 }}>{desc}</p>

    <div style={{ marginTop:20, padding:14, background:C.n100, borderRadius:10 }}>
      <div style={{ fontSize:11, color:C.n600, fontWeight:800, letterSpacing:.5, marginBottom:8 }}>
        ما ستحتاجه
      </div>
      <ul style={{ display:'grid', gap:6 }}>
        {steps.map((s,i)=>(
          <li key={i} style={{ fontSize:13.5, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:18, height:18, borderRadius:9,
              background: active ? color : C.n200, color: active ? '#fff' : C.n600,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800 }}>
              {ar(i+1)}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </div>

    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:16,
      fontSize:12.5, color:C.n600 }}>
      <Icon name="clock" size={14}/> {eta}
    </div>

    {active && (
      <div style={{ position:'absolute', bottom:20, insetInlineEnd:20,
        width:36, height:36, borderRadius:18, background:color, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:`0 6px 16px ${color}55` }}>
        <Icon name="check" size={18} strokeWidth={3}/>
      </div>
    )}
  </div>
);

// ── Wizard shell with preview-as-hero ──────────────────────────────────
const BWizardShell = ({ step, children, previewData }) => (
  <BShell>
    {/* progress bar spans the top */}
    <BProgress step={step}/>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 420px', gap:0, height:'calc(100% - 100px)' }}>
      {/* form */}
      <div style={{ padding:'32px 56px 32px 72px', overflowY:'auto' }}>
        {children}
      </div>
      {/* live preview hero panel */}
      <div style={{
        background: C.navy900, padding:'32px 40px', color:'#fff', position:'relative', overflow:'hidden',
      }}>
        <BHeroBg height="100%">
          <div style={{ padding:'24px 24px 0', position:'relative', zIndex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11.5, color:C.gold500,
              fontWeight:800, letterSpacing:.5 }}>
              <Icon name="eye" size={14}/> معاينة حيّة · PUBLIC PROFILE
            </div>
            <h3 style={{ fontSize:20, fontWeight:800, marginTop:8, lineHeight:1.35 }}>
              هكذا سيراك المنظّمون
            </h3>
            <div style={{ marginTop:22 }}>
              <ProfilePreview {...previewData}/>
            </div>

            <div style={{
              marginTop:20, padding:'14px 16px', borderRadius:12,
              background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.1)',
              fontSize:12.5, lineHeight:1.6, display:'flex', gap:10,
            }}>
              <Icon name="sparkles" size={16} style={{ color:C.gold500, flexShrink:0, marginTop:2 }}/>
              <span style={{ color:'rgba(255,255,255,.85)' }}>
                {step===1 && 'كلّ حقل تكمله يزيد ظهور ملفك في نتائج البحث بنسبة ١٢٪.'}
                {step===2 && 'المزوّدون الذين يختارون ٣–٤ فئات يحصلون على طلبات أكثر تطابقاً بـ٣x.'}
                {step===3 && 'شارة "مزوّد موثّق" تضاعف نسبة قبول العرض لدى العملاء المؤسسيين.'}
              </span>
            </div>
          </div>
        </BHeroBg>
      </div>
    </div>
  </BShell>
);

const BProgress = ({ step }) => {
  const steps = [AR.wizard.step1, AR.wizard.step2, AR.wizard.step3];
  return (
    <div style={{ padding:'20px 72px 24px', borderBottom:`1px solid ${C.n200}`, background:'#fff' }}>
      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
        <SeventLogo size={20}/>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:2 }}>
          {steps.map((s,i)=>{
            const done = i+1 < step, active = i+1 === step;
            return (
              <div key={i} style={{ flex:1, display:'flex', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{
                    width:30, height:30, borderRadius:15,
                    background: done ? C.ok500 : active ? C.navy900 : C.n100,
                    color: done || active ? '#fff' : C.n600,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:800,
                    boxShadow: active ? `0 0 0 5px ${C.cobalt100}` : 'none',
                  }}>
                    {done ? <Icon name="check" size={15} strokeWidth={3}/> : ar(i+1)}
                  </div>
                  <div>
                    <div style={{ fontSize:10.5, color:C.n600, fontWeight:700, letterSpacing:.4 }}>
                      STEP {ar(i+1)}
                    </div>
                    <div style={{ fontSize:13.5, fontWeight: active ? 800 : 600,
                      color: done || active ? C.navy900 : C.n600 }}>{s}</div>
                  </div>
                </div>
                {i < steps.length-1 && (
                  <div style={{ flex:1, height:3, margin:'0 14px', background:C.n100, borderRadius:2, overflow:'hidden' }}>
                    <div style={{
                      height:'100%', width: done ? '100%' : '0%',
                      background: C.ok500, transition:'width .4s',
                    }}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize:12, color:C.n600 }}>
          <Icon name="check-circle" size={12} style={{ color:C.ok500, verticalAlign:-1, marginInlineEnd:4 }}/>
          محفوظ قبل ثوانٍ
        </div>
      </div>
    </div>
  );
};

// ── Step 1 (B) ─────────────────────────────────────────────────────────
const BStep1 = () => {
  const preview = { name:'استوديو أضواء الرياض', bio:'إضاءة مسرح وإنتاج بصري لفعاليات مؤسسات المملكة منذ ٢٠١٩.',
    city:'الرياض', categories:[], accent:C.cobalt500 };
  return (
    <BWizardShell step={1} previewData={preview}>
      <div style={{ fontSize:12, color:C.cobalt500, fontWeight:800, letterSpacing:.5 }}>الخطوة ١</div>
      <h2 style={{ fontSize:32, fontWeight:800, color:C.navy900, marginTop:4, letterSpacing:-0.5, lineHeight:1.2 }}>
        عرِّفنا على نشاطك
      </h2>
      <p style={{ fontSize:14, color:C.n600, marginTop:8, lineHeight:1.7, maxWidth:560 }}>
        كل تفصيلة هنا تصل مباشرة لملفك العام. خذ وقتك — المعاينة على اليسار تتحدّث فور كتابتك.
      </p>

      {/* smart import strip */}
      <div style={{
        marginTop:24, padding:'14px 16px', borderRadius:14,
        background:`linear-gradient(105deg, ${C.cobalt100}, ${C.gold100}66)`,
        border:`1px solid ${C.cobalt500}33`,
        display:'flex', alignItems:'center', gap:14,
      }}>
        <div style={{ width:44, height:44, borderRadius:12, background:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center', color:C.cobalt500,
          boxShadow:'0 2px 8px rgba(30,123,216,.2)' }}>
          <Icon name="sparkles" size={22}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.navy900, display:'flex', alignItems:'center', gap:8 }}>
            اختصر الطريق بالذكاء
            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:C.gold500, color:'#fff', fontWeight:800, letterSpacing:.3 }}>AI</span>
          </div>
          <div style={{ fontSize:12.5, color:C.n600, marginTop:2 }}>
            ألصق رابط موقعك أو سجلك التجاري، ونعبّئ معظم الحقول تلقائياً
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input placeholder="luxstudio.sa أو رقم السجل" style={{
            padding:'10px 14px', border:`1px solid ${C.n200}`, borderRadius:10, background:'#fff',
            fontSize:13, width:220, outline:0 }}/>
          <button style={{ padding:'10px 18px', borderRadius:10, background:C.navy900, color:'#fff',
            fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
            <Icon name="sparkles" size={14}/> استيراد
          </button>
        </div>
      </div>

      {/* form */}
      <div style={{ marginTop:28, display:'grid', gap:20 }}>
        <BField2 label={AR.wizard.businessName} value="استوديو أضواء الرياض" valid/>

        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
            <label style={{ fontSize:12, color:C.n600, fontWeight:700, letterSpacing:.3 }}>{AR.wizard.bio}</label>
            <span style={{ fontSize:11, color:C.gold500, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
              <Icon name="sparkles" size={12}/> اكتبها بأسلوبي
            </span>
          </div>
          <div style={{ background:C.n100, borderRadius:10, border:`2px solid ${C.cobalt500}` }}>
            <textarea defaultValue="إضاءة مسرح وإنتاج بصري لفعاليات مؤسسات المملكة منذ ٢٠١٩. فريق من ١٢ مهندساً ومعدات بمواصفات عالمية."
              style={{ width:'100%', padding:'14px 16px', border:0, outline:0, background:'transparent',
                fontSize:14.5, resize:'none', minHeight:84, fontFamily:'inherit', lineHeight:1.75 }}/>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px',
              borderTop:`1px solid ${C.n200}`, fontSize:11, color:C.n600 }}>
              <span>حسّاسية للكلمات المفتاحية: <b style={{color:C.ok500}}>ممتاز</b></span>
              <span>{ar(127)}/٢٤٠</span>
            </div>
          </div>
        </div>

        <BField2 label={AR.wizard.crNumber} value="١٠١٠٢٣٤٥٦٧" valid/>

        {/* Wathq verified block — more dramatic in B */}
        <div style={{
          padding:'16px 18px', borderRadius:14,
          background:`linear-gradient(105deg, ${C.ok100}, #fff)`,
          border:`2px solid ${C.ok500}`, display:'flex', alignItems:'center', gap:14,
          position:'relative', overflow:'hidden',
        }}>
          <div style={{ position:'absolute', insetInlineEnd:-20, top:-20, width:100, height:100,
            background:`radial-gradient(circle, ${C.ok500}22, transparent)` }}/>
          <div style={{ width:44, height:44, borderRadius:12, background:C.ok500, color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:`0 4px 12px ${C.ok500}55` }}>
            <Icon name="badge-check" size={24}/>
          </div>
          <div style={{ flex:1, position:'relative' }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.navy900, display:'flex', alignItems:'center', gap:8 }}>
              تم التحقق عبر واثق
              <span style={{ display:'inline-flex', gap:2 }}>
                {Array.from({length:3}).map((_,i)=>(
                  <span key={i} style={{ width:4, height:4, borderRadius:2, background:C.ok500,
                    animation:`pulse 1s ease-in-out ${i*.15}s infinite` }}/>
                ))}
              </span>
            </div>
            <div style={{ fontSize:12.5, color:C.n600, marginTop:3 }}>
              استوديو أضواء الرياض · ١٠١٠٢٣٤٥٦٧ · نشط · الرياض · مسجّل ٢٠١٩
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <label style={{ fontSize:12, color:C.n600, fontWeight:700, letterSpacing:.3,
              display:'block', marginBottom:6 }}>{AR.wizard.baseCity}</label>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px',
              background:C.n100, borderRadius:10 }}>
              <Icon name="map-pin" size={16} style={{ color:C.cobalt500 }}/>
              <span style={{ fontSize:14, fontWeight:600 }}>الرياض</span>
              <Icon name="chevron-down" size={16} style={{ color:C.n600, marginInlineStart:'auto' }}/>
            </div>
          </div>
          <div>
            <label style={{ fontSize:12, color:C.n600, fontWeight:700, letterSpacing:.3,
              display:'block', marginBottom:6 }}>{AR.wizard.languages}</label>
            <div style={{ display:'flex', gap:6 }}>
              {[['ar','العربية',true],['en','EN',true],['ur','اردو',false]].map(([k,l,sel])=>(
                <span key={k} style={{
                  padding:'8px 14px', borderRadius:20, fontSize:13, fontWeight:700,
                  background: sel ? C.navy900 : C.n100,
                  color: sel ? '#fff' : C.n600,
                  display:'inline-flex', alignItems:'center', gap:6,
                }}>
                  {sel && <Icon name="check" size={13} strokeWidth={3}/>} {l}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label style={{ fontSize:12, color:C.n600, fontWeight:700, letterSpacing:.3,
            display:'block', marginBottom:6 }}>{AR.wizard.serviceArea}</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:12,
            background:C.n100, borderRadius:10, minHeight:52, alignItems:'center' }}>
            {['الرياض','الدمام','الخبر','جدة'].map(c=>(
              <span key={c} style={{
                background:'#fff', color:C.navy900, fontSize:13, fontWeight:700,
                padding:'5px 12px', borderRadius:15, display:'inline-flex', alignItems:'center', gap:6,
                boxShadow:'0 1px 2px rgba(0,0,0,.06)',
              }}>
                <span style={{ width:6, height:6, borderRadius:3, background:C.cobalt500 }}/>
                {c} <Icon name="x" size={12} style={{ color:C.n400 }}/>
              </span>
            ))}
            <input placeholder="أضف مدينة…" style={{ border:0, outline:0, padding:'4px 8px', fontSize:13, flex:1,
              background:'transparent', minWidth:100 }}/>
          </div>
        </div>
      </div>

      <BWizNav step={1}/>
    </BWizardShell>
  );
};

const BField2 = ({ label, value, valid }) => (
  <div>
    <label style={{ fontSize:12, color:C.n600, fontWeight:700, letterSpacing:.3,
      display:'block', marginBottom:6 }}>{label}</label>
    <div style={{ background:C.n100, borderRadius:10, border:`1.5px solid ${valid?C.ok500+'66':'transparent'}`,
      display:'flex', alignItems:'center' }}>
      <input defaultValue={value} style={{ flex:1, padding:'13px 15px', border:0, outline:0,
        background:'transparent', fontSize:14.5, fontWeight:500 }}/>
      {valid && <span style={{ padding:'0 14px', color:C.ok500, display:'flex' }}>
        <Icon name="check-circle" size={18} strokeWidth={2.2}/>
      </span>}
    </div>
  </div>
);

const BWizNav = ({ step, nextLabel }) => (
  <div style={{ marginTop:36, paddingTop:22, borderTop:`1px solid ${C.n200}`,
    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
    <button style={{ padding:'12px 22px', fontSize:14, color:C.n600, fontWeight:700,
      display:'flex', alignItems:'center', gap:6 }}>
      <Icon name="chevron-right" size={17}/> {AR.wizard.back}
    </button>
    <button style={{
      padding:'15px 32px', borderRadius:12,
      background:`linear-gradient(90deg, ${C.navy900}, ${C.cobalt500})`,
      color:'#fff', fontWeight:800, fontSize:14.5,
      boxShadow:`0 8px 20px rgba(15,46,92,.2)`,
      display:'flex', alignItems:'center', gap:10, position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'absolute', inset:0, width:'30%',
        background:'linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent)',
        animation:'sheen 3s ease-in-out infinite' }}/>
      <span style={{ position:'relative' }}>{nextLabel || `متابعة إلى الخطوة ${ar(step+1)}`}</span>
      <Icon name="chevron-left" size={17} strokeWidth={2.4} style={{ position:'relative' }}/>
    </button>
  </div>
);

// ── Step 2 (B) — bigger category cards, visual ─────────────────────────
const BStep2 = () => {
  const selected = ['إضاءة المسرح','أنظمة الصوت','بث مباشر'];
  const preview = { name:'استوديو أضواء الرياض', bio:'إضاءة مسرح وإنتاج بصري لفعاليات مؤسسات المملكة منذ ٢٠١٩.',
    city:'الرياض', categories:selected, accent:C.cobalt500 };

  const big = [
    { t:'إضاءة المسرح', p:'إنتاج مسرحي وصوت', icon:'sparkles', sel:true },
    { t:'أنظمة الصوت', p:'إنتاج مسرحي وصوت', icon:'sparkles', sel:true },
    { t:'بث مباشر', p:'التصوير', icon:'camera', sel:true },
    { t:'تصوير فوتوغرافي', p:'التصوير', icon:'camera', sel:false },
    { t:'شاشات LED', p:'إنتاج مسرحي وصوت', icon:'image', sel:false },
    { t:'إضاءة معمارية', p:'إنتاج مسرحي وصوت', icon:'sun', sel:false },
    { t:'ضيافة فاخرة', p:'الضيافة', icon:'briefcase', sel:false },
    { t:'ورود وتنسيق', p:'الديكور', icon:'star', sel:false },
  ];

  return (
    <BWizardShell step={2} previewData={preview}>
      <div style={{ fontSize:12, color:C.cobalt500, fontWeight:800, letterSpacing:.5 }}>الخطوة ٢</div>
      <h2 style={{ fontSize:32, fontWeight:800, color:C.navy900, marginTop:4, letterSpacing:-0.5, lineHeight:1.2 }}>
        ما الذي تقدّمه بالضبط؟
      </h2>
      <p style={{ fontSize:14, color:C.n600, marginTop:8, lineHeight:1.7, maxWidth:560 }}>
        اختر الفئات التي تُتقنها — الدقة أهم من الكثرة. ستظهر هذه الفئات كشارات في ملفك.
      </p>

      {/* Selection state bar */}
      <div style={{
        marginTop:22, padding:'12px 16px', borderRadius:12,
        background: selected.length>=3 ? `${C.ok500}15` : C.n100,
        border:`1px solid ${selected.length>=3 ? C.ok500+'55' : C.n200}`,
        display:'flex', alignItems:'center', gap:12, fontSize:13,
      }}>
        <div style={{ width:28, height:28, borderRadius:14,
          background: selected.length>=3 ? C.ok500 : C.n400, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800 }}>
          {ar(selected.length)}
        </div>
        <div style={{ flex:1, color:C.navy900, fontWeight:600 }}>
          {selected.length>=3 ? (
            <>ممتاز — مجموعة الفئات الحالية <b>أدق من ٧٦٪ من المزوّدين</b></>
          ) : 'اختر فئتين على الأقل'}
        </div>
        <div style={{ fontSize:12, color:C.n600 }}>الحد الأقصى ٦</div>
      </div>

      {/* Category tiles */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginTop:20 }}>
        {big.map((c,i)=>(
          <button key={i} style={{
            padding:'16px 14px', borderRadius:14, textAlign:'start',
            background: c.sel ? `linear-gradient(145deg, ${C.cobalt500}, ${C.navy900})` : '#fff',
            color: c.sel ? '#fff' : C.n900,
            border: c.sel ? 'none' : `1px solid ${C.n200}`,
            boxShadow: c.sel ? `0 8px 20px ${C.cobalt500}33` : 'none',
            position:'relative', overflow:'hidden',
          }}>
            <div style={{ position:'absolute', top:-15, insetInlineEnd:-15, width:60, height:60, borderRadius:30,
              background: c.sel ? 'rgba(255,255,255,.1)' : C.cobalt100, opacity: c.sel ? 1 : .6 }}/>
            <div style={{ width:36, height:36, borderRadius:10,
              background: c.sel ? 'rgba(255,255,255,.18)' : C.cobalt100,
              color: c.sel ? '#fff' : C.cobalt500,
              display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
              <Icon name={c.icon} size={18}/>
            </div>
            <div style={{ fontSize:13.5, fontWeight:800, marginTop:12, position:'relative' }}>{c.t}</div>
            <div style={{ fontSize:11, marginTop:3, opacity:.7, position:'relative' }}>{c.p}</div>
            {c.sel && (
              <span style={{ position:'absolute', bottom:12, insetInlineEnd:12,
                width:22, height:22, borderRadius:11, background:'#fff', color:C.navy900,
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon name="check" size={13} strokeWidth={3}/>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Segments */}
      <div style={{ marginTop:30 }}>
        <h3 style={{ fontSize:18, fontWeight:800, color:C.navy900 }}>من هم عملاؤك؟</h3>
        <p style={{ fontSize:13, color:C.n600, marginTop:4 }}>{AR.wizard.segmentsHint}</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:14 }}>
          {SEGMENTS.map((s,i)=>{
            const sel = i<3;
            return (
              <button key={s.s} style={{
                padding:'10px 18px', borderRadius:22, fontSize:13.5, fontWeight:700,
                border:`2px solid ${sel ? C.navy900 : C.n200}`,
                background: sel ? C.navy900 : '#fff',
                color: sel ? '#fff' : C.n900,
                display:'inline-flex', alignItems:'center', gap:8,
              }}>
                {sel && <Icon name="check" size={13} strokeWidth={3}/>}
                {s.ar}
              </button>
            );
          })}
        </div>
      </div>

      <BWizNav step={2}/>
    </BWizardShell>
  );
};

// ── Step 3 (B) — documents ─────────────────────────────────────────────
const BStep3 = () => {
  const preview = { name:'استوديو أضواء الرياض', bio:'إضاءة مسرح وإنتاج بصري لفعاليات مؤسسات المملكة منذ ٢٠١٩.',
    city:'الرياض', categories:['إضاءة المسرح','أنظمة الصوت','بث مباشر'], accent:C.cobalt500 };
  return (
    <BWizardShell step={3} previewData={{...preview, verified:true}}>
      <div style={{ fontSize:12, color:C.cobalt500, fontWeight:800, letterSpacing:.5 }}>الخطوة ٣ · الأخيرة</div>
      <h2 style={{ fontSize:32, fontWeight:800, color:C.navy900, marginTop:4, letterSpacing:-0.5, lineHeight:1.2 }}>
        التوثيق والهوية البصرية
      </h2>
      <p style={{ fontSize:14, color:C.n600, marginTop:8, lineHeight:1.7, maxWidth:560 }}>
        ارفع شعارك ومستنداتك الرسمية. بعد هذه الخطوة، يراجع فريقنا طلبك خلال ٢٤ ساعة.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:24 }}>
        {/* Logo big uploader */}
        <div style={{ gridColumn:'1 / 3', background:'#fff', borderRadius:16,
          border:`1px solid ${C.n200}`, padding:20, display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ width:100, height:100, borderRadius:16,
            background:`linear-gradient(135deg, ${C.navy900}, ${C.cobalt500})`,
            display:'flex', alignItems:'center', justifyContent:'center', color:'#fff',
            position:'relative', overflow:'hidden' }}>
            <span style={{ fontSize:42, fontWeight:900, fontStyle:'italic', letterSpacing:-2, fontFamily:'Inter' }}>أض</span>
            <div style={{ position:'absolute', top:0, insetInlineStart:0, width:'100%', height:4, background:C.gold500 }}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:C.n600, fontWeight:700, letterSpacing:.3 }}>{AR.wizard.logoLabel}</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.navy900, marginTop:4 }}>logo-primary.svg</div>
            <div style={{ fontSize:12, color:C.n600, marginTop:3 }}>
              ١٢ ك.ب · SVG · محسّن للعرض على الخلفيات الداكنة
            </div>
            <div style={{ display:'flex', gap:6, marginTop:10 }}>
              <button style={{ fontSize:12, padding:'6px 12px', borderRadius:6,
                background:C.n100, color:C.n900, fontWeight:600 }}>استبدال</button>
              <button style={{ fontSize:12, padding:'6px 12px', borderRadius:6,
                background:C.n100, color:C.n900, fontWeight:600 }}>أضف نسخة داكنة</button>
            </div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:11, color:C.n600, fontWeight:600, marginBottom:6 }}>معاينة</div>
            <div style={{ width:90, height:60, borderRadius:8, background:C.n900,
              display:'flex', alignItems:'center', justifyContent:'center', color:'#fff',
              fontWeight:900, fontStyle:'italic', fontSize:22, fontFamily:'Inter' }}>أض</div>
          </div>
        </div>

        {/* IBAN with verification state */}
        <BDoc label={AR.wizard.iban} state="verified" filename="IBAN_SNB_4821.pdf"
          meta="٢٤٧ ك.ب · تم التحقق مع البنك السعودي الوطني" icon="file"/>

        {/* Company profile */}
        <BDoc label={AR.wizard.companyProfile} state="empty" hint={AR.wizard.companyProfileHint}
          icon="briefcase"/>

        {/* Portfolio images — bonus big tile */}
        <div style={{ gridColumn:'1 / 3', background:'#fff', borderRadius:16,
          border:`1px solid ${C.n200}`, padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:C.navy900, display:'flex', alignItems:'center', gap:8 }}>
                معرض أعمال سريع
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:C.gold500, color:'#fff', fontWeight:800, letterSpacing:.3 }}>+٤٠٪ طلبات</span>
              </div>
              <div style={{ fontSize:12.5, color:C.n600, marginTop:3 }}>
                ٣ صور على الأقل — تستطيع إضافة المزيد لاحقاً
              </div>
            </div>
            <button style={{ fontSize:12.5, color:C.cobalt500, fontWeight:700 }}>تخطّي الآن</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {['#1c3f73','#c8993a','#355b95',null].map((col,i)=>(
              <div key={i} style={{
                aspectRatio:'4/3', borderRadius:10, background: col || C.n100,
                border: col ? 'none' : `1.5px dashed ${C.n200}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                color: col ? 'rgba(255,255,255,.6)' : C.n600, position:'relative',
                overflow:'hidden',
              }}>
                {col ? (
                  <>
                    <div style={{ position:'absolute', inset:0,
                      background:`radial-gradient(circle at 30% 30%, ${C.gold500}66, transparent 60%)` }}/>
                    <div style={{ position:'relative', fontSize:12, fontWeight:700 }}>فعالية {ar(i+1)}</div>
                  </>
                ) : (
                  <div style={{ textAlign:'center' }}>
                    <Icon name="plus" size={22}/>
                    <div style={{ fontSize:11, marginTop:4 }}>أضف صورة</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <BWizNav step={3} nextLabel="أرسل للمراجعة"/>
    </BWizardShell>
  );
};

const BDoc = ({ label, state, filename, meta, hint, icon }) => (
  <div style={{
    background: state==='verified' ? `linear-gradient(135deg, ${C.ok100}, #fff)` : '#fff',
    borderRadius:14, padding:18,
    border: state==='verified' ? `2px solid ${C.ok500}` : `1.5px dashed ${C.n200}`,
    display:'flex', alignItems:'center', gap:14,
  }}>
    <div style={{ width:50, height:50, borderRadius:12,
      background: state==='verified' ? C.ok500 : C.n100,
      color: state==='verified' ? '#fff' : C.n600,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Icon name={state==='verified'?'check':'upload'} size={22} strokeWidth={state==='verified'?3:2}/>
    </div>
    <div style={{ flex:1 }}>
      <div style={{ fontSize:12, color:C.n600, fontWeight:700, letterSpacing:.3 }}>{label}</div>
      {state==='verified' ? (
        <>
          <div style={{ fontSize:14, fontWeight:800, color:C.navy900, marginTop:3 }}>{filename}</div>
          <div style={{ fontSize:11.5, color:C.n600, marginTop:2 }}>{meta}</div>
        </>
      ) : (
        <>
          <div style={{ fontSize:13.5, color:C.n900, marginTop:3 }}>
            <span style={{ color:C.cobalt500, fontWeight:800 }}>ارفع الملف</span> أو اسحبه
          </div>
          <div style={{ fontSize:11.5, color:C.n600, marginTop:2 }}>{hint}</div>
        </>
      )}
    </div>
  </div>
);

// ── Screen 6 (B): Pending review — immersive ───────────────────────────
const BPending = () => (
  <BShell dark chrome={false}>
    <BHeroBg height="100%">
      <div style={{ padding:'36px 72px', height:'100%', display:'grid',
        gridTemplateColumns:'1fr 480px', gap:40 }}>

        <div style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <SeventLogo size={22} tone="white"/>
            <div style={{ fontSize:11.5, color:C.gold500, fontWeight:800, letterSpacing:.6,
              padding:'4px 10px', background:'rgba(200,153,58,.18)', borderRadius:6 }}>
              APPLICATION #{ar(7421)}
            </div>
          </div>

          <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', maxWidth:560 }}>
            {/* animated shield */}
            <div style={{ width:120, height:120, borderRadius:60,
              background:`linear-gradient(135deg, ${C.cobalt500}, ${C.navy900})`,
              border:`2px solid rgba(255,255,255,.15)`,
              display:'flex', alignItems:'center', justifyContent:'center', color:'#fff',
              position:'relative', animation:'bob 3s ease-in-out infinite',
              boxShadow:`0 20px 60px ${C.cobalt500}55` }}>
              <Icon name="shield" size={56}/>
              {[0,1,2].map(i=>(
                <div key={i} style={{ position:'absolute', inset:-8-(i*8), borderRadius:80,
                  border:`1px solid ${C.cobalt500}${i===0?'88':i===1?'55':'22'}`,
                  animation:`pulse ${2+i*.5}s ease-in-out ${i*.3}s infinite` }}/>
              ))}
            </div>
            <h1 style={{ fontSize:52, fontWeight:900, lineHeight:1.1, marginTop:28,
              letterSpacing:-1.2 }}>
              {AR.pending.title}
            </h1>
            <p style={{ fontSize:16, color:'rgba(255,255,255,.7)', marginTop:16, lineHeight:1.75,
              maxWidth:460 }}>
              {AR.pending.sub}
            </p>
            <div style={{ marginTop:28, display:'inline-flex', alignSelf:'start', alignItems:'center', gap:12,
              padding:'10px 16px', borderRadius:10,
              background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.1)' }}>
              <Icon name="mail" size={16} style={{ color:C.cobalt500 }}/>
              <span style={{ fontSize:13.5 }}>
                سيصل الإشعار على <b>nawaf@luxstudio.sa</b>
              </span>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:28 }}>
              <button style={{
                padding:'13px 24px', borderRadius:11,
                background:`linear-gradient(90deg, ${C.gold500}, #e0b04e)`, color:'#fff',
                fontWeight:800, fontSize:14, boxShadow:`0 8px 20px ${C.gold500}44`,
              }}>
                حسِّن ملفك بينما تنتظر
              </button>
              <button style={{
                padding:'13px 24px', borderRadius:11,
                background:'rgba(255,255,255,.1)', color:'#fff',
                fontWeight:700, fontSize:14, border:'1px solid rgba(255,255,255,.2)',
                display:'flex', alignItems:'center', gap:6,
              }}>
                <Icon name="chat" size={15}/> {AR.pending.chatCta}
              </button>
            </div>
          </div>
        </div>

        {/* Right column: live checklist on glass card */}
        <div style={{
          background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)',
          borderRadius:20, padding:'28px 28px 20px', backdropFilter:'blur(12px)',
          alignSelf:'center',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ fontSize:16, fontWeight:800 }}>{AR.pending.checklistTitle}</h3>
            <span style={{ fontSize:11, padding:'4px 10px', borderRadius:12,
              background:C.cobalt500, color:'#fff', fontWeight:800, letterSpacing:.3 }}>
              LIVE · جارٍ
            </span>
          </div>
          <ul style={{ marginTop:12 }}>
            {AR.pending.checks.map((c,i)=>(
              <li key={c.k} style={{
                display:'grid', gridTemplateColumns:'36px 1fr', gap:14, padding:'14px 0',
                borderTop: i===0 ? 'none' : '1px solid rgba(255,255,255,.08)',
              }}>
                <div style={{
                  width:30, height:30, borderRadius:15,
                  background: c.st==='done' ? C.ok500 : c.st==='running' ? C.cobalt500 : 'rgba(255,255,255,.08)',
                  color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow: c.st==='done' ? `0 0 0 4px ${C.ok500}22` :
                             c.st==='running' ? `0 0 0 4px ${C.cobalt500}22` : 'none',
                }}>
                  {c.st==='done' ? <Icon name="check" size={14} strokeWidth={3}/> :
                   c.st==='running' ? (
                     <svg width="20" height="20" viewBox="0 0 20 20">
                       <circle cx="10" cy="10" r="7" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="2.4"/>
                       <circle cx="10" cy="10" r="7" fill="none" stroke="#fff" strokeWidth="2.4"
                         strokeDasharray="14 50" strokeLinecap="round">
                         <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1.1s" repeatCount="indefinite"/>
                       </circle>
                     </svg>
                   ) : <Icon name="dot" size={8}/>}
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700,
                    color: c.st==='waiting' ? 'rgba(255,255,255,.5)' : '#fff' }}>{c.t}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.55)', marginTop:3, lineHeight:1.55 }}>{c.d}</div>
                </div>
              </li>
            ))}
          </ul>

          <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid rgba(255,255,255,.08)',
            display:'flex', alignItems:'center', gap:10, fontSize:12, color:'rgba(255,255,255,.6)' }}>
            <Icon name="clock" size={14}/> المتبقي المتوقّع: <b style={{ color:'#fff' }}>٢٢ ساعة</b>
          </div>
        </div>
      </div>
    </BHeroBg>
  </BShell>
);

// ── Screen 7 (B): Approved — editorial/celebration ─────────────────────
const BApproved = () => (
  <BShell>
    <BHeroBg height={460}>
      {/* confetti */}
      {Array.from({length:40}).map((_,i)=>{
        const col = [C.gold500,'#fff',C.cobalt400,'#7ab8ff'][i%4];
        return (
          <div key={i} style={{
            position:'absolute', top: -10 + Math.random()*460,
            insetInlineStart: Math.random()*100+'%',
            width: 6+Math.random()*6, height:10+Math.random()*8,
            background:col, borderRadius:1,
            transform:`rotate(${Math.random()*360}deg)`, opacity:.8,
          }}/>
        );
      })}
      <div style={{ padding:'40px 72px 0', position:'relative', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <SeventLogo size={22} tone="white"/>
          <span style={{ fontSize:12, color:'rgba(255,255,255,.6)' }}>أهلاً بك في سِفنت</span>
        </div>

        <div style={{ marginTop:36, display:'flex', alignItems:'flex-end', gap:28 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8,
              padding:'6px 14px', borderRadius:20,
              background:'rgba(200,153,58,.22)', border:`1px solid ${C.gold500}55`,
              color:C.gold500, fontSize:12, fontWeight:800, letterSpacing:.5 }}>
              <Icon name="badge-check" size={14} strokeWidth={2.4}/> مزوّد موثّق · VERIFIED
            </div>
            <h1 style={{ fontSize:72, fontWeight:900, marginTop:16, lineHeight:1.02,
              letterSpacing:-2 }}>
              مبروك يا <em style={{ fontStyle:'normal', color:C.gold500 }}>نوّاف.</em>
            </h1>
            <p style={{ fontSize:17, color:'rgba(255,255,255,.75)', marginTop:16, lineHeight:1.65, maxWidth:580 }}>
              ملفك اعتُمد ونُشر في سوق المزوّدين. وجدنا لك <b style={{color:'#fff'}}>٣ طلبات عروض</b> تنتظر ردّك الآن.
            </p>
            <div style={{ display:'flex', gap:10, marginTop:28 }}>
              <button style={{ padding:'15px 28px', borderRadius:12,
                background:C.gold500, color:C.navy900, fontWeight:800, fontSize:14.5,
                boxShadow:`0 10px 24px ${C.gold500}55`,
                display:'flex', alignItems:'center', gap:8 }}>
                شاهد الطلبات الثلاثة <Icon name="chevron-left" size={17} strokeWidth={2.4}/>
              </button>
              <button style={{ padding:'15px 28px', borderRadius:12,
                background:'rgba(255,255,255,.12)', color:'#fff', fontWeight:700, fontSize:14.5,
                border:'1px solid rgba(255,255,255,.2)',
                display:'flex', alignItems:'center', gap:8 }}>
                <Icon name="external" size={16}/> معاينة ملفي العام
              </button>
            </div>
          </div>

          {/* profile preview card in hero */}
          <div style={{ width:340, marginBottom:-80 }}>
            <ProfilePreview
              name="استوديو أضواء الرياض"
              bio="إضاءة مسرح وإنتاج بصري لفعاليات مؤسسات المملكة منذ ٢٠١٩."
              city="الرياض"
              categories={['إضاءة المسرح','أنظمة الصوت','بث مباشر']}
              verified
              accent={C.gold500}
            />
          </div>
        </div>
      </div>
    </BHeroBg>

    <div style={{ padding:'120px 72px 32px', background:C.n50 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:24 }}>
        <div>
          <h3 style={{ fontSize:20, fontWeight:800, color:C.navy900 }}>طلبات عروض مناسبة لك الآن</h3>
          <div style={{ marginTop:14, display:'grid', gap:10 }}>
            {[
              { org:'أرامكو', event:'فعالية تدريبية داخلية', city:'الرياض', date:'٢ مايو', budget:'٣٥–٥٠ ألف ر.س', match:92, hot:true },
              { org:'نون', event:'إطلاق منتج جديد', city:'جدة', date:'١٨ مايو', budget:'٦٠–٨٠ ألف ر.س', match:84 },
              { org:'نيوم', event:'ورشة إعلامية', city:'تبوك', date:'٢٥ مايو', budget:'٢٠–٣٠ ألف ر.س', match:71 },
            ].map((r,i)=>(
              <div key={i} style={{ background:'#fff', borderRadius:12, padding:'16px 18px',
                display:'flex', alignItems:'center', gap:16,
                border:`1px solid ${C.n200}`,
                boxShadow: r.hot ? `0 8px 20px ${C.gold500}22` : 'var(--shadow-sm)',
                borderInlineStart: r.hot ? `4px solid ${C.gold500}` : `1px solid ${C.n200}` }}>
                <div style={{ width:44, height:44, borderRadius:10,
                  background:`linear-gradient(135deg, ${C.navy900}, ${C.cobalt500})`, color:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14 }}>
                  {r.org[0]}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:C.navy900,
                    display:'flex', alignItems:'center', gap:8 }}>
                    {r.org} · {r.event}
                    {r.hot && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10,
                      background:C.gold500, color:'#fff', fontWeight:800, letterSpacing:.3 }}>ساخن</span>}
                  </div>
                  <div style={{ fontSize:12.5, color:C.n600, marginTop:4, display:'flex', alignItems:'center', gap:12 }}>
                    <span><Icon name="map-pin" size={12}/> {r.city}</span>
                    <span><Icon name="clock" size={12}/> {r.date}</span>
                    <span style={{ fontWeight:700, color:C.navy900 }}>{r.budget}</span>
                  </div>
                </div>
                <div style={{ textAlign:'end' }}>
                  <div style={{
                    display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:800,
                    color: r.match>80 ? C.ok500 : C.gold500,
                    padding:'4px 10px', borderRadius:10,
                    background: (r.match>80 ? C.ok500 : C.gold500) + '18',
                  }}>{ar(r.match)}٪ تطابق</div>
                  <button style={{ display:'block', marginTop:8, padding:'8px 14px', borderRadius:8,
                    background:C.navy900, color:'#fff', fontSize:12.5, fontWeight:700 }}>أرسل عرضاً</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:16, padding:'22px', border:`1px solid ${C.n200}` }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:C.navy900 }}>جولة سريعة (٤٥ ثانية)</h3>
          <p style={{ fontSize:12.5, color:C.n600, marginTop:6, lineHeight:1.6 }}>
            تعرّف على أهم الميزات قبل أن تبدأ.
          </p>
          <div style={{ marginTop:14, display:'grid', gap:8 }}>
            {[
              { n:'١', t:'كتابة عرض يكسب', s:'٣ نصائح' },
              { n:'٢', t:'إدارة التقويم', s:'منع التعارض' },
              { n:'٣', t:'الباقات والأسعار', s:'حدّد أسعارك' },
              { n:'٤', t:'ضمان الدفع', s:'كيف تعمل المدفوعات' },
            ].map(x=>(
              <div key={x.n} style={{ display:'flex', alignItems:'center', gap:12,
                padding:'10px 12px', background:C.n50, borderRadius:10 }}>
                <div style={{ width:26, height:26, borderRadius:13, background:C.navy900, color:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>
                  {x.n}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.navy900 }}>{x.t}</div>
                  <div style={{ fontSize:11, color:C.n600, marginTop:1 }}>{x.s}</div>
                </div>
                <Icon name="chevron-left" size={14} style={{ color:C.n600 }}/>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </BShell>
);

// ── Mobile versions (390 wide) ─────────────────────────────────────────
const MobileA = () => (
  <div className="mk" style={{ background:C.n50 }}>
    <div style={{
      height:44, background:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 20px', fontSize:13, fontWeight:700,
    }}>
      <span>٩:٤١</span>
      <span style={{ display:'flex', gap:5, alignItems:'center', fontSize:11 }}>
        <Icon name="globe" size={12}/> <span>⚡</span>
      </span>
    </div>
    <div style={{
      padding:'12px 16px', background:'#fff', borderBottom:`1px solid ${C.n200}`,
      display:'flex', alignItems:'center', gap:12,
    }}>
      <Icon name="chevron-right" size={20}/>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:11, color:C.n600 }}>الخطوة ٢ من ٣</div>
        <div style={{ height:4, background:C.n100, borderRadius:2, marginTop:4, overflow:'hidden' }}>
          <div style={{ width:'66%', height:'100%', background:C.cobalt500, borderRadius:2 }}/>
        </div>
      </div>
      <button style={{ fontSize:12, color:C.n600 }}>حفظ</button>
    </div>

    <div style={{ padding:'20px 16px', height:'calc(100% - 44px - 57px - 64px)', overflowY:'auto' }}>
      <h2 style={{ fontSize:22, fontWeight:800, color:C.navy900 }}>{AR.wizard.step2}</h2>
      <p style={{ fontSize:13, color:C.n600, marginTop:6, lineHeight:1.6 }}>
        {AR.wizard.categoriesHint}
      </p>

      <div style={{ marginTop:16, display:'flex', flexWrap:'wrap', gap:6 }}>
        {['إضاءة المسرح','أنظمة الصوت','بث مباشر'].map(c=>(
          <span key={c} style={{
            padding:'6px 12px', borderRadius:16, background:C.cobalt500, color:'#fff',
            fontSize:12.5, fontWeight:600, display:'inline-flex', alignItems:'center', gap:5,
          }}>
            <Icon name="check" size={11} strokeWidth={3}/> {c}
            <Icon name="x" size={11}/>
          </span>
        ))}
      </div>

      <input placeholder="ابحث…" style={{
        width:'100%', padding:'12px 14px', marginTop:14,
        border:`1px solid ${C.n200}`, borderRadius:10, background:'#fff', fontSize:13.5, outline:0,
      }}/>

      <div style={{ marginTop:14, display:'grid', gap:8 }}>
        {['إضاءة معمارية','تصوير فوتوغرافي','تصوير فيديو','شاشات LED','ضيافة فاخرة'].map(c=>(
          <button key={c} style={{
            padding:'14px 16px', borderRadius:10, textAlign:'start',
            border:`1px solid ${C.n200}`, background:'#fff',
            display:'flex', alignItems:'center', gap:10,
          }}>
            <span style={{ width:22, height:22, borderRadius:11,
              border:`1.5px solid ${C.n400}`, background:'#fff', flexShrink:0 }}/>
            <span style={{ fontSize:14, fontWeight:500 }}>{c}</span>
            <Icon name="plus" size={16} style={{ color:C.cobalt500, marginInlineStart:'auto' }}/>
          </button>
        ))}
      </div>
    </div>

    {/* pull-up preview sheet peek */}
    <div style={{
      position:'absolute', bottom:0, insetInline:0, background:'#fff',
      borderTopLeftRadius:20, borderTopRightRadius:20,
      padding:'12px 16px', borderTop:`1px solid ${C.n200}`,
      boxShadow:'0 -4px 16px rgba(0,0,0,.08)',
    }}>
      <div style={{ width:40, height:4, background:C.n200, borderRadius:2, margin:'0 auto 10px' }}/>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <button style={{ flex:1, padding:'12px', borderRadius:10, background:C.navy900, color:'#fff',
          fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          متابعة <Icon name="chevron-left" size={16}/>
        </button>
        <button style={{ padding:'12px 14px', borderRadius:10, background:C.n100, color:C.n900,
          fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
          <Icon name="eye" size={14}/> معاينة
        </button>
      </div>
    </div>
  </div>
);

const MobileB = () => (
  <div className="mk">
    <div style={{
      height:44, background:C.navy900, color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 20px', fontSize:13, fontWeight:700,
    }}>
      <span>٩:٤١</span>
      <span style={{ fontSize:11 }}>⚡</span>
    </div>
    <div style={{ background:C.navy900, color:'#fff', padding:'16px 20px 28px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 80% 20%, ${C.cobalt500}55, transparent 60%)` }}/>
      <div style={{ position:'relative' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Icon name="chevron-right" size={22}/>
          <div style={{ fontSize:11, color:C.gold500, fontWeight:800, letterSpacing:.5 }}>STEP 02 / 03</div>
        </div>
        <h2 style={{ fontSize:28, fontWeight:900, marginTop:10, lineHeight:1.15, letterSpacing:-0.6 }}>
          ما الذي تقدّمه<br/>بالضبط؟
        </h2>
        <div style={{ marginTop:14, height:6, background:'rgba(255,255,255,.15)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ width:'66%', height:'100%',
            background:`linear-gradient(90deg, ${C.cobalt500}, ${C.gold500})`, borderRadius:3 }}/>
        </div>
      </div>
    </div>

    <div style={{ padding:'20px 16px', height:'calc(100% - 44px - 152px - 80px)', overflowY:'auto' }}>
      <div style={{ padding:'10px 14px', borderRadius:10,
        background:C.ok100, border:`1px solid ${C.ok500}55`,
        display:'flex', alignItems:'center', gap:10, fontSize:12.5, color:C.navy900 }}>
        <div style={{ width:22, height:22, borderRadius:11, background:C.ok500, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>٣</div>
        <span><b>ممتاز</b> — دقة الفئات أعلى من ٧٦٪</span>
      </div>

      <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {[
          { t:'إضاءة المسرح', i:'sparkles', s:true },
          { t:'أنظمة الصوت', i:'sparkles', s:true },
          { t:'بث مباشر', i:'camera', s:true },
          { t:'تصوير', i:'camera', s:false },
          { t:'شاشات LED', i:'image', s:false },
          { t:'ضيافة', i:'briefcase', s:false },
        ].map((c,i)=>(
          <button key={i} style={{
            padding:'14px 12px', borderRadius:12, textAlign:'start',
            background: c.s ? `linear-gradient(145deg, ${C.cobalt500}, ${C.navy900})` : '#fff',
            color: c.s ? '#fff' : C.n900,
            border: c.s ? 'none' : `1px solid ${C.n200}`,
            position:'relative',
          }}>
            <div style={{ width:32, height:32, borderRadius:8,
              background: c.s ? 'rgba(255,255,255,.18)' : C.cobalt100,
              color: c.s ? '#fff' : C.cobalt500,
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name={c.i} size={16}/>
            </div>
            <div style={{ fontSize:13, fontWeight:800, marginTop:10 }}>{c.t}</div>
            {c.s && <span style={{ position:'absolute', top:10, insetInlineEnd:10,
              width:18, height:18, borderRadius:9, background:'#fff', color:C.navy900,
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name="check" size={11} strokeWidth={3}/>
            </span>}
          </button>
        ))}
      </div>
    </div>

    <div style={{ position:'absolute', bottom:0, insetInline:0, padding:'12px 16px 20px', background:'#fff',
      borderTop:`1px solid ${C.n200}` }}>
      <button style={{ width:'100%', padding:'15px', borderRadius:12,
        background:`linear-gradient(90deg, ${C.navy900}, ${C.cobalt500})`,
        color:'#fff', fontWeight:800, fontSize:14.5, display:'flex',
        alignItems:'center', justifyContent:'center', gap:8 }}>
        متابعة للخطوة ٣ <Icon name="chevron-left" size={17}/>
      </button>
    </div>
  </div>
);

const MobilePending = () => (
  <div className="mk" style={{ background:C.navy900, color:'#fff' }}>
    <div style={{ height:44, display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 20px', fontSize:13, fontWeight:700 }}>
      <span>٩:٤١</span><span style={{ fontSize:11 }}>⚡</span>
    </div>
    <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 30%, ${C.cobalt500}55, transparent 55%)` }}/>
    <div style={{ position:'relative', padding:'40px 24px', textAlign:'center' }}>
      <div style={{ width:90, height:90, margin:'20px auto 0', borderRadius:45,
        background:`linear-gradient(135deg, ${C.cobalt500}, ${C.navy900})`,
        display:'flex', alignItems:'center', justifyContent:'center', position:'relative',
        animation:'bob 3s ease-in-out infinite', boxShadow:`0 20px 40px ${C.cobalt500}55` }}>
        <Icon name="shield" size={44}/>
        {[0,1].map(i=>(
          <div key={i} style={{ position:'absolute', inset:-6-(i*6), borderRadius:50,
            border:`1px solid ${C.cobalt500}${i===0?'88':'44'}`,
            animation:`pulse ${2+i*.5}s ease-in-out infinite` }}/>
        ))}
      </div>

      <div style={{ fontSize:11, color:C.gold500, fontWeight:800, letterSpacing:.5, marginTop:22 }}>
        APPLICATION #{ar(7421)}
      </div>
      <h1 style={{ fontSize:30, fontWeight:900, marginTop:10, letterSpacing:-0.5, lineHeight:1.2 }}>
        {AR.pending.title}
      </h1>
      <p style={{ fontSize:13.5, color:'rgba(255,255,255,.7)', marginTop:10, lineHeight:1.65 }}>
        عادةً ما تستغرق المراجعة ٢٤ ساعة عمل
      </p>
    </div>

    <div style={{
      position:'absolute', bottom:0, insetInline:12, background:'rgba(255,255,255,.06)',
      border:'1px solid rgba(255,255,255,.1)',
      borderTopLeftRadius:20, borderTopRightRadius:20, padding:18, backdropFilter:'blur(12px)',
      maxHeight:'55%', overflow:'hidden',
    }}>
      <div style={{ width:40, height:4, background:'rgba(255,255,255,.3)', borderRadius:2, margin:'0 auto 12px' }}/>
      <div style={{ fontSize:13, fontWeight:800 }}>{AR.pending.checklistTitle}</div>
      <ul style={{ marginTop:8 }}>
        {AR.pending.checks.slice(0,4).map((c,i)=>(
          <li key={c.k} style={{ display:'grid', gridTemplateColumns:'26px 1fr', gap:10,
            padding:'10px 0', borderTop: i===0?'none':'1px solid rgba(255,255,255,.08)' }}>
            <div style={{ width:22, height:22, borderRadius:11,
              background: c.st==='done' ? C.ok500 : c.st==='running' ? C.cobalt500 : 'rgba(255,255,255,.08)',
              color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {c.st==='done' ? <Icon name="check" size={11} strokeWidth={3}/> :
               c.st==='running' ? <span style={{ width:6, height:6, borderRadius:3, background:'#fff', animation:'pulse 1s infinite' }}/> :
               <Icon name="dot" size={6}/>}
            </div>
            <div style={{ fontSize:12.5, fontWeight:600,
              color: c.st==='waiting' ? 'rgba(255,255,255,.5)' : '#fff' }}>{c.t}</div>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

// ── Export screen list ─────────────────────────────────────────────────
const directionBScreens = [
  { id:'b1', label:'1 · إنشاء الحساب', render: () => <BSignup/> },
  { id:'b2', label:'2 · اختيار المسار', render: () => <BPath/> },
  { id:'b3', label:'3 · الخطوة ١: معلومات النشاط', render: () => <BStep1/> },
  { id:'b4', label:'4 · الخطوة ٢: الفئات', render: () => <BStep2/> },
  { id:'b5', label:'5 · الخطوة ٣: التوثيق', render: () => <BStep3/> },
  { id:'b6', label:'6 · قيد المراجعة', render: () => <BPending/> },
  { id:'b7', label:'7 · تم الاعتماد', render: () => <BApproved/> },
];

Object.assign(window, { directionBScreens, MobileA, MobileB, MobilePending });
