/* ============================================
   Data Kebocoran - Seri F04 & F03
   ============================================ */

const LEAK_DATA_F04 = [
  {
    id: 1,
    name: "Seal Tutup Depan",
    location: "Di ujung pipa depan — penutup akrilik / tutup di mulut laras depan (sisi kiri laras, karena unit F04 menghadap kiri)",
    symptom: "Terdengar suara desis di ujung depan pipa, terutama saat tidak memompa. Udara keluar dari bibir tutup depan.",
    soundAt: "cek_1 — terdengar di ujung pipa depan, dekat tutup akrilik",
    causes: [
      "O-ring tutup depan kering / tidak terpasang /变形",
      "Akrilik tutup retak / aus di permukaan seal",
      "Tutup kurang dikencangkan (drat longgar)",
      "Selang internal (penghubung pompa ke pipa) bocor / kendor di klem"
    ],
    solutions: [
      "Bongkar tutup depan, periksa o-ring — ganti jika bentuknya sudah gepeng / sobek / getas",
      "Cek akrilik tutup: kalau retak / aus di permukaan seal, ganti baru",
      "Kencangkan tutup dengan tangan + kunci pas (jangan over-tighten, drat akrilik bisa retak)",
      "Cek selang internal di dalam pipa — pastikan klem terpasang kuat &amp; selang tidak bocor / retak"
    ],
    severity: "sedang"
  },
  {
    id: 2,
    name: "Seal Valve Inlet (M5)",
    location: "Di ujung pompa — M5 inlet valve di dalam body pompa. Tidak memakai spring, hanya o-ring yang bergerak bebas, sedikit dijepit oleh baut M5 dari luar pompa",
    symptom: "Angin keluar dari dalam tabung pompa — terdengar desis dari area gagang pompa. Pompa terasa 'lunak' atau malah 'terlalu berat' (angin kembali keluar &amp; gagang pompa seperti membal).",
    soundAt: "cek_2 — terdengar di sekitar gagang pompa / selang pendorong",
    causes: [
      "O-ring inlet kering, getas, atau变形 (sudah tidak elastis)",
      "Baut M5 jepit terlalu kendor — o-ring tidak menahan aliran, angin balik ke selang",
      "Baut M5 jepit terlalu keras — pompa terasa sangat berat, o-ring cepat aus",
      "Seating o-ring kotor / berkarat / ada goresan",
      "Selang pendorong antara pompa &amp; valve dumping kendor / retak / klem lepas"
    ],
    solutions: [
      "Lepas pompa, bersihkan o-ring inlet &amp; seat pakai alkohol IPA",
      "Cek kondisi o-ring: ganti jika变形, getas, atau ada potongan yang terputus",
      "Lumasi o-ring baru dengan silicone grease (tipis, merata)",
      "Pasang kembali baut M5: kencangkan secukupnya, lalu setting: putar CW (obeng -) untuk menambah jepitan, CCW untuk mengurangi",
      "SETTING IDEAL: pompa terasa ada tahanan (tidak terlalu ringan → angin balik; tidak terlalu berat → cepat aus). Test pompa &amp; tembak beberapa kali, adjust sampai siklus pas",
      "Cek selang pendorong: pastikan klem kuat, selang tidak retak, tidak ada bagian yang gepeng"
    ],
    severity: "tinggi"
  },
  {
    id: 3,
    name: "Seal Valve Dumping",
    location: "Di dekat lubang transfer angin ke laras. F04: valve dumping 1 group dengan pompa, murni hanya o-ring (TIDAK ada spring). Ada ring akrilik yang mengunci batang valve ke body pompa, dan di depannya ada selang pendorong. Pendorong = body pompa.",
    symptom: "Suara 'psshh' keluar dari lubang transfer angin ke laras. Udara bocor ke arah laras, FPS drop, manometer cepat turun saat idle. Siklus pompa-tembak terasa tidak normal.",
    soundAt: "cek_3 — terdengar di sekitar lubang transfer / area tengah (arah angin bocor)",
    causes: [
      "O-ring valve dumping (ID 10 mm) kering, getas, atau sobek",
      "Permukaan batang valve (OD 10) kotor / berkarat / ada baret",
      "Ring akrilik tidak mengunci batang valve dengan benar (longgar / retak)",
      "Selang pendorong tidak mendorong valve cukup jauh (terlalu pendek / kendor di klem)",
      "Posisi batang valve miring / tidak lurus di dalam pipa spacer"
    ],
    solutions: [
      "Cara kerja F04: dorong gagang pompa ke depan → body pompa ikut terdorong → selang pendorong mendorong valve melewati lubang transfer (BARU bisa dipompa). Saat pompa mundur, valve tertahan selang pendorong. Saat picu ditekan, valve mundur cepat → angin keluar.",
      "Bongkar unit: keluarkan batang valve dari body pompa",
      "Cek o-ring: ganti jika变形 / sobek / getas. Lumasi silicone grease tipis",
      "Cek ring akrilik: harus utuh, mengunci batang valve dengan kuat ke body pompa",
      "Cek permukaan batang di area o-ring: bersihkan karat/minyak dengan alkohol IPA",
      "Cek kelurusan batang: harus lurus, tidak bengkok",
      "Cek selang pendorong: pastikan elastis, tidak kendor, mendorong valve cukup jauh (~2cm)",
      "Cek pasak_belakang 1 &amp; 2: harus kuat menahan body pompa, tidak aus",
      "Cek sear: harus bisa naik-turun bebas, mengunci valve_dumping dengan kuat saat posisi pompa",
      "Pasang ulang: pastikan batang masuk lurus ke body pompa, o-ring tidak terpelintir, baut M5 inlet di-setting seperti leak #2"
    ],
    severity: "tinggi"
  },
  {
    id: 4,
    name: "Drat Manometer",
    location: "Di sisi manometer — sambungan drat antara pipa utama &amp; housing manometer (di bawah body utama, lokasi visualisasi saja di diagram)",
    symptom: "Suara desis terdengar di sekitar manometer, jarum manometer bergetar / drop saat tidak dipompa. Udara keluar dari celah drat.",
    soundAt: "cek_4 — terdengar di sekitar manometer",
    causes: [
      "O-ring drat manometer (tipis, di ulir drat) tidak ada / rusak",
      "Drat manometer kurang kencang atau seal tape kurang",
      "Manometer rusak internal — seal internalnya bocor"
    ],
    solutions: [
      "Buka manometer, cek o-ring di drat — ganti dengan ukuran yang sama (ID 10 / 16 sesuai规格)",
      "Pasang seal tape (Teflon) pada drat manometer 2–3 lilitan searah drat",
      "Kencangkan drat manometer dengan tangan + kunci inggris (jangan over)",
      "Jika manometer sendiri rusak (jarum tidak naik / seal internal bocor), ganti unit manometer"
    ],
    severity: "rendah"
  }
];

const LEAK_DATA_F03 = [
  {
    id: 1,
    name: "Seal Tutup Depan",
    location: "Di ujung pipa depan — penutup akrilik / tutup di mulut laras depan (sisi kiri laras, karena unit F03 menghadap kiri)",
    symptom: "Terdengar suara desis di ujung depan pipa, terutama saat tidak memompa. Udara keluar dari bibir tutup depan.",
    soundAt: "cek_1 — terdengar di ujung pipa depan, dekat tutup akrilik",
    causes: [
      "O-ring tutup depan kering / tidak terpasang /变形",
      "Akrilik tutup retak / aus di permukaan seal",
      "Tutup kurang dikencangkan (drat longgar)",
      "Selang internal (penghubung pompa ke pipa) bocor / kendor di klem"
    ],
    solutions: [
      "Bongkar tutup depan, periksa o-ring — ganti jika bentuknya sudah gepeng / sobek / getas",
      "Cek akrilik tutup: kalau retak / aus di permukaan seal, ganti baru",
      "Kencangkan tutup dengan tangan + kunci pas (jangan over-tighten, drat akrilik bisa retak)",
      "Cek selang internal di dalam pipa — pastikan klem terpasang kuat &amp; selang tidak bocor / retak"
    ],
    severity: "sedang"
  },
  {
    id: 2,
    name: "Seal Valve Inlet (M5)",
    location: "Di ujung pompa (F03: pompa di DEPAN) — M5 inlet valve di dalam body pompa. Tidak memakai spring, hanya o-ring yang bergerak bebas, sedikit dijepit oleh baut M5 dari luar pompa",
    symptom: "Angin keluar dari dalam tabung pompa — terdengar desis dari area gagang pompa depan. Pompa terasa 'lunak' atau malah 'terlalu berat' (angin kembali keluar &amp; gagang pompa seperti membal).",
    soundAt: "cek_2 — terdengar di sekitar gagang pompa depan / selang pendorong",
    causes: [
      "O-ring inlet kering, getas, atau变形 (sudah tidak elastis)",
      "Baut M5 jepit terlalu kendor — o-ring tidak menahan aliran, angin balik ke selang",
      "Baut M5 jepit terlalu keras — pompa terasa sangat berat, o-ring cepat aus",
      "Seating o-ring kotor / berkarat / ada goresan",
      "Selang pendorong antara pompa &amp; valve dumping kendor / retak / klem lepas"
    ],
    solutions: [
      "Lepas pompa, bersihkan o-ring inlet &amp; seat pakai alkohol IPA",
      "Cek kondisi o-ring: ganti jika变形, getas, atau ada potongan yang terputus",
      "Lumasi o-ring baru dengan silicone grease (tipis, merata)",
      "Pasang kembali baut M5: kencangkan secukupnya, lalu setting: putar CW (obeng -) untuk menambah jepitan, CCW untuk mengurangi",
      "SETTING IDEAL: pompa terasa ada tahanan (tidak terlalu ringan → angin balik; tidak terlalu berat → cepat aus). Test pompa &amp; tembak beberapa kali, adjust sampai siklus pas",
      "Cek selang pendorong: pastikan klem kuat, selang tidak retak, tidak ada bagian yang gepeng"
    ],
    severity: "tinggi"
  },
  {
    id: 3,
    name: "Seal Valve Dumping (Terpisah)",
    location: "Di dekat lubang transfer angin ke laras. F03: valve dumping TERPISAH dari pompa (bukan satu group). Batang valve dumping = batang yang SAMA dengan batang pompa, ujungnya di dalam pipa DISUMBAT. Pendorong valve dumping = batang pompa itu sendiri (F04: body pompa yang dorong).",
    symptom: "Suara 'psshh' keluar dari lubang transfer angin ke laras. Udara bocor ke arah laras, FPS drop, manometer cepat turun saat idle. Siklus pompa-tembak terasa tidak normal.",
    soundAt: "cek_3 — terdengar di sekitar lubang transfer / area tengah (arah angin bocor)",
    causes: [
      "O-ring valve dumping (ID 10 mm) kering, getas, atau sobek",
      "Sumbat di ujung batang valve (yang masuk ke dalam pipa) lepas / rusak / tidak rata",
      "Batang valve (yang juga batang pompa) berkarat / ada baret di area o-ring",
      "Pendorong tidak mendorong valve cukup jauh (batang pompa tidak cukup maju, atau ada halangan)",
      "Posisi batang valve miring / tidak lurus di dalam pipa spacer"
    ],
    solutions: [
      "Cara kerja F03: dorong gagang pompa ke depan → batang pompa (yang juga = batang valve) ikut terdorong → mendorong valve melewati lubang transfer (BARU bisa dipompa). Saat pompa mundur, valve tertahan selang pendorong. Saat picu ditekan, valve mundur cepat → angin keluar.",
      "Bongkar unit: keluarkan batang pompa/valve dari body pompa",
      "Cek o-ring: ganti jika变形 / sobek / getas. Lumasi silicone grease tipis",
      "Cek sumbat ujung batang (yang masuk pipa): harus masih utuh, tidak pecah, masih rata. Kalau rusak, ganti atau rekatkan",
      "Cek permukaan batang di area o-ring: bersihkan karat/minyak dengan alkohol IPA, kalau ada baret halus → amplas halus (jangan dalam)",
      "Cek kelurusan batang: harus lurus, tidak bengkok",
      "Cek selang pendorong: pastikan elastis, tidak kendor, mendorong valve cukup jauh",
      "Pasang ulang: pastikan batang masuk lurus ke body pompa, o-ring tidak terpelintir, baut M5 inlet di-setting seperti leak #2"
    ],
    severity: "tinggi"
  },
  {
    id: 4,
    name: "Drat Manometer",
    location: "Di sisi manometer — sambungan drat antara pipa utama &amp; housing manometer (di bawah body utama, lokasi visualisasi saja di diagram)",
    symptom: "Suara desis terdengar di sekitar manometer, jarum manometer bergetar / drop saat tidak dipompa. Udara keluar dari celah drat.",
    soundAt: "cek_4 — terdengar di sekitar manometer",
    causes: [
      "O-ring drat manometer (tipis, di ulir drat) tidak ada / rusak",
      "Drat manometer kurang kencang atau seal tape kurang",
      "Manometer rusak internal — seal internalnya bocor"
    ],
    solutions: [
      "Buka manometer, cek o-ring di drat — ganti dengan ukuran yang sama (ID 10 / 16 sesuai规格)",
      "Pasang seal tape (Teflon) pada drat manometer 2–3 lilitan searah drat",
      "Kencangkan drat manometer dengan tangan + kunci inggris (jangan over)",
      "Jika manometer sendiri rusak (jarum tidak naik / seal internal bocor), ganti unit manometer"
    ],
    severity: "rendah"
  }
];

/* Map: bocor_N -> leak id (1..4) - same for F03 and F04 */
const BOCOR_MAP = {
  bocor_1: 1,
  bocor_2: 2,
  bocor_3: 3,
  bocor_4: 4
};

/* Map: cek_N -> leak id */
const CEK_MAP = {
  cek_1: 1,
  cek_2: 2,
  cek_3: 3,
  cek_4: 4
};
