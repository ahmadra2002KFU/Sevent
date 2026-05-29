-- =============================================================================
-- 20260527120000 — Boss CSV taxonomy migration.
--
-- Migrates all known legacy category rows to the boss-provided 12 parent / 75
-- item taxonomy. Legacy rows are retained inactive with replaced_by_id for
-- audit and public redirect resolution.
-- =============================================================================

set search_path = public;

alter table public.categories
  add column if not exists description_en text,
  add column if not exists description_ar text,
  add column if not exists source_name_en text,
  add column if not exists source_name_ar text,
  add column if not exists taxonomy_version text,
  add column if not exists is_active boolean,
  add column if not exists replaced_by_id uuid;

update public.categories
   set taxonomy_version = coalesce(taxonomy_version, 'legacy'),
       is_active = coalesce(is_active, true),
       source_name_en = coalesce(source_name_en, name_en),
       source_name_ar = coalesce(source_name_ar, name_ar)
 where taxonomy_version is null
    or is_active is null
    or source_name_en is null
    or (source_name_ar is null and name_ar is not null);

alter table public.categories
  alter column taxonomy_version set default 'legacy',
  alter column taxonomy_version set not null,
  alter column is_active set default true,
  alter column is_active set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'categories_replaced_by_id_fkey'
  ) then
    alter table public.categories
      add constraint categories_replaced_by_id_fkey
      foreign key (replaced_by_id) references public.categories (id) on delete restrict;
  end if;
end $$;

create index if not exists categories_active_parent_sort_idx
  on public.categories (is_active, parent_id, sort_order);
create index if not exists categories_replaced_by_idx
  on public.categories (replaced_by_id) where replaced_by_id is not null;
create index if not exists rfqs_category_idx on public.rfqs (category_id);
create index if not exists rfqs_subcategory_idx on public.rfqs (subcategory_id);

create temp table boss_taxonomy_parents (
  slug text primary key,
  name_en text not null,
  name_ar text not null,
  source_name_en text not null,
  source_name_ar text not null,
  sort_order int not null
) on commit drop;

insert into boss_taxonomy_parents (slug, name_en, name_ar, source_name_en, source_name_ar, sort_order)
values
    ('event_management', 'Event Management', 'إدارة الفعاليات', 'Event Management', 'إدارة الفعاليات', 10),
    ('media_production', 'Media Production', 'الإنتاج الإعلامي', 'Media Production', 'الإنتاج الإعلامي', 20),
    ('marketing_pr', 'Marketing & PR', 'التسويق والعلاقات العامة', 'Marketing & PR', 'التسويق والعلاقات العامة', 30),
    ('advertising_prints_identity_applications', 'Advertising (Prints & Identity Applications)', 'المطبوعات وتطبيقات الهوية', 'Advertising (Prints & Identity Applications)', 'المطبوعات وتطبيقات الهوية', 40),
    ('avl', 'AVL', 'الصوتيات والمرئيات والإضاءة', 'AVL', 'الصوتيات والمرئيات والإضاءة', 50),
    ('furniture', 'Furniture', 'الأثاث', 'Furniture', 'الأثاث', 60),
    ('logistics', 'Logistics', 'الخدمات اللوجستية', 'Logistic', 'الخدمات اللوجستية', 70),
    ('site_services', 'Site Services', 'خدمات الموقع', 'Site Services', 'خدمات الموقع', 80),
    ('fit_out_works', 'Fit-Out Works', 'أعمال التجهيز والتشطيب', 'Fit-Out Works', 'أعمال التجهيز والتشطيب', 90),
    ('construction', 'Construction', 'الإنشاءات', 'Construction', 'الإنشاءات', 100),
    ('hospitality', 'Hospitality', 'الضيافة', 'Hospatility', 'الضيافة', 110),
    ('workforce', 'Workforce', 'القوى العاملة', 'Workforce', 'القوى العاملة', 120);

create temp table boss_taxonomy_children (
  parent_slug text not null,
  slug text primary key,
  name_en text not null,
  name_ar text not null,
  source_name_en text not null,
  source_name_ar text not null,
  description_en text not null,
  description_ar text not null,
  sort_order int not null
) on commit drop;

insert into boss_taxonomy_children (
  parent_slug, slug, name_en, name_ar, source_name_en, source_name_ar,
  description_en, description_ar, sort_order
)
values
    ('event_management', 'initial_design_and_manufacturing_services', 'Initial Design & Manufacturing Services', 'خدمات التصميم الأولي والتصنيع', 'Initial Design & Manufacturing Services', 'خدمات التصميم الأولي والتصنيع', 'Creative design services that transform concepts into prototypes and manufacturable elements.', 'تقديم خدمات التصميم الإبداعي وتحويل الأفكار إلى مجسمات وعناصر قابلة للتنفيذ والتصنيع.', 10),
    ('event_management', 'project_management', 'Project Management', 'إدارة المشاريع', 'Project Management', 'إدارة المشاريع', 'Managing project phases from planning through delivery, ensuring objectives are met on time and within budget.', 'إدارة مراحل المشاريع من التخطيط حتى التسليم وضمان تحقيق الأهداف ضمن الوقت والميزانية.', 20),
    ('event_management', 'project_setup_requirements', 'Project Setup Requirements', 'متطلبات تجهيز المشاريع', 'Project Setup Requirements', 'متطلبات تجهيز المشاريع', 'Logistical and operational requirements needed to set up projects before event launch.', 'توفير المتطلبات اللوجستية والتشغيلية اللازمة لتجهيز المشاريع قبل انطلاق الفعاليات.', 30),
    ('event_management', 'operettas', 'Operettas', 'الأوبريتات', 'Operettas', 'الأوبريتات', 'Integrated artistic productions combining music, singing, and acting to deliver event messages.', 'إنتاج عروض فنية متكاملة تجمع بين الموسيقى والغناء والتمثيل لإيصال رسائل الفعاليات.', 40),
    ('event_management', 'creative_content', 'Creative Content', 'محتويات إبداعية', 'Creative Content', 'محتويات إبداعية', 'Developing creative written and visual content that supports event messaging and enhances audience experience.', 'تطوير محتوى إبداعي مكتوب ومرئي يدعم رسائل الفعاليات ويعزز تجربة الجمهور.', 50),
    ('event_management', 'data_analytics', 'Data Analytics', 'تحليل البيانات', 'Data Analytics', 'تحليل البيانات', 'Collecting and analyzing event and audience data to extract insights that support decision-making and performance.', 'جمع وتحليل بيانات الفعاليات والجمهور لاستخلاص رؤى تدعم اتخاذ القرار وتحسين الأداء.', 60),
    ('event_management', 'live_performances', 'Live Performances', 'العروض الحية', 'Live Performances', 'العروض الحية', 'Interactive live performances including music, dance, and showcase segments in front of audiences.', 'تنظيم عروض حية تفاعلية تشمل الموسيقى والرقص والفقرات الاستعراضية أمام الجمهور.', 70),
    ('event_management', 'photo_booths', 'Photo Booths', 'الفوتوبوث', 'Photo Booths', 'الفوتوبوث', 'Interactive photo booths that allow guests to capture customized memorable pictures branded with event identity.', 'توفير كبائن تصوير تفاعلية تتيح للزوار التقاط صور تذكارية مخصصة بهوية الفعاليات.', 80),
    ('media_production', 'production_and_media_services', 'Production & Media Services', 'خدمات الإنتاج والميديا', 'Production & Media Services', 'خدمات الإنتاج والميديا', 'Integrated media production services including filming, editing, and direction for professional content.', 'خدمات إنتاج إعلامي متكاملة تشمل التصوير والمونتاج والإخراج لإنتاج محتوى احترافي.', 10),
    ('media_production', 'audio_production', 'Audio Production', 'الإنتاج الصوتي', 'Audio Production', 'الإنتاج الصوتي', 'Producing and recording high-quality audio content for advertising, broadcasting, and media purposes.', 'إنتاج وتسجيل المحتوى الصوتي بجودة عالية للأغراض الإعلانية والإذاعية والإعلامية.', 20),
    ('media_production', 'technical_equipment_and_studios', 'Technical Equipment & Studios', 'المعدات التقنية والاستوديوهات', 'Technical Equipment & Studios', 'المعدات التقنية والاستوديوهات', 'Advanced technical equipment and fully-equipped studios for professional audio and visual production.', 'توفير معدات تقنية متقدمة واستوديوهات مجهزة لإنتاج محتوى صوتي ومرئي احترافي.', 30),
    ('media_production', 'live_broadcasting_and_coverage', 'Live Broadcasting & Coverage', 'خدمات البث والتغطية المباشرة', 'Live Broadcasting & Coverage', 'خدمات البث والتغطية المباشرة', 'Live broadcasting and real-time media coverage services across various channels and platforms.', 'خدمات البث المباشر والتغطية الإعلامية الفورية للفعاليات عبر مختلف القنوات والمنصات.', 40),
    ('media_production', 'ob_vans_and_live_broadcasting_rental', 'OB Vans & Live Broadcasting Rental', 'تأجير عربات البث الخارجي والبث المباشر', 'OB Vans & Live Broadcasting Rental', 'تأجير عربات البث الخارجي والبث المباشر', 'Renting mobile outside broadcast vans equipped to transmit events live with professional quality.', 'تأجير عربات البث الخارجي المتنقلة المجهزة لنقل الفعاليات مباشرة بجودة احترافية.', 50),
    ('media_production', 'tv_programs_and_promotional_videos_production', 'TV Programs & Promotional Videos Production', 'إنتاج البرامج التلفزيونية والفيديوهات الدعائية', 'TV Programs & Promotional Videos Production', 'إنتاج البرامج التلفزيونية والفيديوهات الدعائية', 'Producing integrated TV programs and promotional videos to professional broadcasting standards.', 'إنتاج برامج تلفزيونية وفيديوهات دعائية وترويجية متكاملة بمعايير البث الاحترافي.', 60),
    ('media_production', 'motion_graphics_editing_and_color_grading', 'Motion Graphics, Editing & Color Grading', 'الموشن جرافيك والمونتاج وتصحيح الألوان', 'Motion Graphics, Editing & Color Grading', 'الموشن جرافيك والمونتاج وتصحيح الألوان', 'Motion graphics, editing, and color grading services for cinematic-quality visual content.', 'خدمات الموشن جرافيك والمونتاج وتصحيح الألوان لإخراج محتوى مرئي بجودة سينمائية.', 70),
    ('media_production', 'media_campaigns_and_broadcast_technology', 'Media Campaigns & Broadcast Technology', 'الحملات الإعلامية وتقنيات البث', 'Media Campaigns & Broadcast Technology', 'الحملات الإعلامية وتقنيات البث', 'Executing integrated media campaigns using the latest broadcasting and distribution technologies to reach wide audiences.', 'تنفيذ حملات إعلامية متكاملة باستخدام أحدث تقنيات البث والتوزيع للوصول لشرائح واسعة.', 80),
    ('media_production', 'motion_graphics_services', 'Motion Graphics Services', 'خدمات الموشن جرافيك', 'Motion Graphics Services', 'خدمات الموشن جرافيك', 'Producing animated graphics and creative visual elements to deliver messages and ideas in an engaging visual format.', 'إنتاج رسوم متحركة وعناصر بصرية إبداعية لإيصال الرسائل والأفكار بشكل مرئي جذاب.', 90),
    ('media_production', 'media_documentation_and_reporting', 'Media Documentation & Reporting', 'التوثيق وإعداد التقارير الإعلامية', 'Media Documentation & Reporting', 'التوثيق وإعداد التقارير الإعلامية', 'Documenting events and preparing media and visual reports for content archiving and sharing.', 'توثيق الفعاليات وإعداد التقارير الإعلامية والمرئية الموثقة لأرشفة المحتوى ومشاركته.', 100),
    ('marketing_pr', 'influencers', 'Influencers', 'المؤثرون', 'Influencers', 'المؤثرون', 'Collaborating with influencers and digital personalities to promote events and reach a wide audience.', 'التعاون مع المؤثرين والشخصيات الرقمية للترويج للفعاليات والوصول إلى جمهور واسع.', 10),
    ('marketing_pr', 'media_buying', 'Media Buying', 'شراء المساحات الإعلانية والإعلامية', 'Media Buying', 'شراء المساحات الإعلانية والإعلامية', 'Purchasing and reserving advertising spaces across traditional and digital media outlets for campaign messaging.', 'شراء وحجز المساحات الإعلانية في وسائل الإعلام التقليدية والرقمية لنشر رسائل الحملات.', 20),
    ('marketing_pr', 'marketing_plans', 'Marketing Plans', 'الخطط التسويقية', 'Marketing Plans', 'الخطط التسويقية', 'Comprehensive marketing plans defining objectives, target audience, and suitable promotion channels.', 'تطوير وتنفيذ خطط تسويقية شاملة تحدد الأهداف والجمهور والقنوات المناسبة للترويج.', 30),
    ('marketing_pr', 'advertising_campaigns', 'Advertising Campaigns', 'الحملات الإعلانية', 'Advertising Campaigns', 'الحملات الإعلانية', 'Designing and executing integrated advertising campaigns across multiple channels to boost event awareness.', 'تصميم وتنفيذ حملات إعلانية متكاملة عبر قنوات متعددة لتعزيز الوعي بالفعاليات.', 40),
    ('marketing_pr', 'delegation_receptions_and_press_conferences', 'Delegation Receptions & Press Conferences', 'استقبال الوفود والمؤتمرات الصحفية', 'Delegation Receptions & Press Conferences', 'استقبال الوفود والمؤتمرات الصحفية', 'Organizing official delegation receptions and press conferences according to professional protocol standards.', 'تنظيم استقبال الوفود الرسمية وعقد المؤتمرات الصحفية بمعايير البروتوكول الاحترافية.', 50),
    ('marketing_pr', 'hosting_services', 'Hosting Services', 'الاستضافات', 'Hosting Services', 'الاستضافات', 'Organizing VIP and guest hosting, delivering a professional experience befitting event standards.', 'تنظيم استضافات كبار الشخصيات والضيوف وتقديم تجربة احترافية تليق بمستوى الفعاليات.', 60),
    ('advertising_prints_identity_applications', 'banners', 'Banners', 'البنرات', 'Banners', 'البنرات', 'Designing and printing advertising banners of various sizes for indoor and outdoor decoration.', 'تصميم وطباعة بنرات إعلانية بمختلف الأحجام للاستخدام في الديكور الداخلي والخارجي.', 10),
    ('advertising_prints_identity_applications', 'stickers', 'Stickers', 'الستيكرات', 'Stickers', 'الستيكرات', 'Producing branded stickers with event identity for use on surfaces, equipment, and souvenirs.', 'إنتاج ملصقات لاصقة بهوية الفعاليات للاستخدام على الأسطح والمعدات والهدايا التذكارية.', 20),
    ('advertising_prints_identity_applications', 'product_and_gift_customization_services', 'Product & Gift Customization Services', 'خدمات تخصيص المنتجات والهدايا', 'Product & Gift Customization Services', 'خدمات تخصيص المنتجات والهدايا', 'Customizing products and souvenirs with event identity to be gifted to guests and participants.', 'تخصيص المنتجات والهدايا التذكارية بهوية الفعاليات لإهدائها للضيوف والمشاركين.', 30),
    ('advertising_prints_identity_applications', 'printing_services', 'Printing Services', 'خدمات الطباعة', 'Printing Services', 'خدمات الطباعة', 'Digital and traditional printing for all marketing and operational materials of events.', 'تنفيذ أعمال الطباعة الرقمية والتقليدية لجميع المواد التسويقية والتشغيلية للفعاليات.', 40),
    ('advertising_prints_identity_applications', 'brand_identity_applications', 'Brand Identity Applications', 'تطبيقات الهوية', 'Brand Identity Applications', 'تطبيقات الهوية', 'Applying visual identity elements across all event materials, surfaces, and structures.', 'تطبيق عناصر الهوية البصرية للفعاليات على جميع المواد والأسطح والمنشآت الخاصة بها.', 50),
    ('advertising_prints_identity_applications', 'flags', 'Flags', 'الأعلام', 'Flags', 'الأعلام', 'Manufacturing and installing flags of various sizes per event identity for indoor and outdoor use.', 'تصنيع وتركيب الأعلام بمختلف المقاسات وفق هوية الفعاليات للاستخدام داخلياً وخارجياً.', 60),
    ('avl', 'lighting_services', 'Lighting Services', 'خدمات الإضاءة', 'Lighting Services', 'خدمات الإضاءة', 'Technical and stage lighting solutions to highlight content and create appropriate visual atmospheres.', 'توفير حلول الإضاءة التقنية والمسرحية لإبراز المحتوى وخلق أجواء بصرية مناسبة.', 10),
    ('avl', 'video_services', 'Video Services', 'خدمات الفيديو', 'Video Services', 'خدمات الفيديو', 'Professional video services including display screens and playback equipment for visual content presentation.', 'تقديم خدمات الفيديو الاحترافية بما فيها الشاشات العرضية ومعدات التشغيل لعرض المحتوى المرئي.', 20),
    ('avl', 'sound_services', 'Sound Services', 'خدمات الصوت', 'Sound Services', 'خدمات الصوت', 'Comprehensive professional sound systems ensuring high audio quality throughout event venues.', 'توفير أنظمة الصوت الاحترافية الشاملة لضمان جودة صوت عالية في جميع أنحاء مواقع الفعاليات.', 30),
    ('avl', 'audio_visual_equipment_rental', 'Audio-Visual Equipment Rental', 'تأجير معدات الصوتيات والمرئيات', 'Audio-Visual Equipment Rental', 'تأجير معدات الصوتيات والمرئيات', 'Renting complete audio-visual equipment (speakers, microphones, projectors, LED screens) for event setup.', 'تأجير معدات الصوت والمرئيات الكاملة (مكبرات، ميكروفونات، بروجكتورات، شاشات LED) لتجهيز الفعاليات.', 40),
    ('avl', 'decorative_lighting_and_trusses', 'Decorative Lighting & Trusses', 'تجهيزات الإضاءة الزخرفية والتراسات', 'Decorative Lighting & Trusses', 'تجهيزات الإضاءة الزخرفية والتراسات', 'Providing and installing decorative lighting setups and trusses to add an aesthetic dimension to event venues.', 'توفير وتركيب تجهيزات الإضاءة الزخرفية والتراسات لإضفاء طابع جمالي على مواقع الفعاليات.', 50),
    ('furniture', 'event_furniture_and_accessories', 'Event Furniture & Accessories', 'الأثاث وإكسسوارات الفعاليات', 'Event Furniture & Accessories', 'الأثاث وإكسسوارات الفعاليات', 'Event furniture and accessories including seating, tables, and specialized decorative elements.', 'توفير الأثاث وإكسسوارات الفعاليات بما يشمل المقاعد والطاولات وعناصر الديكور المتخصصة.', 10),
    ('furniture', 'stands_and_couches', 'Stands & Couches', 'المدرجات والكنب', 'Stands & Couches', 'المدرجات والكنب', 'Renting and installing stands and couches to furnish seating areas and guest lounges at events.', 'تأجير وتركيب المدرجات والكنب لتجهيز مناطق الجلوس وقاعات الضيوف في الفعاليات.', 20),
    ('furniture', 'floral_arrangements', 'Floral Arrangements', 'الورود', 'Floral Arrangements', 'الورود', 'Natural and artificial floral arrangements to decorate event venues and reception areas.', 'توفير تنسيقات الورود الطبيعية والصناعية لتزيين مواقع الفعاليات ومناطق الاستقبال.', 30),
    ('furniture', 'indoor_plants', 'Indoor Plants', 'النباتات الداخلية', 'Indoor Plants', 'النباتات الداخلية', 'Providing and installing various indoor plants to add a natural and aesthetic touch to event atmospheres.', 'توفير وتركيب النباتات الداخلية بأنواعها لإضافة لمسة طبيعية وجمالية على أجواء الفعاليات.', 40),
    ('logistics', 'hotel_bookings', 'Hotel Bookings', 'الحجوزات الفندقية', 'Hotel Bookings', 'الحجوزات الفندقية', 'Hotel accommodation bookings for guests, participants, and delegations at appropriate levels for each group.', 'حجز الإقامة الفندقية للضيوف والمشاركين والوفود وفق المستوى المناسب لكل فئة.', 10),
    ('logistics', 'transportation_services', 'Transportation Services', 'خدمات النقل', 'Transportation Services', 'خدمات النقل', 'Transporting equipment and materials between warehouses and event venues safely and on schedule.', 'نقل المعدات والمواد بين المخازن ومواقع الفعاليات بأمان وفي الأوقات المحددة.', 20),
    ('logistics', 'vehicles', 'Vehicles', 'السيارات', 'Vehicles', 'السيارات', 'Transportation vehicles for guests and participants during event days.', 'توفير سيارات النقل والتنقل للضيوف والمشاركين خلال أيام الفعاليات.', 30),
    ('logistics', 'control_rooms', 'Control Rooms', 'غرف التحكم', 'Control Rooms', 'غرف التحكم', 'Integrated control rooms to manage sound, lighting, and broadcasting operations from a single location.', 'تجهيز غرف تحكم متكاملة لإدارة عمليات الصوت والإضاءة والبث في مكان واحد.', 40),
    ('logistics', 'industrial_security_services', 'Industrial Security Services', 'خدمات الأمن الصناعي', 'Industrial Security Services', 'خدمات الأمن الصناعي', 'Specialized industrial security services to protect sensitive equipment and locations at events.', 'تقديم خدمات الأمن الصناعي المتخصص لحماية المعدات والمواقع الحساسة في الفعاليات.', 50),
    ('logistics', 'mass_transportation', 'Mass Transportation', 'المواصلات الجماعية', 'Mass Transportation', 'المواصلات الجماعية', 'Mass transportation services to move staff and participants to and from venues.', 'تقديم خدمات المواصلات الجماعية لنقل الموظفين والمشاركين من وإلى المواقع.', 60),
    ('logistics', 'parking_management', 'Parking Management', 'تنظيم المواقف', 'Parking Management', 'تنظيم المواقف', 'Parking lot management and ensuring traffic safety and vehicle security for guests and participants.', 'تنظيم المواقف وضمان السلامة المرورية وأمن مركبات الضيوف والمشاركين في الفعاليات.', 70),
    ('logistics', 'travel_and_transit_bookings', 'Travel & Transit Bookings', 'حجوزات السفر والتنقل', 'Travel & Transit Bookings', 'حجوزات السفر والتنقل', 'Managing travel and transit bookings (flights, trains, etc.) for guests and delegations attending events.', 'إدارة حجوزات السفر والتنقل (طيران، قطار، إلخ) للضيوف والوفود المشاركة في الفعاليات.', 80),
    ('site_services', 'portable_toilets', 'Portable Toilets', 'دورات المياه المتنقلة', 'Portable Toilets', 'دورات المياه المتنقلة', 'Portable toilet units equipped to hygienic standards to serve event venues.', 'توفير وحدات دورات المياه المتنقلة المجهزة بمعايير النظافة لخدمة المواقع.', 10),
    ('site_services', 'generators', 'Generators', 'مولدات الكهرباء', 'Generators', 'مولدات الكهرباء', 'Generators of varying capacities to ensure a stable and reliable power source throughout events.', 'توفير مولدات كهرباء بقدرات مختلفة لتأمين مصدر طاقة مستقر وموثوق طوال الفعاليات.', 20),
    ('site_services', 'mobile_offices', 'Mobile Offices', 'المكاتب المتنقلة', 'Mobile Offices', 'المكاتب المتنقلة', 'Renting equipped mobile offices to serve as administrative and operational centers at event venues.', 'تأجير مكاتب متنقلة مجهزة لاستخدامها كمراكز إدارية وتشغيلية في مواقع الفعاليات.', 30),
    ('site_services', 'tents', 'Tents', 'الخيام', 'Tents', 'الخيام', 'Providing and installing tents of various sizes and designs for outdoor events.', 'توفير وتركيب الخيام بمختلف الأحجام والتصاميم لإقامة الفعاليات الخارجية.', 40),
    ('site_services', 'barriers', 'Barriers', 'الحواجز', 'Barriers', 'الحواجز', 'Security and crowd-control barriers to define pathways and protect event zones.', 'توفير الحواجز الأمنية والتنظيمية لتحديد المسارات وحماية مناطق الفعاليات.', 50),
    ('site_services', 'bumpers', 'Bumpers', 'الفواصل', 'Bumpers', 'الفواصل', 'Bumpers to divide event areas and organize audience flow safely.', 'تركيب الفواصل لتقسيم مناطق الفعاليات وتنظيم حركة الجمهور بأسلوب آمن.', 60),
    ('site_services', 'air_conditioning_works', 'Air-Conditioning Works', 'أعمال التكييف', 'Air-Conditioning Works', 'أعمال التكييف', 'Air-conditioning works and suitable cooling solutions to ensure attendee comfort at events.', 'تنفيذ أعمال التكييف وتوفير حلول التبريد المناسبة لضمان راحة الحضور في الفعاليات.', 70),
    ('fit_out_works', 'carpentry_and_woodworks', 'Carpentry & Woodworks', 'أعمال النجارة والأخشاب', 'Carpentry & Woodworks', 'أعمال النجارة والأخشاب', 'Carpentry and woodwork of all types to set up event decor and structural elements.', 'تنفيذ أعمال النجارة والأعمال الخشبية بمختلف أنواعها لتجهيز ديكورات وعناصر الفعاليات.', 10),
    ('fit_out_works', 'painting_works', 'Painting Works', 'أعمال الدهانات', 'Painting Works', 'أعمال الدهانات', 'Painting works on surfaces, decorations, and structures used in events.', 'تنفيذ أعمال الدهانات والطلاء على الأسطح والديكورات والهياكل الخاصة بالفعاليات.', 20),
    ('fit_out_works', 'gypsum_works', 'Gypsum Works', 'أعمال الجبس', 'Gypsum Works', 'أعمال الجبس', 'Gypsum works and decorative ceiling and wall formations in event decor.', 'تنفيذ أعمال الجبس والتشكيلات الزخرفية للأسقف والجدران في ديكورات الفعاليات.', 30),
    ('fit_out_works', 'light_electrical_works', 'Light Electrical Works', 'التمديدات الكهربائية البسيطة', 'Light Electrical Works', 'التمديدات الكهربائية البسيطة', 'Light electrical wiring to power lighting and sound equipment at event venues.', 'تنفيذ تمديدات كهربائية بسيطة لتغذية معدات الإضاءة والصوت في مواقع الفعاليات.', 40),
    ('fit_out_works', 'light_plumbing_works', 'Light Plumbing Works', 'التمديدات الصحية البسيطة', 'Light Plumbing Works', 'التمديدات الصحية البسيطة', 'Light plumbing works to supply water and drainage for units and services at events.', 'تنفيذ تمديدات سباكة بسيطة لتوفير المياه والصرف للوحدات والخدمات في الفعاليات.', 50),
    ('fit_out_works', 'carpets', 'Carpets', 'السجاد', 'Carpets', 'السجاد', 'Supplying and installing carpets of various types and colors to cover floors and beautify event venues.', 'توريد وتركيب السجاد بمختلف الأنواع والألوان لتغطية الأرضيات وتجميل مواقع الفعاليات.', 60),
    ('fit_out_works', 'melamine_installations', 'Melamine Installations', 'تركيبات الميلامين', 'Melamine Installations', 'تركيبات الميلامين', 'Installing melamine panels for walls, counters, and decorative elements at events.', 'تركيب ألواح الميلامين لتجهيز الجدران والكاونترات والديكورات الخاصة بالفعاليات.', 70),
    ('construction', 'civil_construction', 'Civil Construction (MEP)', 'الإنشاءات المدنية (الميكانيكا والكهرباء والسباكة)', 'Civil Construction (MEP)', 'الإنشاءات المدنية (الميكانيكا والكهرباء والسباكة)', 'Integrated civil construction works including mechanical, electrical, and plumbing (MEP).', 'تنفيذ الأعمال الإنشائية المدنية المتكاملة بما يشمل الميكانيكا والكهرباء والسباكة.', 10),
    ('construction', 'landscaping', 'Landscaping', 'تنسيق المواقع والحدائق', 'Landscaping', 'تنسيق المواقع والحدائق', 'Site landscaping and garden works to add a natural and aesthetic touch to event surroundings.', 'تنفيذ أعمال تنسيق المواقع والحدائق لإضفاء لمسة طبيعية وجمالية على محيط الفعاليات.', 20),
    ('construction', 'facilities_maintenance', 'Facilities Maintenance', 'صيانة المرافق', 'Facilities Maintenance', 'صيانة المرافق', 'Periodic maintenance services for facilities and infrastructure to ensure operational readiness.', 'تقديم خدمات الصيانة الدورية للمرافق والبنية التحتية لضمان جاهزيتها التشغيلية.', 30),
    ('construction', 'scaffolding_and_steel_structures', 'Scaffolding & Steel Structures', 'السقالات والهياكل الحديدية', 'Scaffolding & Steel Structures', 'السقالات والهياكل الحديدية', 'Supplying and installing scaffolding and steel structures for high-level work and temporary constructions.', 'توريد وتركيب السقالات والهياكل الحديدية اللازمة لأعمال الارتفاعات والإنشاءات المؤقتة.', 40),
    ('construction', 'tiling_works', 'Tiling Works', 'أعمال التبليط', 'Tiling Works', 'أعمال التبليط', 'Tiling and flooring works with various materials to complete event venue infrastructure.', 'تنفيذ أعمال التبليط والأرضيات بمختلف المواد لإكمال البنية التحتية لمواقع الفعاليات.', 50),
    ('hospitality', 'food_and_beverages', 'Food & Beverages', 'الأطعمة والمشروبات', 'Food & Beverages', 'الأطعمة والمشروبات', 'Food and beverages of all types (meals, buffets, snacks, hot and cold drinks, coffee).', 'توفير الأطعمة والمشروبات بمختلف أنواعها (وجبات، بوفيهات، سناك، مشروبات ساخنة وباردة، قهوة).', 10),
    ('hospitality', 'hospitality_consumables', 'Hospitality Consumables', 'مستلزمات الضيافة', 'Hospitality Consumables', 'مستلزمات الضيافة', 'Hospitality consumables including cups, plates, serving utensils, and containers for event use.', 'توفير مستلزمات الضيافة من أكواب وأطباق وأدوات تقديم وعبوات للاستخدام خلال الفعاليات.', 20),
    ('hospitality', 'food_and_beverage_service_equipment', 'Food & Beverage Service Equipment', 'تجهيزات تقديم الطعام والشراب', 'Food & Beverage Service Equipment', 'تجهيزات تقديم الطعام والشراب', 'Food and beverage service equipment (serving gear, warmers, dispensers, coffee machines) to operate hospitality services.', 'توفير تجهيزات تقديم الطعام والشراب (معدات التقديم، سخانات، حافظات، ماكينات قهوة) لتشغيل خدمات الضيافة.', 30),
    ('workforce', 'skilled_and_manual_labor', 'Skilled & Manual Labor', 'العمالة الحرفية والتنفيذية', 'Skilled & Manual Labor', 'العمالة الحرفية والتنفيذية', 'Skilled and manual labor (carpenters, metalworkers, painters, installers, cleaners, electricians, plumbers, flooring workers, drivers, hospitality staff).', 'توفير العمالة الحرفية والتنفيذية (نجارين، حدادين، دهانين، عمال تركيب وفك، نظافة، كهرباء، سباكة، أرضيات، سائقين، ضيافة).', 10),
    ('workforce', 'technicians_and_engineers', 'Technicians & Engineers', 'الفنيون والمهندسون', 'Technicians & Engineers', 'الفنيون والمهندسون', 'Specialized technicians and engineers in AVL (lighting, sound, screens) and media (live broadcasting, cameras).', 'توفير الفنيين والمهندسين المتخصصين في AVL (إضاءة، صوت، شاشات) والميديا (بث مباشر، كاميرات).', 20),
    ('workforce', 'creative_artists', 'Creative Artists', 'الفنانون الإبداعيون', 'Creative Artists', 'الفنانون الإبداعيون', 'Creative artists (visual artists, sculptors, painters, singers, vocal performers, presenters) to enrich event artistic programs.', 'توفير الفنانين الإبداعيين (تشكيليين، نحاتين، رسامين، مغنين، منشدين، مقدمين) لإثراء البرامج الفنية للفعاليات.', 30),
    ('workforce', 'event_management_and_operations_personnel', 'Event Management & Operations Personnel', 'كوادر إدارة وتشغيل الفعاليات', 'Event Management & Operations Personnel', 'كوادر إدارة وتشغيل الفعاليات', 'Event management and operations personnel (project managers, site supervisors, accountants, procurement officers, administrative staff).', 'توفير كوادر إدارة وتشغيل الفعاليات (مديري مشاريع، مشرفي مواقع، محاسبين، مسؤولي مشتريات، إداريين).', 40),
    ('workforce', 'crowd_management_and_safety_personnel', 'Crowd Management & Safety Personnel', 'كوادر إدارة الحشود والسلامة', 'Crowd Management & Safety Personnel', 'كوادر إدارة الحشود والسلامة', 'Crowd management and safety personnel (security, ushers for crowd control and protocol, paramedics).', 'توفير كوادر إدارة الحشود والسلامة (أمن، منظمين لإدارة الحشود والبروتوكول، مسعفين).', 50),
    ('workforce', 'company_staff', 'Company Staff', 'موظفو الشركة', 'Company Staff', 'موظفو الشركة', 'Company''s specialized staff to manage events and oversee execution of operational tasks.', 'توفير موظفي الشركة المختصين لإدارة الفعاليات والإشراف على تنفيذ مهام التشغيل.', 60);

create temp table legacy_child_category_map (
  old_slug text primary key,
  new_slug text not null references boss_taxonomy_children (slug)
) on commit drop;

insert into legacy_child_category_map (old_slug, new_slug)
values
    ('se_stand_design_install', 'initial_design_and_manufacturing_services'),
    ('decor-kosha', 'initial_design_and_manufacturing_services'),
    ('cm_certified_event_managers', 'project_management'),
    ('venue-ballroom', 'project_setup_requirements'),
    ('venue-outdoor', 'project_setup_requirements'),
    ('venue-conference', 'project_setup_requirements'),
    ('sl_dj', 'live_performances'),
    ('ea_folkloric_groups', 'live_performances'),
    ('ea_theatrical_performances', 'live_performances'),
    ('dj', 'live_performances'),
    ('performer', 'live_performances'),
    ('pv_photographers', 'media_documentation_and_reporting'),
    ('photo-wedding', 'media_documentation_and_reporting'),
    ('photo-corporate', 'media_documentation_and_reporting'),
    ('photo-drone', 'media_documentation_and_reporting'),
    ('pv_film', 'tv_programs_and_promotional_videos_production'),
    ('video-cinematic', 'tv_programs_and_promotional_videos_production'),
    ('pv_live_streaming', 'live_broadcasting_and_coverage'),
    ('cat_buffet', 'food_and_beverages'),
    ('cat_kitchens', 'food_and_beverages'),
    ('cat_vip_services', 'food_and_beverages'),
    ('catering-buffet', 'food_and_beverages'),
    ('catering-plated', 'food_and_beverages'),
    ('catering-coffee', 'food_and_beverages'),
    ('sl_speakers', 'sound_services'),
    ('av-sound', 'sound_services'),
    ('sl_laser', 'lighting_services'),
    ('decor-lighting', 'lighting_services'),
    ('sl_led_screens', 'video_services'),
    ('av-staging', 'decorative_lighting_and_trusses'),
    ('ts_tents', 'tents'),
    ('ts_domes', 'tents'),
    ('ep_generators', 'generators'),
    ('ts_temporary_hangars', 'scaffolding_and_steel_structures'),
    ('fe_chairs', 'event_furniture_and_accessories'),
    ('fe_tables', 'event_furniture_and_accessories'),
    ('fe_decor', 'event_furniture_and_accessories'),
    ('fd_decoration', 'event_furniture_and_accessories'),
    ('fd_flower_arrangement', 'floral_arrangements'),
    ('fd_bouquets', 'floral_arrangements'),
    ('decor-florals', 'floral_arrangements'),
    ('tl_vip_cars', 'vehicles'),
    ('tl_loading_trucks', 'transportation_services'),
    ('transport-passenger', 'transportation_services'),
    ('mb_hairstylists', 'creative_artists'),
    ('mb_bridal_makeup', 'creative_artists'),
    ('staff-hostess', 'event_management_and_operations_personnel'),
    ('ep_electrical_panels', 'light_electrical_works');

create temp table legacy_parent_category_map (
  old_slug text primary key,
  new_slug text not null references boss_taxonomy_parents (slug)
) on commit drop;

insert into legacy_parent_category_map (old_slug, new_slug)
values
    ('sound_lighting', 'avl'),
    ('av', 'avl'),
    ('photo_video', 'media_production'),
    ('photography', 'media_production'),
    ('catering_hospitality', 'hospitality'),
    ('catering', 'hospitality'),
    ('tents_structures', 'site_services'),
    ('electricity_power', 'site_services'),
    ('furniture_equipment', 'furniture'),
    ('flowers_decor', 'furniture'),
    ('decor', 'furniture'),
    ('entertainment_arts', 'event_management'),
    ('entertainment', 'event_management'),
    ('coordination_management', 'event_management'),
    ('stands_exhibitions', 'event_management'),
    ('venues', 'event_management'),
    ('transport_logistics', 'logistics'),
    ('transportation', 'logistics'),
    ('makeup_beauty', 'workforce'),
    ('staffing', 'workforce');

insert into public.categories (
  parent_id, slug, name_en, name_ar, sort_order, description_en, description_ar,
  source_name_en, source_name_ar, taxonomy_version, is_active, replaced_by_id
)
select
  null,
  p.slug,
  p.name_en,
  p.name_ar,
  p.sort_order,
  null,
  null,
  p.source_name_en,
  p.source_name_ar,
  'boss_csv_2026_05',
  true,
  null
from boss_taxonomy_parents p
on conflict (slug) do update set
  parent_id = null,
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  sort_order = excluded.sort_order,
  description_en = excluded.description_en,
  description_ar = excluded.description_ar,
  source_name_en = excluded.source_name_en,
  source_name_ar = excluded.source_name_ar,
  taxonomy_version = excluded.taxonomy_version,
  is_active = true,
  replaced_by_id = null;

insert into public.categories (
  parent_id, slug, name_en, name_ar, sort_order, description_en, description_ar,
  source_name_en, source_name_ar, taxonomy_version, is_active, replaced_by_id
)
select
  p.id,
  c.slug,
  c.name_en,
  c.name_ar,
  c.sort_order,
  c.description_en,
  c.description_ar,
  c.source_name_en,
  c.source_name_ar,
  'boss_csv_2026_05',
  true,
  null
from boss_taxonomy_children c
join public.categories p on p.slug = c.parent_slug
on conflict (slug) do update set
  parent_id = excluded.parent_id,
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  sort_order = excluded.sort_order,
  description_en = excluded.description_en,
  description_ar = excluded.description_ar,
  source_name_en = excluded.source_name_en,
  source_name_ar = excluded.source_name_ar,
  taxonomy_version = excluded.taxonomy_version,
  is_active = true,
  replaced_by_id = null;

-- Preflight: referenced legacy rows must be explicitly mapped before any
-- references are moved. Unreferenced legacy rows can be retired without a map.
do $$
declare
  missing text;
begin
  with referenced as (
    select c.slug, c.parent_id is null as is_parent
      from public.categories c
      left join public.supplier_categories sc on sc.subcategory_id = c.id
      left join public.packages p on p.subcategory_id = c.id
      left join public.rfqs r_sub on r_sub.subcategory_id = c.id
      left join public.rfqs r_parent on r_parent.category_id = c.id
     where c.taxonomy_version <> 'boss_csv_2026_05'
     group by c.id, c.slug, c.parent_id
    having count(sc.*) + count(p.*) + count(r_sub.*) + count(r_parent.*) > 0
  )
  select string_agg(r.slug, ', ' order by r.slug)
    into missing
    from referenced r
   where (r.is_parent and not exists (
           select 1 from legacy_parent_category_map m where m.old_slug = r.slug
         ))
      or (not r.is_parent and not exists (
           select 1 from legacy_child_category_map m where m.old_slug = r.slug
         ));

  if missing is not null then
    raise exception 'unmapped_referenced_legacy_categories:%', missing;
  end if;
end $$;

-- Many-to-one safe supplier category backfill: insert target rows first, then
-- delete source rows so (supplier_id, subcategory_id) never collides.
with mapped as (
  select old_c.id as old_id, new_c.id as new_id
    from legacy_child_category_map m
    join public.categories old_c on old_c.slug = m.old_slug
    join public.categories new_c on new_c.slug = m.new_slug
)
insert into public.supplier_categories (supplier_id, subcategory_id)
select distinct sc.supplier_id, mapped.new_id
  from public.supplier_categories sc
  join mapped on mapped.old_id = sc.subcategory_id
on conflict (supplier_id, subcategory_id) do nothing;

with mapped as (
  select old_c.id as old_id
    from legacy_child_category_map m
    join public.categories old_c on old_c.slug = m.old_slug
)
delete from public.supplier_categories sc
 using mapped
 where sc.subcategory_id = mapped.old_id;

with mapped as (
  select old_c.id as old_id, new_c.id as new_id
    from legacy_child_category_map m
    join public.categories old_c on old_c.slug = m.old_slug
    join public.categories new_c on new_c.slug = m.new_slug
)
update public.packages p
   set subcategory_id = mapped.new_id
  from mapped
 where p.subcategory_id = mapped.old_id;

with mapped as (
  select old_c.id as old_id, new_c.id as new_child_id, new_c.parent_id as new_parent_id
    from legacy_child_category_map m
    join public.categories old_c on old_c.slug = m.old_slug
    join public.categories new_c on new_c.slug = m.new_slug
)
update public.rfqs r
   set subcategory_id = mapped.new_child_id,
       category_id = mapped.new_parent_id
  from mapped
 where r.subcategory_id = mapped.old_id;

with mapped as (
  select old_c.id as old_id, new_c.id as new_id
    from legacy_parent_category_map m
    join public.categories old_c on old_c.slug = m.old_slug
    join public.categories new_c on new_c.slug = m.new_slug
)
update public.rfqs r
   set category_id = mapped.new_id
  from mapped
 where r.category_id = mapped.old_id;

with mapped as (
  select old_c.id as old_id, new_c.id as new_id
    from legacy_child_category_map m
    join public.categories old_c on old_c.slug = m.old_slug
    join public.categories new_c on new_c.slug = m.new_slug
)
update public.categories c
   set is_active = false,
       replaced_by_id = mapped.new_id,
       taxonomy_version = coalesce(nullif(c.taxonomy_version, ''), 'legacy')
  from mapped
 where c.id = mapped.old_id;

with mapped as (
  select old_c.id as old_id, new_c.id as new_id
    from legacy_parent_category_map m
    join public.categories old_c on old_c.slug = m.old_slug
    join public.categories new_c on new_c.slug = m.new_slug
)
update public.categories c
   set is_active = false,
       replaced_by_id = mapped.new_id,
       taxonomy_version = coalesce(nullif(c.taxonomy_version, ''), 'legacy')
  from mapped
 where c.id = mapped.old_id;

update public.categories
   set is_active = false,
       taxonomy_version = coalesce(nullif(taxonomy_version, ''), 'legacy')
 where taxonomy_version <> 'boss_csv_2026_05'
   and replaced_by_id is null;

-- Assertions before guards are installed.
do $$
declare
  bad_count int;
begin
  select count(*) into bad_count
    from public.supplier_categories sc
    join public.categories c on c.id = sc.subcategory_id
   where not c.is_active or c.parent_id is null;
  if bad_count > 0 then
    raise exception 'supplier_categories_not_backfilled:%', bad_count;
  end if;

  select count(*) into bad_count
    from public.packages p
    join public.categories c on c.id = p.subcategory_id
   where not c.is_active or c.parent_id is null;
  if bad_count > 0 then
    raise exception 'packages_not_backfilled:%', bad_count;
  end if;

  select count(*) into bad_count
    from public.rfqs r
    join public.categories child on child.id = r.subcategory_id
    join public.categories parent on parent.id = r.category_id
   where not child.is_active
      or child.parent_id is null
      or not parent.is_active
      or parent.parent_id is not null
      or child.parent_id <> parent.id;
  if bad_count > 0 then
    raise exception 'rfqs_not_backfilled:%', bad_count;
  end if;
end $$;

create or replace function public.guard_categories_two_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_parent uuid;
begin
  if new.parent_id is not null and new.parent_id = new.id then
    raise exception 'category_parent_self_reference' using errcode = '23514';
  end if;

  if new.parent_id is not null then
    select parent_id into v_parent_parent
      from public.categories
     where id = new.parent_id;
    if not found then
      raise exception 'category_parent_missing' using errcode = '23503';
    end if;
    if v_parent_parent is not null then
      raise exception 'category_depth_exceeds_two' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.parent_id is null and new.parent_id is not null then
    if exists (select 1 from public.categories c where c.parent_id = old.id) then
      raise exception 'category_parent_with_children_cannot_be_demoted' using errcode = '23514';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists guard_categories_two_level on public.categories;
create trigger guard_categories_two_level
  before insert or update of parent_id on public.categories
  for each row execute function public.guard_categories_two_level();

create or replace function public.guard_active_leaf_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_id uuid;
  v_is_active boolean;
  v_parent_active boolean;
begin
  select c.parent_id, c.is_active, p.is_active
    into v_parent_id, v_is_active, v_parent_active
    from public.categories c
    left join public.categories p on p.id = c.parent_id
   where c.id = new.subcategory_id;

  if not found then
    raise exception 'category_not_found:%', new.subcategory_id using errcode = '23503';
  end if;
  if v_parent_id is null then
    raise exception 'category_must_be_leaf:%', new.subcategory_id using errcode = '23514';
  end if;
  if not v_is_active then
    raise exception 'category_must_be_active:%', new.subcategory_id using errcode = '23514';
  end if;
  if not coalesce(v_parent_active, false) then
    raise exception 'category_parent_must_be_active:%', new.subcategory_id using errcode = '23514';
  end if;

  return new;
end
$$;

drop trigger if exists guard_supplier_categories_leaf on public.supplier_categories;
create trigger guard_supplier_categories_leaf
  before insert or update of subcategory_id on public.supplier_categories
  for each row execute function public.guard_active_leaf_category();

drop trigger if exists guard_packages_leaf on public.packages;
create trigger guard_packages_leaf
  before insert or update of subcategory_id on public.packages
  for each row execute function public.guard_active_leaf_category();

create or replace function public.guard_rfqs_category_pair()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child_parent uuid;
  v_child_active boolean;
  v_parent_parent uuid;
  v_parent_active boolean;
begin
  select parent_id, is_active into v_child_parent, v_child_active
    from public.categories
   where id = new.subcategory_id;
  if not found then
    raise exception 'rfq_subcategory_not_found:%', new.subcategory_id using errcode = '23503';
  end if;
  if v_child_parent is null then
    raise exception 'rfq_subcategory_must_be_leaf:%', new.subcategory_id using errcode = '23514';
  end if;
  if not v_child_active then
    raise exception 'rfq_subcategory_must_be_active:%', new.subcategory_id using errcode = '23514';
  end if;

  select parent_id, is_active into v_parent_parent, v_parent_active
    from public.categories
   where id = new.category_id;
  if not found then
    raise exception 'rfq_category_not_found:%', new.category_id using errcode = '23503';
  end if;
  if v_parent_parent is not null then
    raise exception 'rfq_category_must_be_parent:%', new.category_id using errcode = '23514';
  end if;
  if not v_parent_active then
    raise exception 'rfq_category_must_be_active:%', new.category_id using errcode = '23514';
  end if;
  if v_child_parent <> new.category_id then
    raise exception 'rfq_category_pair_mismatch' using errcode = '23514';
  end if;

  return new;
end
$$;

drop trigger if exists guard_rfqs_category_pair on public.rfqs;
create trigger guard_rfqs_category_pair
  before insert or update of category_id, subcategory_id on public.rfqs
  for each row execute function public.guard_rfqs_category_pair();

create or replace function public.replace_supplier_categories(
  p_supplier_id uuid,
  p_subcategory_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invalid_ids text;
begin
  if p_subcategory_ids is not null and array_length(p_subcategory_ids, 1) > 0 then
    with requested as (
      select distinct unnest(p_subcategory_ids) as id
    )
    select string_agg(requested.id::text, ', ' order by requested.id::text)
      into v_invalid_ids
      from requested
      left join public.categories c on c.id = requested.id
     where c.id is null
        or c.parent_id is null
        or not c.is_active;

    if v_invalid_ids is not null then
      raise exception 'invalid_active_leaf_categories:%', v_invalid_ids using errcode = 'P0030';
    end if;
  end if;

  delete from public.supplier_categories
   where supplier_id = p_supplier_id;

  if p_subcategory_ids is not null and array_length(p_subcategory_ids, 1) > 0 then
    insert into public.supplier_categories (supplier_id, subcategory_id)
    select distinct p_supplier_id, unnest(p_subcategory_ids);
  end if;
end;
$$;

revoke all on function public.replace_supplier_categories(uuid, uuid[]) from public;
grant execute on function public.replace_supplier_categories(uuid, uuid[]) to service_role;

create or replace function public.send_rfq_tx(
  p_organizer_id uuid,
  p_event_id uuid,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_requirements jsonb,
  p_response_deadline_hours int,
  p_invites jsonb,
  p_is_published_to_marketplace boolean default true
)
returns table(out_rfq_id uuid, out_invite_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq_id uuid;
  v_now timestamptz := now();
  v_response_due_at timestamptz;
  v_invite_count int;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  if p_response_deadline_hours is null or p_response_deadline_hours not in (24, 48, 72) then
    raise exception 'invalid_response_deadline:%', p_response_deadline_hours using errcode = 'P0020';
  end if;
  if p_invites is null or jsonb_typeof(p_invites) <> 'array' then
    raise exception 'invites_must_be_array' using errcode = 'P0021';
  end if;
  if jsonb_array_length(p_invites) > 20 then
    raise exception 'invites_too_many:%', jsonb_array_length(p_invites) using errcode = 'P0023';
  end if;

  perform 1
    from public.categories child
    join public.categories parent on parent.id = child.parent_id
   where child.id = p_subcategory_id
     and parent.id = p_category_id
     and child.is_active
     and parent.is_active
     and parent.parent_id is null;
  if not found then
    raise exception 'invalid_category_pair' using errcode = 'P0026';
  end if;

  perform 1
    from public.events e
   where e.id = p_event_id
     and e.organizer_id = p_organizer_id
     for update;
  if not found then
    raise exception 'event_not_found_or_not_owned' using errcode = 'P0024';
  end if;

  v_response_due_at := v_now + make_interval(hours => p_response_deadline_hours);

  insert into public.rfqs (
    event_id, category_id, subcategory_id, status,
    requirements_jsonb, sent_at, is_published_to_marketplace
  ) values (
    p_event_id, p_category_id, p_subcategory_id, 'sent',
    p_requirements, v_now, coalesce(p_is_published_to_marketplace, true)
  ) returning id into v_rfq_id;

  begin
    insert into public.rfq_invites (
      rfq_id, supplier_id, source, status, sent_at, response_due_at
    )
    select
      v_rfq_id,
      (inv->>'supplier_id')::uuid,
      (inv->>'source')::public.rfq_invite_source,
      'invited'::public.rfq_invite_status,
      v_now,
      v_response_due_at
      from jsonb_array_elements(p_invites) as inv
    on conflict (rfq_id, supplier_id) do update
      set source = excluded.source,
          status = 'invited',
          sent_at = v_now,
          response_due_at = v_response_due_at;
  exception
    when invalid_text_representation or check_violation then
      raise exception 'invalid_invite_source:%', sqlerrm using errcode = 'P0025';
  end;

  select count(*)::int into v_invite_count
    from public.rfq_invites ri
   where ri.rfq_id = v_rfq_id;

  return query select v_rfq_id, v_invite_count;
end
$$;

revoke all on function public.send_rfq_tx(uuid, uuid, uuid, uuid, jsonb, int, jsonb, boolean) from public;
grant execute on function public.send_rfq_tx(uuid, uuid, uuid, uuid, jsonb, int, jsonb, boolean) to service_role;

create or replace function public.send_rfq_tx_v2(
  p_organizer_id uuid,
  p_event_id uuid,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_requirements jsonb,
  p_response_deadline_hours int,
  p_invites jsonb,
  p_is_published_to_marketplace boolean,
  p_company_id uuid,
  p_actor_profile_id uuid
)
returns table(out_rfq_id uuid, out_invite_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq_id uuid;
  v_now timestamptz := now();
  v_response_due_at timestamptz;
  v_invite_count int;
  v_actor uuid;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  v_actor := coalesce(p_actor_profile_id, p_organizer_id);

  if p_response_deadline_hours is null or p_response_deadline_hours not in (24, 48, 72) then
    raise exception 'invalid_response_deadline:%', p_response_deadline_hours using errcode = 'P0020';
  end if;
  if p_invites is null or jsonb_typeof(p_invites) <> 'array' then
    raise exception 'invites_must_be_array' using errcode = 'P0021';
  end if;
  if jsonb_array_length(p_invites) > 20 then
    raise exception 'invites_too_many:%', jsonb_array_length(p_invites) using errcode = 'P0023';
  end if;

  perform 1
    from public.categories child
    join public.categories parent on parent.id = child.parent_id
   where child.id = p_subcategory_id
     and parent.id = p_category_id
     and child.is_active
     and parent.is_active
     and parent.parent_id is null;
  if not found then
    raise exception 'invalid_category_pair' using errcode = 'P0026';
  end if;

  perform 1
    from public.events e
   where e.id = p_event_id
     and (
       (p_company_id is null and e.organizer_id = p_organizer_id)
       or (
         p_company_id is not null
         and e.company_id = p_company_id
         and exists (
           select 1 from public.organizer_memberships m
            where m.company_id = p_company_id
              and m.profile_id = v_actor
              and m.removed_at is null
         )
       )
     )
     for update;
  if not found then
    raise exception 'event_not_found_or_not_owned' using errcode = 'P0024';
  end if;

  v_response_due_at := v_now + make_interval(hours => p_response_deadline_hours);

  insert into public.rfqs (
    event_id, category_id, subcategory_id, status,
    requirements_jsonb, sent_at, is_published_to_marketplace,
    company_id, actor_profile_id
  ) values (
    p_event_id, p_category_id, p_subcategory_id, 'sent',
    p_requirements, v_now, coalesce(p_is_published_to_marketplace, true),
    p_company_id, p_actor_profile_id
  ) returning id into v_rfq_id;

  begin
    insert into public.rfq_invites (
      rfq_id, supplier_id, source, status, sent_at, response_due_at
    )
    select
      v_rfq_id,
      (inv->>'supplier_id')::uuid,
      (inv->>'source')::public.rfq_invite_source,
      'invited'::public.rfq_invite_status,
      v_now,
      v_response_due_at
      from jsonb_array_elements(p_invites) as inv
    on conflict (rfq_id, supplier_id) do update
      set source = excluded.source,
          status = 'invited',
          sent_at = v_now,
          response_due_at = v_response_due_at;
  exception
    when invalid_text_representation or check_violation then
      raise exception 'invalid_invite_source:%', sqlerrm using errcode = 'P0025';
  end;

  select count(*)::int into v_invite_count
    from public.rfq_invites ri
   where ri.rfq_id = v_rfq_id;

  return query select v_rfq_id, v_invite_count;
end
$$;

revoke all on function public.send_rfq_tx_v2(
  uuid, uuid, uuid, uuid, jsonb, int, jsonb, boolean, uuid, uuid
) from public;
grant execute on function public.send_rfq_tx_v2(
  uuid, uuid, uuid, uuid, jsonb, int, jsonb, boolean, uuid, uuid
) to service_role;

drop policy if exists "categories: public read" on public.categories;
create policy "categories: public read" on public.categories
  for select using (is_active);

drop policy if exists "categories: admin read" on public.categories;
create policy "categories: admin read" on public.categories
  for select using (public.is_admin());

notify pgrst, 'reload schema';
