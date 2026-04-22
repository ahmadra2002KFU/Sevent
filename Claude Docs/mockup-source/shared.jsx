// shared.jsx — Sevent onboarding primitives shared between directions A & B.
// Everything here is dumb presentation: icons, pills, the Sevent logo, the
// verification checklist block, the live profile-preview card, and the
// canonical copy deck (Arabic-first). No React state beyond what's needed
// for obvious micro-interactions.

const { useState, useEffect, useRef } = React;

// ── Brand palette shorthand ─────────────────────────────────────────────
const C = {
  navy900: '#0f2e5c', navy700: '#1c3f73', navy500: '#355b95',
  cobalt500: '#1e7bd8', cobalt400: '#3d91e5', cobalt100: '#dcebfb',
  gold500: '#c8993a', gold100: '#f6ebce',
  n50: '#fafaf7', n100: '#f4f4ef', n200: '#e7e6df',
  n400: '#a9a9a1', n600: '#6b6b64', n900: '#1a1a18',
  ok500: '#1e9a5b', ok100: '#d8f1e3',
  warn500: '#d89423', warn100: '#faebd3',
  danger500: '#c4353c', danger100: '#f6d7d9',
};

// ── Sevent lockup (inline, keeps RTL-safe isolation) ───────────────────
const SeventLogo = ({ size=28, tone='color' }) => {
  const h = size;
  const navy = tone === 'white' ? '#fff' : C.navy900;
  const cobalt = tone === 'white' ? '#fff' : C.cobalt500;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', direction:'ltr' }}>
      <svg width={h * 760/180} height={h} viewBox="0 0 760 180">
        <path d="M24 8 L204 8 L180 148 L0 148 Z" fill={cobalt}/>
        <text x="102" y="120" fontFamily="Inter" fontWeight="900" fontStyle="italic" fontSize="140" textAnchor="middle" fill="#fff" letterSpacing="-4">S</text>
        <text x="218" y="120" fontFamily="Inter" fontWeight="900" fontStyle="italic" fontSize="140" textAnchor="start" fill={navy} letterSpacing="-2">EVENT</text>
        <rect x="18" y="158" width="724" height="10" fill={cobalt}/>
      </svg>
    </span>
  );
};

const LogoMark = ({ size=36, tone='color' }) => {
  const cobalt = tone === 'white' ? '#fff' : C.cobalt500;
  return (
    <svg width={size} height={size*160/210} viewBox="0 0 210 160" style={{direction:'ltr'}}>
      <path d="M26 8 L204 8 L180 150 L2 150 Z" fill={cobalt}/>
      <text x="103" y="122" fontFamily="Inter" fontWeight="900" fontStyle="italic" fontSize="140" textAnchor="middle" fill="#fff" letterSpacing="-4">S</text>
    </svg>
  );
};

// ── Minimal icon set (stroke-based so they inherit color) ──────────────
const Icon = ({ name, size=18, strokeWidth=1.8, style={}, ...rest }) => {
  const common = { width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth, strokeLinecap:'round', strokeLinejoin:'round', style, ...rest };
  switch(name) {
    case 'check': return <svg {...common}><path d="M4 12l5 5L20 6"/></svg>;
    case 'check-circle': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>;
    case 'arrow-left': return <svg {...common}><path d="M15 18l-6-6 6-6"/></svg>;
    case 'arrow-right': return <svg {...common}><path d="M9 18l6-6-6-6"/></svg>;
    case 'chevron-down': return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevron-left': return <svg {...common}><path d="M15 18l-6-6 6-6"/></svg>;
    case 'chevron-right': return <svg {...common}><path d="M9 18l6-6-6-6"/></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'x': return <svg {...common}><path d="M18 6L6 18M6 6l12 12"/></svg>;
    case 'user': return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>;
    case 'building': return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"/></svg>;
    case 'briefcase': return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>;
    case 'camera': return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M9 7l1.5-3h3L15 7"/></svg>;
    case 'image': return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M3 17l5-5 4 4 3-3 6 6"/></svg>;
    case 'upload': return <svg {...common}><path d="M12 15V4M7 9l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>;
    case 'file': return <svg {...common}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>;
    case 'globe': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case 'map-pin': return <svg {...common}><path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'sparkles': return <svg {...common}><path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5zM19 14l.8 2 2 .8-2 .8L19 19l-.8-1.4L16 16.8l2-.8zM5 4l.7 1.8L7 6.5 5.7 7.2 5 9l-.7-1.8L3 6.5l1.3-.7z"/></svg>;
    case 'star': return <svg {...common}><path d="M12 2l3 7 7 .6-5.4 4.6 1.7 7-6.3-4-6.3 4 1.7-7L2 9.6 9 9z"/></svg>;
    case 'mail': return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>;
    case 'phone': return <svg {...common}><path d="M22 17v3a2 2 0 0 1-2 2c-10 0-18-8-18-18a2 2 0 0 1 2-2h3l2 5-2.5 1.5a12 12 0 0 0 7 7L16 13l5 2z"/></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'shield': return <svg {...common}><path d="M12 2l8 3v7c0 5-4 9-8 10-4-1-8-5-8-10V5z"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'badge-check': return <svg {...common}><path d="M12 2l2 2.3 3-.5.8 3L20 8l-1.2 2.8.8 3-3-.5L14 16l-2-2.3L10 16l-3-.5L6 12l-1.2-2.8L6 8l.8-3 3 .5z"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'link': return <svg {...common}><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>;
    case 'sun': return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6 6l-1.4-1.4M19.4 4.6L18 6M6 18l-1.4 1.4M19.4 19.4L18 18"/></svg>;
    case 'moon': return <svg {...common}><path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z"/></svg>;
    case 'bell': return <svg {...common}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>;
    case 'eye': return <svg {...common}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'party': return <svg {...common}><path d="M4 20l4-11 11 4L4 20z"/><path d="M14 3l.5 2M18 4l2 .5M15 10l3-3"/></svg>;
    case 'rocket': return <svg {...common}><path d="M14 3c-4 1-7 5-8 10l-3 2 3 3 2-3c5-1 9-4 10-8l-4-4z"/><circle cx="14" cy="10" r="1.3"/></svg>;
    case 'trending': return <svg {...common}><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>;
    case 'flag': return <svg {...common}><path d="M4 21V4M4 4h12l-2 4 2 4H4"/></svg>;
    case 'dot': return <svg {...common}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>;
    case 'riyal': return <svg {...common} strokeWidth="2"><path d="M6 4v11l6-2M6 15l6-2M14 3l-2 11M18 9l-6 2M18 14l-6 2"/></svg>;
    case 'external': return <svg {...common}><path d="M14 3h7v7M10 14L21 3"/><path d="M17 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h7"/></svg>;
    case 'chat': return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'arabic': return <svg {...common} fill="currentColor" stroke="none"><text x="12" y="17" textAnchor="middle" fontSize="14" fontFamily="Tajawal" fontWeight="700">ع</text></svg>;
    default: return null;
  }
};

// ── Arabic copy bible ──────────────────────────────────────────────────
// We author the RTL primary copy once and reuse across directions.
const AR = {
  brand: 'سِفنت',
  signup: {
    title: 'أنشئ حساب مزود الخدمة',
    sub: 'انضم إلى أكبر منصة فعاليات في المملكة. خطوات قليلة وتبدأ في استقبال طلبات العروض.',
    email: 'البريد الإلكتروني للعمل',
    phone: 'رقم الجوال',
    password: 'كلمة المرور',
    passwordHint: '٨ أحرف على الأقل مع رقم ورمز',
    cta: 'أنشئ الحساب',
    terms: 'بالمتابعة، أوافق على الشروط وسياسة الخصوصية',
    already: 'لديك حساب بالفعل؟',
    signin: 'تسجيل الدخول',
    whyTitle: 'لماذا سِفنت؟',
    why: [
      { icon:'trending', t:'طلبات حقيقية', d:'منظمون بميزانيات محددة في كل أنحاء المملكة' },
      { icon:'shield', t:'ضمان الدفع', d:'الأموال محفوظة في حساب ضمان حتى انتهاء الفعالية' },
      { icon:'badge-check', t:'توثيق رسمي', d:'تحقّق تلقائي من السجل التجاري عبر واثق' },
    ],
  },
  path: {
    title: 'حدّثنا عن نشاطك',
    sub: 'نُخصّص رحلة التسجيل بناءً على شكل نشاطك — تستغرق ٨ دقائق في المتوسط.',
    freelancerT: 'مستقل أو صاحب عمل فردي',
    freelancerD: 'تعمل باسمك الشخصي أو تحت اسم تجاري بسيط — نحتاج فقط هوية وطنية وشهادة آيبان.',
    companyT: 'شركة مسجّلة',
    companyD: 'لديك سجل تجاري نشط — سنتحقق منه تلقائياً ونعرض شارة التوثيق على ملفك.',
    cta: 'متابعة',
  },
  wizard: {
    step1: 'معلومات النشاط',
    step2: 'الفئات والشرائح',
    step3: 'التوثيق والهوية البصرية',
    businessName: 'الاسم التجاري',
    businessNamePh: 'مثال: استوديو أضواء الرياض',
    bio: 'نبذة قصيرة',
    bioPh: 'جملتان أو ثلاث عن تخصصك — ستظهر للمنظمين في ملفك العام',
    bioHint: 'اكتبها كما تتحدث لعميل. تجنّب التكرار.',
    crNumber: 'رقم السجل التجاري',
    crNumberHint: 'سنتحقق منه فوراً عبر منصة واثق',
    nationalId: 'رقم الهوية الوطنية',
    baseCity: 'المدينة الأساسية',
    baseCityPh: 'اختر مدينتك…',
    serviceArea: 'مدن الخدمة',
    serviceAreaEmpty: 'أضف المدن التي تستطيع تقديم خدماتك فيها',
    languages: 'لغات العمل',
    importUrl: 'لديك موقع إلكتروني؟',
    importUrlSub: 'ألصق الرابط ونعبّئ الحقول تلقائياً',
    importUrlCta: 'استيراد',
    categories: 'الفئات الرئيسية',
    categoriesHint: 'اختر ما لا يزيد عن ٦ فئات — الأقل أدق',
    segments: 'شرائح السوق',
    segmentsHint: 'الشرائح التي تخدمها عادة',
    logoLabel: 'الشعار',
    logoHint: 'PNG أو SVG، أقل من ١ ميجابايت',
    iban: 'شهادة الآيبان',
    ibanHint: 'PDF رسمي من بنكك — نحتاجها لصرف الأرباح',
    companyProfile: 'ملف الشركة (اختياري)',
    companyProfileHint: 'PDF حتى ٨ ميجابايت — يُعرض للمنظمين بعد قبول العرض',
    back: 'رجوع',
    continue: 'متابعة',
    submit: 'أرسل للمراجعة',
    saveAndExit: 'حفظ والخروج',
    draftSaved: 'تم الحفظ تلقائياً قبل ثوانٍ',
  },
  pending: {
    title: 'استلمنا طلبك',
    sub: 'فريق التوثيق يراجع الآن مستنداتك. عادةً ما تستغرق المراجعة ٢٤ ساعة عمل.',
    emailNotice: 'سنرسل إشعاراً على {email} فور اعتماد ملفك',
    checklistTitle: 'ما يحدث الآن',
    checks: [
      { k:'wathq', t:'التحقق من السجل التجاري', st:'done', d:'مُطابق في قاعدة بيانات واثق · الرياض · نشط' },
      { k:'identity', t:'مطابقة الهوية', st:'done', d:'تمّت المطابقة عبر نفاذ' },
      { k:'iban', t:'التحقق من الآيبان', st:'running', d:'جارٍ التحقق مع البنك — عادةً ٣٠ دقيقة' },
      { k:'portfolio', t:'مراجعة المعرض والخدمات', st:'waiting', d:'سيراجعها مختصّ من فريقنا' },
      { k:'badge', t:'إصدار شارة مزوّد موثّق', st:'waiting', d:'فور اكتمال الخطوات أعلاه' },
    ],
    timelineTitle: 'ما بعد الاعتماد',
    timeline: [
      { t:'اعتماد الملف', d:'خلال ٢٤ ساعة' },
      { t:'أول طلب عرض', d:'خلال ٤٨ ساعة في المتوسط' },
      { t:'أول حجز', d:'حسب جودة عروضك' },
    ],
    cta: 'عد إلى لوحة التحكم',
    chatCta: 'تحدّث مع فريق التوثيق',
  },
  welcome: {
    congrats: 'مبروك! ملفك معتمد',
    sub: 'شارة "مزوّد موثّق" ظاهرة الآن على ملفك العام. لديك ٣ طلبات عروض تنتظرك.',
    cta1: 'اذهب للطلبات',
    cta2: 'عاين ملفي العام',
    tourTitle: 'جولة سريعة (٤٥ ثانية)',
  },
};

// ── Verification checklist block ───────────────────────────────────────
const ChecklistRow = ({ item, palette='cobalt' }) => {
  const st = item.st;
  const dotBg = st === 'done' ? C.ok500 : st === 'running' ? C.cobalt500 : C.n200;
  const dotFg = st === 'waiting' ? C.n600 : '#fff';
  return (
    <li style={{ display:'grid', gridTemplateColumns:'32px 1fr auto', gap:12, alignItems:'start', padding:'14px 0', borderTop:`1px solid ${C.n200}` }}>
      <div style={{
        width:28, height:28, borderRadius:14,
        background: dotBg, color:dotFg,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:12, fontWeight:700, position:'relative',
      }}>
        {st==='done' ? <Icon name="check" size={16} strokeWidth={2.4}/> :
         st==='running' ? (
           <svg width="18" height="18" viewBox="0 0 18 18">
             <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="2.2"/>
             <circle cx="9" cy="9" r="7" fill="none" stroke="#fff" strokeWidth="2.2" strokeDasharray="12 44" strokeLinecap="round">
               <animateTransform attributeName="transform" type="rotate" from="0 9 9" to="360 9 9" dur="1.1s" repeatCount="indefinite"/>
             </circle>
           </svg>
         ) : <Icon name="dot" size={10}/>}
      </div>
      <div>
        <div style={{ fontSize:14, fontWeight:600, color:C.n900 }}>{item.t}</div>
        <div style={{ fontSize:12.5, color:C.n600, marginTop:3, lineHeight:1.5 }}>{item.d}</div>
      </div>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:.3,
        color: st==='done' ? C.ok500 : st==='running' ? C.cobalt500 : C.n400,
        textTransform:'uppercase',
      }}>
        {st==='done' ? '✓' : st==='running' ? '…' : '—'}
      </div>
    </li>
  );
};

// ── Smart resume card ──────────────────────────────────────────────────
const ResumeCard = ({ percent=40, step=2, onResume }) => (
  <div style={{
    background:`linear-gradient(135deg, ${C.cobalt100} 0%, ${C.n100} 100%)`,
    borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12,
    border:`1px solid ${C.cobalt500}33`, marginBottom:20,
  }}>
    <div style={{
      width:42, height:42, borderRadius:21, background:'#fff',
      display:'flex', alignItems:'center', justifyContent:'center',
      color:C.cobalt500, fontSize:12, fontWeight:700, position:'relative',
    }}>
      <svg width="42" height="42" viewBox="0 0 42 42" style={{ position:'absolute', inset:0 }}>
        <circle cx="21" cy="21" r="18" fill="none" stroke={C.n200} strokeWidth="3"/>
        <circle cx="21" cy="21" r="18" fill="none" stroke={C.cobalt500} strokeWidth="3"
          strokeDasharray={`${percent * 1.131} 200`} strokeLinecap="round" transform="rotate(-90 21 21)"/>
      </svg>
      <span style={{ position:'relative', fontSize:11 }}>{percent}%</span>
    </div>
    <div style={{ flex:1 }}>
      <div style={{ fontWeight:700, fontSize:14, color:C.navy900 }}>أكمل من حيث توقفت</div>
      <div style={{ fontSize:12.5, color:C.n600, marginTop:2 }}>
        الخطوة {step} من ٣ · تم الحفظ تلقائياً قبل ٣ دقائق
      </div>
    </div>
    <button style={{
      background:C.navy900, color:'#fff', padding:'9px 16px', borderRadius:8,
      fontSize:13, fontWeight:600,
    }}>متابعة <Icon name="chevron-left" size={14} style={{ verticalAlign:-2, marginInlineStart:4 }}/></button>
  </div>
);

// ── Cities & categories sample data ────────────────────────────────────
const CITIES = [
  { slug:'riyadh', ar:'الرياض', en:'Riyadh' },
  { slug:'jeddah', ar:'جدة', en:'Jeddah' },
  { slug:'dammam', ar:'الدمام', en:'Dammam' },
  { slug:'makkah', ar:'مكة المكرمة', en:'Makkah' },
  { slug:'madinah', ar:'المدينة المنورة', en:'Madinah' },
  { slug:'khobar', ar:'الخبر', en:'Al Khobar' },
  { slug:'abha', ar:'أبها', en:'Abha' },
  { slug:'taif', ar:'الطائف', en:'Taif' },
];

const CATEGORIES = [
  { parent:'إنتاج المسرح والصوت', child:'إضاءة المسرح', icon:'sparkles' },
  { parent:'إنتاج المسرح والصوت', child:'أنظمة الصوت', icon:'sparkles' },
  { parent:'التصوير', child:'تصوير فوتوغرافي', icon:'camera' },
  { parent:'التصوير', child:'تصوير فيديو + بث مباشر', icon:'camera' },
  { parent:'الضيافة', child:'ضيافة فاخرة', icon:'briefcase' },
  { parent:'الضيافة', child:'تغطية قهوة عربية', icon:'briefcase' },
];

const SEGMENTS = [
  { s:'corporate', ar:'فعاليات شركات' },
  { s:'gov', ar:'جهات حكومية' },
  { s:'wedding', ar:'أعراس' },
  { s:'private', ar:'خاصة' },
  { s:'brand', ar:'تفعيلات علامات تجارية' },
];

// ── Profile preview card (used in the live preview pane) ────────────────
const ProfilePreview = ({ name, bio, city, categories=[], logo=null, verified=false, accent=C.cobalt500 }) => {
  const hasName = name && name.trim().length > 0;
  return (
    <div style={{
      background:'#fff', borderRadius:16, overflow:'hidden',
      border:`1px solid ${C.n200}`, boxShadow:'var(--shadow)',
    }}>
      {/* hero */}
      <div style={{
        height:76, background:`linear-gradient(135deg, ${C.navy900} 0%, ${accent} 110%)`,
        position:'relative', overflow:'hidden',
      }}>
        <div style={{
          position:'absolute', inset:0, background:`radial-gradient(circle at 80% -20%, ${C.gold100}33, transparent 55%)`,
        }}/>
      </div>
      <div style={{ padding:'0 16px 16px', marginTop:-30, position:'relative' }}>
        <div style={{
          width:60, height:60, borderRadius:30, background:'#fff',
          border:`3px solid #fff`, boxShadow:'var(--shadow)',
          display:'flex', alignItems:'center', justifyContent:'center',
          overflow:'hidden',
        }}>
          {logo ? <img src={logo} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> :
            <div style={{ width:'100%', height:'100%', background:C.n100, display:'flex',
              alignItems:'center', justifyContent:'center', color:C.n400 }}>
              <Icon name="image" size={22}/>
            </div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10 }}>
          <div style={{
            fontSize:16, fontWeight:800, color: hasName ? C.n900 : C.n400,
            fontStyle: hasName ? 'normal' : 'italic',
          }}>{hasName ? name : 'اسم نشاطك'}</div>
          {verified && <span title="مزوّد موثّق" style={{
            color:C.gold500, display:'inline-flex',
          }}><Icon name="badge-check" size={16} strokeWidth={2.2}/></span>}
        </div>
        <div style={{ fontSize:12.5, color:C.n600, marginTop:2, display:'flex', alignItems:'center', gap:6 }}>
          <Icon name="map-pin" size={13}/>
          <span>{city || 'المدينة'}</span>
        </div>
        <div style={{
          fontSize:12.5, color: bio ? C.n600 : C.n400, marginTop:10, lineHeight:1.65,
          fontStyle: bio ? 'normal' : 'italic', minHeight:40,
        }}>
          {bio || 'ستظهر نبذتك القصيرة هنا…'}
        </div>

        {/* tags */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:12 }}>
          {categories.length ? categories.slice(0,4).map((c,i) => (
            <span key={i} style={{
              fontSize:11, padding:'3px 9px', borderRadius:12,
              background:C.cobalt100, color:C.cobalt500, fontWeight:600,
            }}>{c}</span>
          )) : (
            <span style={{ fontSize:11, color:C.n400, fontStyle:'italic' }}>
              أضِف الفئات في الخطوة الثانية
            </span>
          )}
        </div>

        {/* fake stats */}
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6,
          marginTop:14, paddingTop:14, borderTop:`1px solid ${C.n200}`,
        }}>
          {[['استجابة','٤ س'],['حجوزات','—'],['تقييم','—']].map(([l,v],i)=> (
            <div key={i} style={{ textAlign:'center' }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.n900 }}>{v}</div>
              <div style={{ fontSize:10.5, color:C.n600, marginTop:1 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── README artboard ────────────────────────────────────────────────────
const Readme = () => (
  <div className="mk" style={{ padding:32, direction:'rtl', background:'#fff' }}>
    <SeventLogo size={24}/>
    <h1 style={{ fontSize:28, fontWeight:800, color:C.navy900, marginTop:28, lineHeight:1.25 }}>
      رحلة تسجيل المزوّد
    </h1>
    <p style={{ fontSize:15, color:C.n600, marginTop:10, lineHeight:1.7 }}>
      تصميم كامل لتجربة انضمام مزوّدي الخدمة إلى سِفنت — من إنشاء الحساب حتى اعتماد الملف. عربي كلغة أساسية، متجاوب للشاشات الكبيرة والجوال.
    </p>

    <div style={{ display:'grid', gap:16, marginTop:28 }}>
      {[
        { n:'١', t:'اتجاهان للاختيار', d:'مُقيّد مهني (A) مقابل جريء مبرّند (B). نفس الرحلة، لغة بصرية مختلفة.' },
        { n:'٢', t:'مساران حسب نوع النشاط', d:'المستقلّ يتحقق بنفاذ فقط. الشركة المسجّلة تتحقق بواثق + شارة توثيق تلقائية.' },
        { n:'٣', t:'معاينة حيّة', d:'بطاقة الملف العام تتحدّث أثناء الكتابة — دافع قوي لإتمام البيانات.' },
        { n:'٤', t:'ذكاء خفيف', d:'استيراد من الموقع، حفظ تلقائي، واستئناف من حيث توقفت.' },
        { n:'٥', t:'لحظة احتفال', d:'عند الاعتماد: مفرقعات، شارة موثّق، و٣ طلبات عروض جاهزة.' },
      ].map(b => (
        <div key={b.n} style={{ display:'flex', gap:14 }}>
          <div style={{
            width:30, height:30, borderRadius:15, background:C.cobalt100, color:C.cobalt500,
            display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, flexShrink:0,
          }}>{b.n}</div>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:C.navy900 }}>{b.t}</div>
            <div style={{ fontSize:13, color:C.n600, marginTop:2, lineHeight:1.65 }}>{b.d}</div>
          </div>
        </div>
      ))}
    </div>

    <div style={{
      marginTop:32, padding:18, borderRadius:12, background:C.n100,
      border:`1px dashed ${C.n200}`, fontSize:12.5, color:C.n600, lineHeight:1.7,
    }}>
      <strong style={{ color:C.navy900 }}>كيف تقرأ اللوحة:</strong>
      <br/>كل سطر = اتجاه كامل (٧ شاشات). اسحب لاستعراض. اضغط أي شاشة للتركيز (استخدم ← →).
    </div>

    <div style={{ position:'absolute', bottom:28, right:32, left:32, fontSize:11, color:C.n400 }}>
      الألوان والطباعة من <code>Claude Docs/design-tokens.md</code>
    </div>
  </div>
);

// Convenience: AR number formatter
const ar = (n) => (n ?? '').toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

// Export to window for other scripts
Object.assign(window, {
  C, SeventLogo, LogoMark, Icon,
  AR, CITIES, CATEGORIES, SEGMENTS,
  ChecklistRow, ResumeCard, ProfilePreview, Readme, ar,
});
