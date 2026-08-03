(function () {
  const LANGUAGES = [
    { id: 'id', code: 'id', label: '中文＋印尼文', foreignLabel: 'Bahasa Indonesia', locale: 'id-ID' },
    { id: 'vi', code: 'vi', label: '中文＋越南文', foreignLabel: 'Tiếng Việt', locale: 'vi-VN' },
    { id: 'th', code: 'th', label: '中文＋泰文', foreignLabel: 'ภาษาไทย', locale: 'th-TH' }
  ];
  const LANGUAGE_NAMES = { 'zh-Hant': '中文', zh: '中文', id: '印尼文', vi: '越南文', th: '泰文' };
  const MONTHS = {
    id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
    th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  };
  const OPTIONS = {
    documents: {
      passport: { 'zh-Hant': '護照', id: 'paspor', vi: 'hộ chiếu', th: 'หนังสือเดินทาง', review_status: 'needs-native-review' },
      arc: { 'zh-Hant': '居留證', id: 'kartu izin tinggal', vi: 'thẻ cư trú', th: 'บัตรถิ่นที่อยู่', review_status: 'needs-native-review' },
      health_card: { 'zh-Hant': '健保卡', id: 'kartu asuransi kesehatan', vi: 'thẻ bảo hiểm y tế', th: 'บัตรประกันสุขภาพ', review_status: 'needs-native-review' },
      work_permit: { 'zh-Hant': '工作許可', id: 'izin kerja', vi: 'giấy phép lao động', th: 'ใบอนุญาตทำงาน', review_status: 'needs-native-review' },
      bank_book: { 'zh-Hant': '存摺', id: 'buku tabungan', vi: 'sổ ngân hàng', th: 'สมุดบัญชีธนาคาร', review_status: 'needs-native-review' },
      photo: { 'zh-Hant': '照片', id: 'foto', vi: 'ảnh', th: 'รูปถ่าย', review_status: 'needs-native-review' },
      medical_report: { 'zh-Hant': '體檢報告', id: 'laporan pemeriksaan kesehatan', vi: 'kết quả khám sức khỏe', th: 'รายงานผลตรวจสุขภาพ', review_status: 'needs-native-review' }
    },
    methods: {
      onsite_interview: { 'zh-Hant': '現場面試', id: 'wawancara langsung di lokasi', vi: 'phỏng vấn trực tiếp tại chỗ', th: 'สัมภาษณ์ที่หน้างาน', review_status: 'needs-native-review' },
      video_call: { 'zh-Hant': '視訊通話', id: 'panggilan video', vi: 'gọi video', th: 'วิดีโอคอล', review_status: 'needs-native-review' },
      phone_call: { 'zh-Hant': '電話通話', id: 'panggilan telepon', vi: 'gọi điện thoại', th: 'โทรศัพท์', review_status: 'needs-native-review' },
      in_person: { 'zh-Hant': '現場交付', id: 'serahkan langsung di lokasi', vi: 'nộp trực tiếp tại chỗ', th: 'ส่งมอบด้วยตนเองที่สถานที่', review_status: 'needs-native-review' },
      give_to_contact: { 'zh-Hant': '交給指定聯絡人', id: 'serahkan kepada narahubung yang ditunjuk', vi: 'giao cho người liên hệ được chỉ định', th: 'มอบให้ผู้ติดต่อที่กำหนด', review_status: 'needs-native-review' },
      upload_photo: { 'zh-Hant': '上傳照片', id: 'unggah foto', vi: 'tải ảnh lên', th: 'อัปโหลดรูปถ่าย', review_status: 'needs-native-review' },
      send_line: { 'zh-Hant': '用 LINE 傳送', id: 'kirim melalui LINE', vi: 'gửi qua LINE', th: 'ส่งทาง LINE', review_status: 'needs-native-review' },
      send_email: { 'zh-Hant': '用電子郵件傳送', id: 'kirim melalui email', vi: 'gửi qua email', th: 'ส่งทางอีเมล', review_status: 'needs-native-review' },
      company_system: { 'zh-Hant': '上傳公司系統', id: 'unggah ke sistem perusahaan', vi: 'tải lên hệ thống công ty', th: 'อัปโหลดเข้าระบบบริษัท', review_status: 'needs-native-review' }
    },
    places: {
      company_first_floor: { 'zh-Hant': '公司一樓', id: 'lantai satu perusahaan', vi: 'tầng một của công ty', th: 'ชั้นหนึ่งของบริษัท', review_status: 'needs-native-review' },
      company_entrance: { 'zh-Hant': '公司門口', id: 'pintu masuk perusahaan', vi: 'cổng công ty', th: 'ทางเข้าบริษัท', review_status: 'needs-native-review' },
      factory_gate: { 'zh-Hant': '工廠大門', id: 'gerbang pabrik', vi: 'cổng nhà máy', th: 'ประตูโรงงาน', review_status: 'needs-native-review' },
      dormitory_entrance: { 'zh-Hant': '宿舍門口', id: 'pintu masuk asrama', vi: 'lối vào ký túc xá', th: 'ทางเข้าหอพัก', review_status: 'needs-native-review' },
      hospital_entrance: { 'zh-Hant': '醫院門口', id: 'pintu masuk rumah sakit', vi: 'cổng bệnh viện', th: 'ทางเข้าโรงพยาบาล', review_status: 'needs-native-review' },
      airport_arrival_hall: { 'zh-Hant': '機場入境大廳', id: 'aula kedatangan bandara', vi: 'sảnh đến sân bay', th: 'โถงผู้โดยสารขาเข้าของสนามบิน', review_status: 'needs-native-review' },
      train_station_exit: { 'zh-Hant': '火車站出口', id: 'pintu keluar stasiun kereta', vi: 'lối ra ga tàu', th: 'ทางออกสถานีรถไฟ', review_status: 'needs-native-review' },
      other: { 'zh-Hant': '其他', id: 'lainnya', vi: 'khác', th: 'อื่น ๆ', review_status: 'needs-native-review' }
    }
  };
  const OPTIONAL_PHRASES = {
    zh: { arrive_early: '請提早 10 分鐘到達。', bring_original: '請攜帶文件正本，以便現場確認。', reply_confirm: '收到後請回覆確認。', no_breakfast: '請不要吃早餐。', bring_health_card: '請攜帶健保卡。', be_on_time: '請準時集合。', tell_medicine: '如有服藥請先告知。', keep_safe: '文件將由指定窗口協助保管與辦理。', clear_photo: '若以照片補交，請確認內容清楚可辨識。', keep_phone_on: '請保持手機暢通。' },
    id: { arrive_early: 'Mohon tiba 10 menit lebih awal.', bring_original: 'Mohon membawa dokumen asli untuk pemeriksaan di lokasi.', reply_confirm: 'Setelah menerima pesan ini, mohon balas untuk konfirmasi.', no_breakfast: 'Mohon jangan sarapan terlebih dahulu.', bring_health_card: 'Mohon membawa kartu asuransi kesehatan.', be_on_time: 'Mohon berkumpul tepat waktu.', tell_medicine: 'Jika sedang minum obat, mohon beri tahu terlebih dahulu.', keep_safe: 'Dokumen akan dibantu disimpan dan diproses oleh petugas yang ditunjuk.', clear_photo: 'Jika mengirim foto dokumen, mohon pastikan isi foto jelas terbaca.', keep_phone_on: 'Mohon pastikan telepon tetap dapat dihubungi.' },
    vi: { arrive_early: 'Vui lòng đến sớm 10 phút.', bring_original: 'Vui lòng mang theo bản gốc giấy tờ để kiểm tra tại chỗ.', reply_confirm: 'Sau khi nhận được tin nhắn này, vui lòng trả lời xác nhận.', no_breakfast: 'Vui lòng không ăn sáng trước.', bring_health_card: 'Vui lòng mang theo thẻ bảo hiểm y tế.', be_on_time: 'Vui lòng tập trung đúng giờ.', tell_medicine: 'Nếu đang dùng thuốc, vui lòng thông báo trước.', keep_safe: 'Giấy tờ sẽ do người phụ trách được chỉ định hỗ trợ giữ và xử lý.', clear_photo: 'Nếu nộp bằng ảnh, vui lòng bảo đảm nội dung rõ ràng và đọc được.', keep_phone_on: 'Vui lòng giữ điện thoại luôn liên lạc được.' },
    th: { arrive_early: 'กรุณามาถึงก่อนเวลา 10 นาที', bring_original: 'กรุณานำเอกสารตัวจริงมาเพื่อตรวจสอบที่หน้างาน', reply_confirm: 'เมื่อได้รับข้อความแล้ว กรุณาตอบกลับเพื่อยืนยัน', no_breakfast: 'กรุณางดอาหารเช้าก่อนตรวจ', bring_health_card: 'กรุณานำบัตรประกันสุขภาพมาด้วย', be_on_time: 'กรุณามารวมตัวให้ตรงเวลา', tell_medicine: 'หากกำลังใช้ยา กรุณาแจ้งให้ทราบล่วงหน้า', keep_safe: 'เอกสารจะมีผู้รับผิดชอบที่กำหนดไว้ช่วยเก็บรักษาและดำเนินการ', clear_photo: 'หากส่งเป็นรูปถ่าย กรุณาตรวจสอบให้เนื้อหาอ่านได้ชัดเจน', keep_phone_on: 'กรุณาเปิดโทรศัพท์และติดต่อได้เสมอ' }
  };
  const LOCATION_TRANSLATIONS = Object.fromEntries(Object.entries(OPTIONS.places).map(([id, item]) => [item['zh-Hant'], { id, zh: item['zh-Hant'], id_text: item.id, vi: item.vi, th: item.th, review_status: item.review_status }]));
  const LOCATION_ALIASES = { '公司1樓': '公司一樓', '一樓辦公室': '公司一樓' };
  const CUSTOM_MISSING = '';
  function parseDate(value) { if (!value) return null; const parts = String(value).split('-').map(Number); if (parts.length !== 3 || parts.some(Number.isNaN)) return null; return { year: parts[0], month: parts[1], day: parts[2] }; }
  function formatDateByLanguage(value, language) { const d = parseDate(value); if (!d) return value || ''; if (language === 'zh') return `${d.year}年${d.month}月${d.day}日`; if (language === 'id') return `${d.day} ${MONTHS.id[d.month - 1]} ${d.year}`; if (language === 'vi') return `ngày ${d.day} tháng ${d.month} năm ${d.year}`; if (language === 'th') return `${d.day} ${MONTHS.th[d.month - 1]} ${d.year}`; return value; }
  function formatTimeByLanguage(value, language) { if (!value) return ''; const [hRaw, mRaw = '00'] = String(value).split(':'); const hour = Number(hRaw); const minute = Number(mRaw); if (Number.isNaN(hour) || Number.isNaN(minute)) return value; const hh = String(hour).padStart(2, '0'); const mm = String(minute).padStart(2, '0'); if (language === 'zh') return `${hour < 12 ? '上午' : '下午'}${hour % 12 === 0 ? 12 : hour % 12}:${mm}`; if (language === 'id') return `${hh}.${mm}`; return `${hh}:${mm}`; }
  function optionLabel(group, id, language) { const item = OPTIONS[group]?.[id]; if (!item) return ''; return item[language === 'zh' ? 'zh-Hant' : language] || item['zh-Hant'] || id; }
  function joinList(items, language) { const clean = items.filter(Boolean); return language === 'zh' ? clean.join('、') : clean.join(', '); }
  function getName(values, base, language, warnings) { if (language === 'zh') return (values[`${base}_zh`] || '').trim(); const latin = (values[`${base}_latin`] || '').trim(); if (!latin && (values[`${base}_zh`] || '').trim()) warnings.push({ type: 'missing_foreign_name', field: `${base}_latin`, message: '建議填寫護照英文姓名或羅馬拼音，避免對方無法辨識。' }); return latin; }
  function greeting(values, base, language, warnings) { const name = getName(values, base, language, warnings); if (language === 'zh') return name ? `${name}您好，` : '您好，'; if (!name) return ''; if (language === 'id') return `Halo ${name}, `; if (language === 'vi') return `Xin chào ${name}, `; if (language === 'th') return `สวัสดี ${name} `; return `${name} `; }
  function customValue(values, id, language, warnings) { if (language === 'zh') return (values[`${id}_zh`] || '').trim(); const target = (values[`${id}_${language}`] || '').trim(); if (!target && (values[`${id}_zh`] || '').trim()) { warnings.push({ type: 'missing_place_translation', field: `${id}_${language}`, message: '此地點沒有預設翻譯，外語訊息暫未顯示地點。' }); return ''; } return target; }
  function placeValue(values, id, language, warnings) { const choice = values[`${id}_choice`] || ''; if (choice === 'other') return customValue(values, id, language, warnings); return optionLabel('places', choice, language) || ''; }
  function optionValue(values, id, group, language) { return optionLabel(group, values[id], language) || ''; }
  function multiOptionValue(values, id, group, language) { const raw = values[id]; const list = Array.isArray(raw) ? raw : raw ? [raw] : []; return joinList(list.map((item) => optionLabel(group, item, language)), language); }
  function buildValues(fieldSpecs, values, language) { const warnings = []; const out = {}; fieldSpecs.forEach((field) => { if (field.kind === 'name') { out[`${field.base}_name`] = getName(values, field.base, language, warnings); out[`${field.base}_greeting`] = greeting(values, field.base, language, warnings); } else if (field.kind === 'date') out[field.id] = formatDateByLanguage(values[field.id], language); else if (field.kind === 'time') out[field.id] = formatTimeByLanguage(values[field.id], language); else if (field.kind === 'place') out[field.id] = placeValue(values, field.id, language, warnings); else if (field.kind === 'option') out[field.id] = optionValue(values, field.id, field.group, language); else if (field.kind === 'multiOption') out[field.id] = multiOptionValue(values, field.id, field.group, language); else if (field.kind === 'text') out[field.id] = values[field.id] || ''; }); return { values: out, warnings }; }
  window.ForeignWorkforceMessageLocalization = { languages: LANGUAGES, languageNames: LANGUAGE_NAMES, options: OPTIONS, locationTranslations: LOCATION_TRANSLATIONS, locationAliases: LOCATION_ALIASES, optionalPhrases: OPTIONAL_PHRASES, formatDateByLanguage, formatTimeByLanguage, buildValues, optionLabel, joinList, missingText: CUSTOM_MISSING };
})();
