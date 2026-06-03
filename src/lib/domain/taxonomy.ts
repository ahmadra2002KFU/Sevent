// Canonical boss-CSV supplier taxonomy (12 parents, 75 item categories).
// Single source of truth for app labels, static tests, seed scripts, and
// migration drift checks. The migration stores boss-provided labels in
// source_name_* and uses normalized app-facing names/slugs here.

export const TAXONOMY_VERSION = "boss_csv_2026_05";

export type TaxonomyItem = {
  slug: string;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  source_name_en?: string;
  source_name_ar?: string;
};

export type TaxonomyParent = TaxonomyItem & {
  sort_order: number;
  children: ReadonlyArray<TaxonomyItem>;
};

export const TAXONOMY: ReadonlyArray<TaxonomyParent> = Object.freeze([
  {
    slug: "event_management",
    name_en: "Event Management",
    name_ar: "إدارة الفعاليات",
    sort_order: 10,
    children: [
      {
        slug: "initial_design_and_manufacturing_services",
        name_en: "Initial Design & Manufacturing Services",
        name_ar: "خدمات التصميم الأولي والتصنيع",
        description_en: "Creative design services that transform concepts into prototypes and manufacturable elements.",
        description_ar: "تقديم خدمات التصميم الإبداعي وتحويل الأفكار إلى مجسمات وعناصر قابلة للتنفيذ والتصنيع.",
      },
      {
        slug: "project_management",
        name_en: "Project Management",
        name_ar: "إدارة المشاريع",
        description_en: "Managing project phases from planning through delivery, ensuring objectives are met on time and within budget.",
        description_ar: "إدارة مراحل المشاريع من التخطيط حتى التسليم وضمان تحقيق الأهداف ضمن الوقت والميزانية.",
      },
      {
        slug: "project_setup_requirements",
        name_en: "Project Setup Requirements",
        name_ar: "متطلبات تجهيز المشاريع",
        description_en: "Logistical and operational requirements needed to set up projects before event launch.",
        description_ar: "توفير المتطلبات اللوجستية والتشغيلية اللازمة لتجهيز المشاريع قبل انطلاق الفعاليات.",
      },
      {
        slug: "operettas",
        name_en: "Operettas",
        name_ar: "الأوبريتات",
        description_en: "Integrated artistic productions combining music, singing, and acting to deliver event messages.",
        description_ar: "إنتاج عروض فنية متكاملة تجمع بين الموسيقى والغناء والتمثيل لإيصال رسائل الفعاليات.",
      },
      {
        slug: "creative_content",
        name_en: "Creative Content",
        name_ar: "محتويات إبداعية",
        description_en: "Developing creative written and visual content that supports event messaging and enhances audience experience.",
        description_ar: "تطوير محتوى إبداعي مكتوب ومرئي يدعم رسائل الفعاليات ويعزز تجربة الجمهور.",
      },
      {
        slug: "data_analytics",
        name_en: "Data Analytics",
        name_ar: "تحليل البيانات",
        description_en: "Collecting and analyzing event and audience data to extract insights that support decision-making and performance.",
        description_ar: "جمع وتحليل بيانات الفعاليات والجمهور لاستخلاص رؤى تدعم اتخاذ القرار وتحسين الأداء.",
      },
      {
        slug: "live_performances",
        name_en: "Live Performances",
        name_ar: "العروض الحية",
        description_en: "Interactive live performances including music, dance, and showcase segments in front of audiences.",
        description_ar: "تنظيم عروض حية تفاعلية تشمل الموسيقى والرقص والفقرات الاستعراضية أمام الجمهور.",
      },
      {
        slug: "photo_booths",
        name_en: "Photo Booths",
        name_ar: "الفوتوبوث",
        description_en: "Interactive photo booths that allow guests to capture customized memorable pictures branded with event identity.",
        description_ar: "توفير كبائن تصوير تفاعلية تتيح للزوار التقاط صور تذكارية مخصصة بهوية الفعاليات.",
      },
    ],
  },
  {
    slug: "media_production",
    name_en: "Media Production",
    name_ar: "الإنتاج الإعلامي",
    sort_order: 20,
    children: [
      {
        slug: "production_and_media_services",
        name_en: "Production & Media Services",
        name_ar: "خدمات الإنتاج والميديا",
        description_en: "Integrated media production services including filming, editing, and direction for professional content.",
        description_ar: "خدمات إنتاج إعلامي متكاملة تشمل التصوير والمونتاج والإخراج لإنتاج محتوى احترافي.",
      },
      {
        slug: "audio_production",
        name_en: "Audio Production",
        name_ar: "الإنتاج الصوتي",
        description_en: "Producing and recording high-quality audio content for advertising, broadcasting, and media purposes.",
        description_ar: "إنتاج وتسجيل المحتوى الصوتي بجودة عالية للأغراض الإعلانية والإذاعية والإعلامية.",
      },
      {
        slug: "technical_equipment_and_studios",
        name_en: "Technical Equipment & Studios",
        name_ar: "المعدات التقنية والاستوديوهات",
        description_en: "Advanced technical equipment and fully-equipped studios for professional audio and visual production.",
        description_ar: "توفير معدات تقنية متقدمة واستوديوهات مجهزة لإنتاج محتوى صوتي ومرئي احترافي.",
      },
      {
        slug: "live_broadcasting_and_coverage",
        name_en: "Live Broadcasting & Coverage",
        name_ar: "خدمات البث والتغطية المباشرة",
        description_en: "Live broadcasting and real-time media coverage services across various channels and platforms.",
        description_ar: "خدمات البث المباشر والتغطية الإعلامية الفورية للفعاليات عبر مختلف القنوات والمنصات.",
      },
      {
        slug: "ob_vans_and_live_broadcasting_rental",
        name_en: "OB Vans & Live Broadcasting Rental",
        name_ar: "تأجير عربات البث الخارجي والبث المباشر",
        description_en: "Renting mobile outside broadcast vans equipped to transmit events live with professional quality.",
        description_ar: "تأجير عربات البث الخارجي المتنقلة المجهزة لنقل الفعاليات مباشرة بجودة احترافية.",
      },
      {
        slug: "tv_programs_and_promotional_videos_production",
        name_en: "TV Programs & Promotional Videos Production",
        name_ar: "إنتاج البرامج التلفزيونية والفيديوهات الدعائية",
        description_en: "Producing integrated TV programs and promotional videos to professional broadcasting standards.",
        description_ar: "إنتاج برامج تلفزيونية وفيديوهات دعائية وترويجية متكاملة بمعايير البث الاحترافي.",
      },
      {
        slug: "motion_graphics_editing_and_color_grading",
        name_en: "Motion Graphics, Editing & Color Grading",
        name_ar: "الموشن جرافيك والمونتاج وتصحيح الألوان",
        description_en: "Motion graphics, editing, and color grading services for cinematic-quality visual content.",
        description_ar: "خدمات الموشن جرافيك والمونتاج وتصحيح الألوان لإخراج محتوى مرئي بجودة سينمائية.",
      },
      {
        slug: "media_campaigns_and_broadcast_technology",
        name_en: "Media Campaigns & Broadcast Technology",
        name_ar: "الحملات الإعلامية وتقنيات البث",
        description_en: "Executing integrated media campaigns using the latest broadcasting and distribution technologies to reach wide audiences.",
        description_ar: "تنفيذ حملات إعلامية متكاملة باستخدام أحدث تقنيات البث والتوزيع للوصول لشرائح واسعة.",
      },
      {
        slug: "motion_graphics_services",
        name_en: "Motion Graphics Services",
        name_ar: "خدمات الموشن جرافيك",
        description_en: "Producing animated graphics and creative visual elements to deliver messages and ideas in an engaging visual format.",
        description_ar: "إنتاج رسوم متحركة وعناصر بصرية إبداعية لإيصال الرسائل والأفكار بشكل مرئي جذاب.",
      },
      {
        slug: "media_documentation_and_reporting",
        name_en: "Media Documentation & Reporting",
        name_ar: "التوثيق وإعداد التقارير الإعلامية",
        description_en: "Documenting events and preparing media and visual reports for content archiving and sharing.",
        description_ar: "توثيق الفعاليات وإعداد التقارير الإعلامية والمرئية الموثقة لأرشفة المحتوى ومشاركته.",
      },
    ],
  },
  {
    slug: "marketing_pr",
    name_en: "Marketing & PR",
    name_ar: "التسويق والعلاقات العامة",
    sort_order: 30,
    children: [
      {
        slug: "influencers",
        name_en: "Influencers",
        name_ar: "المؤثرون",
        description_en: "Collaborating with influencers and digital personalities to promote events and reach a wide audience.",
        description_ar: "التعاون مع المؤثرين والشخصيات الرقمية للترويج للفعاليات والوصول إلى جمهور واسع.",
      },
      {
        slug: "media_buying",
        name_en: "Media Buying",
        name_ar: "شراء المساحات الإعلانية والإعلامية",
        description_en: "Purchasing and reserving advertising spaces across traditional and digital media outlets for campaign messaging.",
        description_ar: "شراء وحجز المساحات الإعلانية في وسائل الإعلام التقليدية والرقمية لنشر رسائل الحملات.",
      },
      {
        slug: "marketing_plans",
        name_en: "Marketing Plans",
        name_ar: "الخطط التسويقية",
        description_en: "Comprehensive marketing plans defining objectives, target audience, and suitable promotion channels.",
        description_ar: "تطوير وتنفيذ خطط تسويقية شاملة تحدد الأهداف والجمهور والقنوات المناسبة للترويج.",
      },
      {
        slug: "advertising_campaigns",
        name_en: "Advertising Campaigns",
        name_ar: "الحملات الإعلانية",
        description_en: "Designing and executing integrated advertising campaigns across multiple channels to boost event awareness.",
        description_ar: "تصميم وتنفيذ حملات إعلانية متكاملة عبر قنوات متعددة لتعزيز الوعي بالفعاليات.",
      },
      {
        slug: "delegation_receptions_and_press_conferences",
        name_en: "Delegation Receptions & Press Conferences",
        name_ar: "استقبال الوفود والمؤتمرات الصحفية",
        description_en: "Organizing official delegation receptions and press conferences according to professional protocol standards.",
        description_ar: "تنظيم استقبال الوفود الرسمية وعقد المؤتمرات الصحفية بمعايير البروتوكول الاحترافية.",
      },
      {
        slug: "hosting_services",
        name_en: "Hosting Services",
        name_ar: "الاستضافات",
        description_en: "Organizing VIP and guest hosting, delivering a professional experience befitting event standards.",
        description_ar: "تنظيم استضافات كبار الشخصيات والضيوف وتقديم تجربة احترافية تليق بمستوى الفعاليات.",
      },
    ],
  },
  {
    slug: "advertising_prints_identity_applications",
    name_en: "Advertising (Prints & Identity Applications)",
    name_ar: "المطبوعات وتطبيقات الهوية",
    sort_order: 40,
    children: [
      {
        slug: "banners",
        name_en: "Banners",
        name_ar: "البنرات",
        description_en: "Designing and printing advertising banners of various sizes for indoor and outdoor decoration.",
        description_ar: "تصميم وطباعة بنرات إعلانية بمختلف الأحجام للاستخدام في الديكور الداخلي والخارجي.",
      },
      {
        slug: "stickers",
        name_en: "Stickers",
        name_ar: "الستيكرات",
        description_en: "Producing branded stickers with event identity for use on surfaces, equipment, and souvenirs.",
        description_ar: "إنتاج ملصقات لاصقة بهوية الفعاليات للاستخدام على الأسطح والمعدات والهدايا التذكارية.",
      },
      {
        slug: "product_and_gift_customization_services",
        name_en: "Product & Gift Customization Services",
        name_ar: "خدمات تخصيص المنتجات والهدايا",
        description_en: "Customizing products and souvenirs with event identity to be gifted to guests and participants.",
        description_ar: "تخصيص المنتجات والهدايا التذكارية بهوية الفعاليات لإهدائها للضيوف والمشاركين.",
      },
      {
        slug: "printing_services",
        name_en: "Printing Services",
        name_ar: "خدمات الطباعة",
        description_en: "Digital and traditional printing for all marketing and operational materials of events.",
        description_ar: "تنفيذ أعمال الطباعة الرقمية والتقليدية لجميع المواد التسويقية والتشغيلية للفعاليات.",
      },
      {
        slug: "brand_identity_applications",
        name_en: "Brand Identity Applications",
        name_ar: "تطبيقات الهوية",
        description_en: "Applying visual identity elements across all event materials, surfaces, and structures.",
        description_ar: "تطبيق عناصر الهوية البصرية للفعاليات على جميع المواد والأسطح والمنشآت الخاصة بها.",
      },
      {
        slug: "flags",
        name_en: "Flags",
        name_ar: "الأعلام",
        description_en: "Manufacturing and installing flags of various sizes per event identity for indoor and outdoor use.",
        description_ar: "تصنيع وتركيب الأعلام بمختلف المقاسات وفق هوية الفعاليات للاستخدام داخلياً وخارجياً.",
      },
    ],
  },
  {
    slug: "avl",
    name_en: "AVL",
    name_ar: "الصوتيات والمرئيات والإضاءة",
    sort_order: 50,
    children: [
      {
        slug: "lighting_services",
        name_en: "Lighting Services",
        name_ar: "خدمات الإضاءة",
        description_en: "Technical and stage lighting solutions to highlight content and create appropriate visual atmospheres.",
        description_ar: "توفير حلول الإضاءة التقنية والمسرحية لإبراز المحتوى وخلق أجواء بصرية مناسبة.",
      },
      {
        slug: "video_services",
        name_en: "Video Services",
        name_ar: "خدمات الفيديو",
        description_en: "Professional video services including display screens and playback equipment for visual content presentation.",
        description_ar: "تقديم خدمات الفيديو الاحترافية بما فيها الشاشات العرضية ومعدات التشغيل لعرض المحتوى المرئي.",
      },
      {
        slug: "sound_services",
        name_en: "Sound Services",
        name_ar: "خدمات الصوت",
        description_en: "Comprehensive professional sound systems ensuring high audio quality throughout event venues.",
        description_ar: "توفير أنظمة الصوت الاحترافية الشاملة لضمان جودة صوت عالية في جميع أنحاء مواقع الفعاليات.",
      },
      {
        slug: "audio_visual_equipment_rental",
        name_en: "Audio-Visual Equipment Rental",
        name_ar: "تأجير معدات الصوتيات والمرئيات",
        description_en: "Renting complete audio-visual equipment (speakers, microphones, projectors, LED screens) for event setup.",
        description_ar: "تأجير معدات الصوت والمرئيات الكاملة (مكبرات، ميكروفونات، بروجكتورات، شاشات LED) لتجهيز الفعاليات.",
      },
      {
        slug: "decorative_lighting_and_trusses",
        name_en: "Decorative Lighting & Trusses",
        name_ar: "تجهيزات الإضاءة الزخرفية والتراسات",
        description_en: "Providing and installing decorative lighting setups and trusses to add an aesthetic dimension to event venues.",
        description_ar: "توفير وتركيب تجهيزات الإضاءة الزخرفية والتراسات لإضفاء طابع جمالي على مواقع الفعاليات.",
      },
    ],
  },
  {
    slug: "furniture",
    name_en: "Furniture",
    name_ar: "الأثاث",
    sort_order: 60,
    children: [
      {
        slug: "event_furniture_and_accessories",
        name_en: "Event Furniture & Accessories",
        name_ar: "الأثاث وإكسسوارات الفعاليات",
        description_en: "Event furniture and accessories including seating, tables, and specialized decorative elements.",
        description_ar: "توفير الأثاث وإكسسوارات الفعاليات بما يشمل المقاعد والطاولات وعناصر الديكور المتخصصة.",
      },
      {
        slug: "stands_and_couches",
        name_en: "Stands & Couches",
        name_ar: "المدرجات والكنب",
        description_en: "Renting and installing stands and couches to furnish seating areas and guest lounges at events.",
        description_ar: "تأجير وتركيب المدرجات والكنب لتجهيز مناطق الجلوس وقاعات الضيوف في الفعاليات.",
      },
      {
        slug: "floral_arrangements",
        name_en: "Floral Arrangements",
        name_ar: "الورود",
        description_en: "Natural and artificial floral arrangements to decorate event venues and reception areas.",
        description_ar: "توفير تنسيقات الورود الطبيعية والصناعية لتزيين مواقع الفعاليات ومناطق الاستقبال.",
      },
      {
        slug: "indoor_plants",
        name_en: "Indoor Plants",
        name_ar: "النباتات الداخلية",
        description_en: "Providing and installing various indoor plants to add a natural and aesthetic touch to event atmospheres.",
        description_ar: "توفير وتركيب النباتات الداخلية بأنواعها لإضافة لمسة طبيعية وجمالية على أجواء الفعاليات.",
      },
    ],
  },
  {
    slug: "logistics",
    name_en: "Logistics",
    name_ar: "الخدمات اللوجستية",
    source_name_en: "Logistic",
    sort_order: 70,
    children: [
      {
        slug: "hotel_bookings",
        name_en: "Hotel Bookings",
        name_ar: "الحجوزات الفندقية",
        description_en: "Hotel accommodation bookings for guests, participants, and delegations at appropriate levels for each group.",
        description_ar: "حجز الإقامة الفندقية للضيوف والمشاركين والوفود وفق المستوى المناسب لكل فئة.",
      },
      {
        slug: "transportation_services",
        name_en: "Transportation Services",
        name_ar: "خدمات النقل",
        description_en: "Transporting equipment and materials between warehouses and event venues safely and on schedule.",
        description_ar: "نقل المعدات والمواد بين المخازن ومواقع الفعاليات بأمان وفي الأوقات المحددة.",
      },
      {
        slug: "vehicles",
        name_en: "Vehicles",
        name_ar: "السيارات",
        description_en: "Transportation vehicles for guests and participants during event days.",
        description_ar: "توفير سيارات النقل والتنقل للضيوف والمشاركين خلال أيام الفعاليات.",
      },
      {
        slug: "control_rooms",
        name_en: "Control Rooms",
        name_ar: "غرف التحكم",
        description_en: "Integrated control rooms to manage sound, lighting, and broadcasting operations from a single location.",
        description_ar: "تجهيز غرف تحكم متكاملة لإدارة عمليات الصوت والإضاءة والبث في مكان واحد.",
      },
      {
        slug: "industrial_security_services",
        name_en: "Industrial Security Services",
        name_ar: "خدمات الأمن الصناعي",
        description_en: "Specialized industrial security services to protect sensitive equipment and locations at events.",
        description_ar: "تقديم خدمات الأمن الصناعي المتخصص لحماية المعدات والمواقع الحساسة في الفعاليات.",
      },
      {
        slug: "mass_transportation",
        name_en: "Mass Transportation",
        name_ar: "المواصلات الجماعية",
        description_en: "Mass transportation services to move staff and participants to and from venues.",
        description_ar: "تقديم خدمات المواصلات الجماعية لنقل الموظفين والمشاركين من وإلى المواقع.",
      },
      {
        slug: "parking_management",
        name_en: "Parking Management",
        name_ar: "تنظيم المواقف",
        description_en: "Parking lot management and ensuring traffic safety and vehicle security for guests and participants.",
        description_ar: "تنظيم المواقف وضمان السلامة المرورية وأمن مركبات الضيوف والمشاركين في الفعاليات.",
      },
      {
        slug: "travel_and_transit_bookings",
        name_en: "Travel & Transit Bookings",
        name_ar: "حجوزات السفر والتنقل",
        description_en: "Managing travel and transit bookings (flights, trains, etc.) for guests and delegations attending events.",
        description_ar: "إدارة حجوزات السفر والتنقل (طيران، قطار، إلخ) للضيوف والوفود المشاركة في الفعاليات.",
      },
    ],
  },
  {
    slug: "site_services",
    name_en: "Site Services",
    name_ar: "خدمات الموقع",
    sort_order: 80,
    children: [
      {
        slug: "portable_toilets",
        name_en: "Portable Toilets",
        name_ar: "دورات المياه المتنقلة",
        description_en: "Portable toilet units equipped to hygienic standards to serve event venues.",
        description_ar: "توفير وحدات دورات المياه المتنقلة المجهزة بمعايير النظافة لخدمة المواقع.",
      },
      {
        slug: "generators",
        name_en: "Generators",
        name_ar: "مولدات الكهرباء",
        description_en: "Generators of varying capacities to ensure a stable and reliable power source throughout events.",
        description_ar: "توفير مولدات كهرباء بقدرات مختلفة لتأمين مصدر طاقة مستقر وموثوق طوال الفعاليات.",
      },
      {
        slug: "mobile_offices",
        name_en: "Mobile Offices",
        name_ar: "المكاتب المتنقلة",
        description_en: "Renting equipped mobile offices to serve as administrative and operational centers at event venues.",
        description_ar: "تأجير مكاتب متنقلة مجهزة لاستخدامها كمراكز إدارية وتشغيلية في مواقع الفعاليات.",
      },
      {
        slug: "tents",
        name_en: "Tents",
        name_ar: "الخيام",
        description_en: "Providing and installing tents of various sizes and designs for outdoor events.",
        description_ar: "توفير وتركيب الخيام بمختلف الأحجام والتصاميم لإقامة الفعاليات الخارجية.",
      },
      {
        slug: "barriers",
        name_en: "Barriers",
        name_ar: "الحواجز",
        description_en: "Security and crowd-control barriers to define pathways and protect event zones.",
        description_ar: "توفير الحواجز الأمنية والتنظيمية لتحديد المسارات وحماية مناطق الفعاليات.",
      },
      {
        slug: "bumpers",
        name_en: "Bumpers",
        name_ar: "الفواصل",
        description_en: "Bumpers to divide event areas and organize audience flow safely.",
        description_ar: "تركيب الفواصل لتقسيم مناطق الفعاليات وتنظيم حركة الجمهور بأسلوب آمن.",
      },
      {
        slug: "air_conditioning_works",
        name_en: "Air-Conditioning Works",
        name_ar: "أعمال التكييف",
        description_en: "Air-conditioning works and suitable cooling solutions to ensure attendee comfort at events.",
        description_ar: "تنفيذ أعمال التكييف وتوفير حلول التبريد المناسبة لضمان راحة الحضور في الفعاليات.",
      },
    ],
  },
  {
    slug: "fit_out_works",
    name_en: "Fit-Out Works",
    name_ar: "أعمال التجهيز والتشطيب",
    sort_order: 90,
    children: [
      {
        slug: "carpentry_and_woodworks",
        name_en: "Carpentry & Woodworks",
        name_ar: "أعمال النجارة والأخشاب",
        description_en: "Carpentry and woodwork of all types to set up event decor and structural elements.",
        description_ar: "تنفيذ أعمال النجارة والأعمال الخشبية بمختلف أنواعها لتجهيز ديكورات وعناصر الفعاليات.",
      },
      {
        slug: "painting_works",
        name_en: "Painting Works",
        name_ar: "أعمال الدهانات",
        description_en: "Painting works on surfaces, decorations, and structures used in events.",
        description_ar: "تنفيذ أعمال الدهانات والطلاء على الأسطح والديكورات والهياكل الخاصة بالفعاليات.",
      },
      {
        slug: "gypsum_works",
        name_en: "Gypsum Works",
        name_ar: "أعمال الجبس",
        description_en: "Gypsum works and decorative ceiling and wall formations in event decor.",
        description_ar: "تنفيذ أعمال الجبس والتشكيلات الزخرفية للأسقف والجدران في ديكورات الفعاليات.",
      },
      {
        slug: "light_electrical_works",
        name_en: "Light Electrical Works",
        name_ar: "التمديدات الكهربائية البسيطة",
        description_en: "Light electrical wiring to power lighting and sound equipment at event venues.",
        description_ar: "تنفيذ تمديدات كهربائية بسيطة لتغذية معدات الإضاءة والصوت في مواقع الفعاليات.",
      },
      {
        slug: "light_plumbing_works",
        name_en: "Light Plumbing Works",
        name_ar: "التمديدات الصحية البسيطة",
        description_en: "Light plumbing works to supply water and drainage for units and services at events.",
        description_ar: "تنفيذ تمديدات سباكة بسيطة لتوفير المياه والصرف للوحدات والخدمات في الفعاليات.",
      },
      {
        slug: "carpets",
        name_en: "Carpets",
        name_ar: "السجاد",
        description_en: "Supplying and installing carpets of various types and colors to cover floors and beautify event venues.",
        description_ar: "توريد وتركيب السجاد بمختلف الأنواع والألوان لتغطية الأرضيات وتجميل مواقع الفعاليات.",
      },
      {
        slug: "melamine_installations",
        name_en: "Melamine Installations",
        name_ar: "تركيبات الميلامين",
        description_en: "Installing melamine panels for walls, counters, and decorative elements at events.",
        description_ar: "تركيب ألواح الميلامين لتجهيز الجدران والكاونترات والديكورات الخاصة بالفعاليات.",
      },
    ],
  },
  {
    slug: "construction",
    name_en: "Construction",
    name_ar: "الإنشاءات",
    sort_order: 100,
    children: [
      {
        slug: "civil_construction",
        name_en: "Civil Construction (MEP)",
        name_ar: "الإنشاءات المدنية (الميكانيكا والكهرباء والسباكة)",
        description_en: "Integrated civil construction works including mechanical, electrical, and plumbing (MEP).",
        description_ar: "تنفيذ الأعمال الإنشائية المدنية المتكاملة بما يشمل الميكانيكا والكهرباء والسباكة.",
      },
      {
        slug: "landscaping",
        name_en: "Landscaping",
        name_ar: "تنسيق المواقع والحدائق",
        description_en: "Site landscaping and garden works to add a natural and aesthetic touch to event surroundings.",
        description_ar: "تنفيذ أعمال تنسيق المواقع والحدائق لإضفاء لمسة طبيعية وجمالية على محيط الفعاليات.",
      },
      {
        slug: "facilities_maintenance",
        name_en: "Facilities Maintenance",
        name_ar: "صيانة المرافق",
        description_en: "Periodic maintenance services for facilities and infrastructure to ensure operational readiness.",
        description_ar: "تقديم خدمات الصيانة الدورية للمرافق والبنية التحتية لضمان جاهزيتها التشغيلية.",
      },
      {
        slug: "scaffolding_and_steel_structures",
        name_en: "Scaffolding & Steel Structures",
        name_ar: "السقالات والهياكل الحديدية",
        description_en: "Supplying and installing scaffolding and steel structures for high-level work and temporary constructions.",
        description_ar: "توريد وتركيب السقالات والهياكل الحديدية اللازمة لأعمال الارتفاعات والإنشاءات المؤقتة.",
      },
      {
        slug: "tiling_works",
        name_en: "Tiling Works",
        name_ar: "أعمال التبليط",
        description_en: "Tiling and flooring works with various materials to complete event venue infrastructure.",
        description_ar: "تنفيذ أعمال التبليط والأرضيات بمختلف المواد لإكمال البنية التحتية لمواقع الفعاليات.",
      },
    ],
  },
  {
    slug: "hospitality",
    name_en: "Hospitality",
    name_ar: "الضيافة",
    source_name_en: "Hospatility",
    sort_order: 110,
    children: [
      {
        slug: "food_and_beverages",
        name_en: "Food & Beverages",
        name_ar: "الأطعمة والمشروبات",
        description_en: "Food and beverages of all types (meals, buffets, snacks, hot and cold drinks, coffee).",
        description_ar: "توفير الأطعمة والمشروبات بمختلف أنواعها (وجبات، بوفيهات، سناك، مشروبات ساخنة وباردة، قهوة).",
      },
      {
        slug: "hospitality_consumables",
        name_en: "Hospitality Consumables",
        name_ar: "مستلزمات الضيافة",
        description_en: "Hospitality consumables including cups, plates, serving utensils, and containers for event use.",
        description_ar: "توفير مستلزمات الضيافة من أكواب وأطباق وأدوات تقديم وعبوات للاستخدام خلال الفعاليات.",
      },
      {
        slug: "food_and_beverage_service_equipment",
        name_en: "Food & Beverage Service Equipment",
        name_ar: "تجهيزات تقديم الطعام والشراب",
        description_en: "Food and beverage service equipment (serving gear, warmers, dispensers, coffee machines) to operate hospitality services.",
        description_ar: "توفير تجهيزات تقديم الطعام والشراب (معدات التقديم، سخانات، حافظات، ماكينات قهوة) لتشغيل خدمات الضيافة.",
      },
    ],
  },
  {
    slug: "workforce",
    name_en: "Workforce",
    name_ar: "القوى العاملة",
    sort_order: 120,
    children: [
      {
        slug: "skilled_and_manual_labor",
        name_en: "Skilled & Manual Labor",
        name_ar: "العمالة الحرفية والتنفيذية",
        description_en: "Skilled and manual labor (carpenters, metalworkers, painters, installers, cleaners, electricians, plumbers, flooring workers, drivers, hospitality staff).",
        description_ar: "توفير العمالة الحرفية والتنفيذية (نجارين، حدادين، دهانين، عمال تركيب وفك، نظافة، كهرباء، سباكة، أرضيات، سائقين، ضيافة).",
      },
      {
        slug: "technicians_and_engineers",
        name_en: "Technicians & Engineers",
        name_ar: "الفنيون والمهندسون",
        description_en: "Specialized technicians and engineers in AVL (lighting, sound, screens) and media (live broadcasting, cameras).",
        description_ar: "توفير الفنيين والمهندسين المتخصصين في AVL (إضاءة، صوت، شاشات) والميديا (بث مباشر، كاميرات).",
      },
      {
        slug: "creative_artists",
        name_en: "Creative Artists",
        name_ar: "الفنانون الإبداعيون",
        description_en: "Creative artists (visual artists, sculptors, painters, singers, vocal performers, presenters) to enrich event artistic programs.",
        description_ar: "توفير الفنانين الإبداعيين (تشكيليين، نحاتين، رسامين، مغنين، منشدين، مقدمين) لإثراء البرامج الفنية للفعاليات.",
      },
      {
        slug: "event_management_and_operations_personnel",
        name_en: "Event Management & Operations Personnel",
        name_ar: "كوادر إدارة وتشغيل الفعاليات",
        description_en: "Event management and operations personnel (project managers, site supervisors, accountants, procurement officers, administrative staff).",
        description_ar: "توفير كوادر إدارة وتشغيل الفعاليات (مديري مشاريع، مشرفي مواقع، محاسبين، مسؤولي مشتريات، إداريين).",
      },
      {
        slug: "crowd_management_and_safety_personnel",
        name_en: "Crowd Management & Safety Personnel",
        name_ar: "كوادر إدارة الحشود والسلامة",
        description_en: "Crowd management and safety personnel (security, ushers for crowd control and protocol, paramedics).",
        description_ar: "توفير كوادر إدارة الحشود والسلامة (أمن، منظمين لإدارة الحشود والبروتوكول، مسعفين).",
      },
      {
        slug: "company_staff",
        name_en: "Company Staff",
        name_ar: "موظفو الشركة",
        description_en: "Company's specialized staff to manage events and oversee execution of operational tasks.",
        description_ar: "توفير موظفي الشركة المختصين لإدارة الفعاليات والإشراف على تنفيذ مهام التشغيل.",
      },
    ],
  },
]);

export const LEGACY_CHILD_CATEGORY_MAPPING: Readonly<Record<string, string>> =
  Object.freeze({
    se_stand_design_install: "initial_design_and_manufacturing_services",
    "decor-kosha": "initial_design_and_manufacturing_services",
    cm_certified_event_managers: "project_management",
    "venue-ballroom": "project_setup_requirements",
    "venue-outdoor": "project_setup_requirements",
    "venue-conference": "project_setup_requirements",
    sl_dj: "live_performances",
    ea_folkloric_groups: "live_performances",
    ea_theatrical_performances: "live_performances",
    dj: "live_performances",
    performer: "live_performances",
    pv_photographers: "media_documentation_and_reporting",
    "photo-wedding": "media_documentation_and_reporting",
    "photo-corporate": "media_documentation_and_reporting",
    "photo-drone": "media_documentation_and_reporting",
    pv_film: "tv_programs_and_promotional_videos_production",
    "video-cinematic": "tv_programs_and_promotional_videos_production",
    pv_live_streaming: "live_broadcasting_and_coverage",
    cat_buffet: "food_and_beverages",
    cat_kitchens: "food_and_beverages",
    cat_vip_services: "food_and_beverages",
    "catering-buffet": "food_and_beverages",
    "catering-plated": "food_and_beverages",
    "catering-coffee": "food_and_beverages",
    sl_speakers: "sound_services",
    "av-sound": "sound_services",
    sl_laser: "lighting_services",
    "decor-lighting": "lighting_services",
    sl_led_screens: "video_services",
    "av-staging": "decorative_lighting_and_trusses",
    ts_tents: "tents",
    ts_domes: "tents",
    ep_generators: "generators",
    ts_temporary_hangars: "scaffolding_and_steel_structures",
    fe_chairs: "event_furniture_and_accessories",
    fe_tables: "event_furniture_and_accessories",
    fe_decor: "event_furniture_and_accessories",
    fd_decoration: "event_furniture_and_accessories",
    fd_flower_arrangement: "floral_arrangements",
    fd_bouquets: "floral_arrangements",
    "decor-florals": "floral_arrangements",
    tl_vip_cars: "vehicles",
    tl_loading_trucks: "transportation_services",
    "transport-passenger": "transportation_services",
    mb_hairstylists: "creative_artists",
    mb_bridal_makeup: "creative_artists",
    "staff-hostess": "event_management_and_operations_personnel",
    ep_electrical_panels: "light_electrical_works",
  });

export const LEGACY_PARENT_CATEGORY_MAPPING: Readonly<Record<string, string>> =
  Object.freeze({
    sound_lighting: "avl",
    av: "avl",
    photo_video: "media_production",
    photography: "media_production",
    catering_hospitality: "hospitality",
    catering: "hospitality",
    tents_structures: "site_services",
    electricity_power: "site_services",
    furniture_equipment: "furniture",
    flowers_decor: "furniture",
    decor: "furniture",
    entertainment_arts: "event_management",
    entertainment: "event_management",
    coordination_management: "event_management",
    stands_exhibitions: "event_management",
    venues: "event_management",
    transport_logistics: "logistics",
    transportation: "logistics",
    makeup_beauty: "workforce",
    staffing: "workforce",
  });

export const TAXONOMY_PARENT_SLUGS: ReadonlyArray<string> = TAXONOMY.map(
  (p) => p.slug,
);

export const TAXONOMY_CHILD_SLUGS: ReadonlyArray<string> = TAXONOMY.flatMap(
  (p) => p.children.map((c) => c.slug),
);

export function findTaxonomyItem(
  slug: string,
): { kind: "parent"; parent: TaxonomyParent } | { kind: "child"; parent: TaxonomyParent; child: TaxonomyItem } | null {
  for (const parent of TAXONOMY) {
    if (parent.slug === slug) return { kind: "parent", parent };
    const child = parent.children.find((c) => c.slug === slug);
    if (child) return { kind: "child", parent, child };
  }
  return null;
}

export function taxonomyNameFor(slug: string, locale: "en" | "ar"): string {
  const mappedSlug =
    LEGACY_CHILD_CATEGORY_MAPPING[slug] ??
    LEGACY_PARENT_CATEGORY_MAPPING[slug] ??
    slug;
  const hit = findTaxonomyItem(mappedSlug);
  if (!hit) return slug;
  if (hit.kind === "parent") {
    return locale === "ar" ? hit.parent.name_ar : hit.parent.name_en;
  }
  return locale === "ar" ? hit.child.name_ar : hit.child.name_en;
}

// Pick the correct localized label from a DB `categories` row (parent or
// child). Falls back to `name_en` when `name_ar` is null, and to an empty
// string when the row itself is null/undefined — safe to call in JSX on
// optional joins without a precondition check.
export function categoryName(
  row: { name_en: string; name_ar?: string | null } | null | undefined,
  locale: "en" | "ar",
): string {
  if (!row) return "";
  if (locale === "ar" && row.name_ar) return row.name_ar;
  return row.name_en;
}

// Curated accent palette for supplier profile color picker. Each color has
// been eyeballed for ≥4.5:1 contrast against white text and a neutral-700
// body. Keep the list in sync with the DB `check` constraint at the app
// layer (DB only enforces hex shape, not membership).
export const ACCENT_PALETTE: ReadonlyArray<{ slug: string; hex: string; name_en: string; name_ar: string }> = Object.freeze([
  { slug: "cobalt",   hex: "#4975DD", name_en: "Cobalt",   name_ar: "أزرق كوبالت" },
  { slug: "navy",     hex: "#1A2755", name_en: "Navy",     name_ar: "كحلي" },
  { slug: "teal",     hex: "#0E7C86", name_en: "Teal",     name_ar: "أخضر مزرق" },
  { slug: "indigo",   hex: "#4F46E5", name_en: "Indigo",   name_ar: "نيلي" },
  { slug: "emerald",  hex: "#047857", name_en: "Emerald",  name_ar: "زمردي" },
  { slug: "forest",   hex: "#14532D", name_en: "Forest",   name_ar: "أخضر غابي" },
  { slug: "amber",    hex: "#B45309", name_en: "Amber",    name_ar: "كهرماني" },
  { slug: "gold",     hex: "#C8993A", name_en: "Gold",     name_ar: "ذهبي" },
  { slug: "rose",     hex: "#BE185D", name_en: "Rose",     name_ar: "وردي" },
  { slug: "crimson",  hex: "#B91C1C", name_en: "Crimson",  name_ar: "قرمزي" },
  { slug: "plum",     hex: "#7C3AED", name_en: "Plum",     name_ar: "برقوقي" },
  { slug: "charcoal", hex: "#27272A", name_en: "Charcoal", name_ar: "فحمي" },
]);

export const ACCENT_HEX_VALUES = ACCENT_PALETTE.map((a) => a.hex);
export const DEFAULT_ACCENT_HEX = "#4975DD";
