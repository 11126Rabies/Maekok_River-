/* Shared schema for downloads, import validation and exports. */
const IMPORT_SCHEMAS = {
  "wells": {
    "title": "ทะเบียนแหล่งน้ำ",
    "fields": [
      {
        "key": "well_id",
        "label": "รหัสทะเบียนแหล่งน้ำที่เชื่อม",
        "type": "text",
        "required": true,
        "example": "EXAMPLE-W001",
        "note": "ต้องกรอกทุกแถวข้อมูล"
      },
      {
        "key": "sample_code",
        "label": "รหัสตัวอย่างน้ำ / Lab Code น้ำ",
        "type": "text",
        "required": false,
        "example": "EXAMPLE-P01",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "well_name",
        "label": "ชื่อแหล่งน้ำหรือเจ้าของบ่อ",
        "type": "text",
        "required": true,
        "example": "จุดน้ำตัวอย่างสมมติ",
        "note": "ต้องกรอกทุกแถวข้อมูล"
      },
      {
        "key": "house_no",
        "label": "บ้านเลขที่",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "moo",
        "label": "หมู่ที่",
        "type": "number",
        "required": false,
        "example": 1,
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "tambon",
        "label": "ตำบล",
        "type": "text",
        "required": false,
        "example": "ท่าตอน",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "well_type",
        "label": "ประเภทแหล่งน้ำ",
        "type": "text",
        "required": false,
        "example": "บ่อน้ำตื้น",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "depth_meters",
        "label": "ความลึกบ่อ (เมตร)",
        "type": "number",
        "required": false,
        "example": 12,
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "utm_e",
        "label": "พิกัด UTM Easting (X) โซน 47N",
        "type": "number",
        "required": false,
        "example": "",
        "note": "กรอกพิกัดเป็นคู่; ไม่ทราบให้เว้นว่าง ไม่ใช้พิกัดของบุคคลอื่น"
      },
      {
        "key": "utm_n",
        "label": "พิกัด UTM Northing (Y) โซน 47N",
        "type": "number",
        "required": false,
        "example": "",
        "note": "กรอกพิกัดเป็นคู่; ไม่ทราบให้เว้นว่าง ไม่ใช้พิกัดของบุคคลอื่น"
      },
      {
        "key": "latitude",
        "label": "ละติจูด WGS84",
        "type": "number",
        "required": false,
        "example": 20.056,
        "note": "กรอกพิกัดเป็นคู่; ไม่ทราบให้เว้นว่าง ไม่ใช้พิกัดของบุคคลอื่น"
      },
      {
        "key": "longitude",
        "label": "ลองจิจูด WGS84",
        "type": "number",
        "required": false,
        "example": 99.4,
        "note": "กรอกพิกัดเป็นคู่; ไม่ทราบให้เว้นว่าง ไม่ใช้พิกัดของบุคคลอื่น"
      },
      {
        "key": "distance_river_m",
        "label": "ระยะจากแม่น้ำกก (เมตร)",
        "type": "number",
        "required": false,
        "example": 80,
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "usage_type",
        "label": "ลักษณะการใช้น้ำ",
        "type": "text",
        "required": false,
        "example": "ใช้อุปโภค",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "user_count",
        "label": "จำนวนผู้ใช้น้ำ (คน)",
        "type": "number",
        "required": false,
        "example": 4,
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "health_center",
        "label": "รพ.สต.ที่รับผิดชอบ",
        "type": "text",
        "required": false,
        "example": "รพ.สต.ตัวอย่าง",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      }
    ]
  },
  "waterlab": {
    "title": "ผลตรวจน้ำ 21 รายการ",
    "fields": [
      {
        "key": "well_id",
        "label": "รหัสทะเบียนแหล่งน้ำที่เชื่อม",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "sample_code",
        "label": "รหัสตัวอย่างน้ำ / Lab Code น้ำ",
        "type": "text",
        "required": true,
        "example": "EXAMPLE-P01",
        "note": "ต้องกรอกทุกแถวข้อมูล"
      },
      {
        "key": "sample_date",
        "label": "วันที่เก็บตัวอย่างน้ำ ค.ศ. YYYY-MM-DD",
        "type": "date",
        "required": false,
        "example": "2026-10-31",
        "note": "ค.ศ. YYYY-MM-DD เช่น 2026-10-31; ปีงบประมาณคำนวณจากวันที่ (1 ต.ค. เริ่มปีถัดไป)"
      },
      {
        "key": "lab_name",
        "label": "ชื่อห้องปฏิบัติการ",
        "type": "text",
        "required": false,
        "example": "ห้องปฏิบัติการตัวอย่าง",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "standard_type",
        "label": "ชุดเกณฑ์ที่ใช้แปลผล",
        "type": "text",
        "required": false,
        "example": "DOH_2543",
        "note": "DOH_2543 / WHO_1984 / RURAL / SOURCE_SSO; ตรวจหน่วยตรงกับเกณฑ์ก่อนเลือก"
      },
      {
        "key": "ph",
        "label": "ความเป็นกรดด่าง (ไม่มีหน่วย); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "7.2",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "colour",
        "label": "สี (แพลตินัม-โคบอลต์); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "turbidity",
        "label": "ความขุ่น (เอ็นทียู); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "tds",
        "label": "สารละลายทั้งหมด (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "hardness",
        "label": "ความกระด้าง (mg/L as CaCO3); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "fe",
        "label": "เหล็ก (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "mn",
        "label": "แมงกานีส (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "cu",
        "label": "ทองแดง (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "zn",
        "label": "สังกะสี (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "pb",
        "label": "ตะกั่ว (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "ND",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "cr",
        "label": "โครเมียม (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "cd",
        "label": "แคดเมียม (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "as_val",
        "label": "สารหนู (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "<0.005",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "hg",
        "label": "ปรอท (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "so4",
        "label": "ซัลเฟต (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "cl",
        "label": "คลอไรด์ (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "no3",
        "label": "ไนเตรต (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "f",
        "label": "ฟลูออไรด์ (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "residual_cl",
        "label": "คลอรีนอิสระคงเหลือ (mg/L); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "total_coliform",
        "label": "โคลิฟอร์มแบคทีเรีย (MPN/100 mL); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "faecal_coliform",
        "label": "ฟีคัลโคลิฟอร์มแบคทีเรีย (MPN/100 mL); หน่วยตามใบผลตรวจ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "กรอกตามรายงาน เช่น 0.005, <0.005, ND; ไม่เปลี่ยน ND เป็น 0; SOURCE_SSO เก็บหน่วยโลหะตามต้นฉบับ mg/kg"
      },
      {
        "key": "notes",
        "label": "หมายเหตุ",
        "type": "text",
        "required": false,
        "example": "ข้อมูลสมมติ ไม่ใช่ผลตรวจจริง",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      }
    ]
  },
  "as01": {
    "title": "แบบคัดกรอง Env-As-01",
    "fields": [
      {
        "key": "code",
        "label": "รหัสบุคคล / Lab Code",
        "type": "text",
        "required": true,
        "example": "EXAMPLE-AS01-001",
        "note": "ต้องกรอกทุกแถวข้อมูล"
      },
      {
        "key": "full_name",
        "label": "ชื่อ–นามสกุล",
        "type": "text",
        "required": true,
        "example": "บุคคลตัวอย่างสมมติหนึ่ง",
        "note": "ต้องกรอกทุกแถวข้อมูล"
      },
      {
        "key": "age",
        "label": "อายุ (ปี)",
        "type": "number",
        "required": false,
        "example": 45,
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "gender",
        "label": "เพศ",
        "type": "text",
        "required": false,
        "example": "ชาย",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "cid",
        "label": "เลขประจำตัวประชาชน เก็บเป็นข้อความ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เก็บเป็นข้อความเพื่อคงเลขศูนย์นำหน้า; ไม่มีเลข 13 หลักให้เว้นว่าง"
      },
      {
        "key": "house_no",
        "label": "บ้านเลขที่",
        "type": "text",
        "required": false,
        "example": "99/1",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "moo",
        "label": "หมู่ที่",
        "type": "number",
        "required": false,
        "example": 1,
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "tambon",
        "label": "ตำบล",
        "type": "text",
        "required": false,
        "example": "ท่าตอน",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "marital_status",
        "label": "สถานภาพสมรส",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "education",
        "label": "ระดับการศึกษาสูงสุด",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "years_in_area",
        "label": "ระยะเวลาที่อาศัยในพื้นที่ (ปี)",
        "type": "number",
        "required": false,
        "example": "",
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "risk_job_flag",
        "label": "มีอาชีพเสี่ยงหรือไม่",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "risk_job_type",
        "label": "ประเภทอาชีพเสี่ยง เลือกได้หลายอาชีพ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "job_detail",
        "label": "รายละเอียดลักษณะงาน",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "job_duration",
        "label": "ระยะเวลาทำงาน ระบุปี/เดือน",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "job_hours",
        "label": "ชั่วโมงทำงานต่อวัน",
        "type": "number",
        "required": false,
        "example": "",
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "disease_flag",
        "label": "มีโรคประจำตัวหรือไม่",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "diseases",
        "label": "โรคประจำตัว / รายละเอียด",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "symptom_flag",
        "label": "มีอาการที่เกี่ยวข้องหรือไม่",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "symptoms",
        "label": "รายละเอียดอาการ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "q1",
        "label": "AS-01 ส่วนที่ 4 ข้อ 1: ดื่ม/ใช้น้ำจากแม่น้ำปนเปื้อนประกอบอาหาร",
        "type": "binary",
        "required": false,
        "example": 1,
        "note": "1 = ใช่, 0 = ไม่ใช่; เว้นว่างหากยังไม่ประเมิน; ระบบคำนวณคะแนนเมื่อครบ 11 ข้อ"
      },
      {
        "key": "q2",
        "label": "AS-01 ส่วนที่ 4 ข้อ 2: ดื่ม/ใช้น้ำบ่อตื้นหรือบาดาลบริเวณบ้านประกอบอาหาร",
        "type": "binary",
        "required": false,
        "example": 1,
        "note": "1 = ใช่, 0 = ไม่ใช่; เว้นว่างหากยังไม่ประเมิน; ระบบคำนวณคะแนนเมื่อครบ 11 ข้อ"
      },
      {
        "key": "q3",
        "label": "AS-01 ส่วนที่ 4 ข้อ 3: ใช้น้ำจากแม่น้ำปนเปื้อนอาบ/ล้างหน้า/แปรงฟัน/ล้างผักผลไม้",
        "type": "binary",
        "required": false,
        "example": 0,
        "note": "1 = ใช่, 0 = ไม่ใช่; เว้นว่างหากยังไม่ประเมิน; ระบบคำนวณคะแนนเมื่อครบ 11 ข้อ"
      },
      {
        "key": "q4",
        "label": "AS-01 ส่วนที่ 4 ข้อ 4: เล่น/ว่ายน้ำในแม่น้ำอย่างน้อยสัปดาห์ละครั้ง",
        "type": "binary",
        "required": false,
        "example": 0,
        "note": "1 = ใช่, 0 = ไม่ใช่; เว้นว่างหากยังไม่ประเมิน; ระบบคำนวณคะแนนเมื่อครบ 11 ข้อ"
      },
      {
        "key": "q5",
        "label": "AS-01 ส่วนที่ 4 ข้อ 5: ทำงานมีโอกาสสัมผัสน้ำจากแม่น้ำ",
        "type": "binary",
        "required": false,
        "example": 0,
        "note": "1 = ใช่, 0 = ไม่ใช่; เว้นว่างหากยังไม่ประเมิน; ระบบคำนวณคะแนนเมื่อครบ 11 ข้อ"
      },
      {
        "key": "q6",
        "label": "AS-01 ส่วนที่ 4 ข้อ 6: ที่พักอยู่ในรัศมี 1 กม.",
        "type": "binary",
        "required": false,
        "example": 0,
        "note": "1 = ใช่, 0 = ไม่ใช่; เว้นว่างหากยังไม่ประเมิน; ระบบคำนวณคะแนนเมื่อครบ 11 ข้อ"
      },
      {
        "key": "q7",
        "label": "AS-01 ส่วนที่ 4 ข้อ 7: อยู่ในพื้นที่มากกว่า 5 ปี",
        "type": "binary",
        "required": false,
        "example": 0,
        "note": "1 = ใช่, 0 = ไม่ใช่; เว้นว่างหากยังไม่ประเมิน; ระบบคำนวณคะแนนเมื่อครบ 11 ข้อ"
      },
      {
        "key": "q8",
        "label": "AS-01 ส่วนที่ 4 ข้อ 8: มีอาการเข้าได้กับพิษสารหนูภายหลังสัมผัสน้ำ",
        "type": "binary",
        "required": false,
        "example": 0,
        "note": "1 = ใช่, 0 = ไม่ใช่; เว้นว่างหากยังไม่ประเมิน; ระบบคำนวณคะแนนเมื่อครบ 11 ข้อ"
      },
      {
        "key": "q9",
        "label": "AS-01 ส่วนที่ 4 ข้อ 9: ตนเอง/คนในครอบครัวมีอาการเข้าได้กับโรคสารหนู",
        "type": "binary",
        "required": false,
        "example": 0,
        "note": "1 = ใช่, 0 = ไม่ใช่; เว้นว่างหากยังไม่ประเมิน; ระบบคำนวณคะแนนเมื่อครบ 11 ข้อ"
      },
      {
        "key": "q10",
        "label": "AS-01 ส่วนที่ 4 ข้อ 10: น้ำหลากเข้าบ้านใน 5 ปี",
        "type": "binary",
        "required": false,
        "example": 0,
        "note": "1 = ใช่, 0 = ไม่ใช่; เว้นว่างหากยังไม่ประเมิน; ระบบคำนวณคะแนนเมื่อครบ 11 ข้อ"
      },
      {
        "key": "q11",
        "label": "AS-01 ส่วนที่ 4 ข้อ 11: กินพืชผักริมน้ำอย่างน้อยสัปดาห์ละครั้ง",
        "type": "binary",
        "required": false,
        "example": 0,
        "note": "1 = ใช่, 0 = ไม่ใช่; เว้นว่างหากยังไม่ประเมิน; ระบบคำนวณคะแนนเมื่อครบ 11 ข้อ"
      },
      {
        "key": "target_group",
        "label": "กลุ่มเป้าหมาย",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "well_id",
        "label": "รหัสทะเบียนแหล่งน้ำที่เชื่อม",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "survey_date",
        "label": "วันที่สำรวจ AS-01 ค.ศ. YYYY-MM-DD",
        "type": "date",
        "required": false,
        "example": "2026-10-31",
        "note": "ค.ศ. YYYY-MM-DD เช่น 2026-10-31; ปีงบประมาณคำนวณจากวันที่ (1 ต.ค. เริ่มปีถัดไป)"
      },
      {
        "key": "interviewer_name",
        "label": "ชื่อผู้สัมภาษณ์/ประเมิน",
        "type": "text",
        "required": false,
        "example": "ผู้ประเมินตัวอย่าง",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "phone",
        "label": "เบอร์โทรศัพท์ เก็บเป็นข้อความ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เก็บเป็นข้อความเพื่อคงเลขศูนย์นำหน้า"
      },
      {
        "key": "exposure_years",
        "label": "ระยะเวลาสัมผัส (ปี)",
        "type": "number",
        "required": false,
        "example": 10,
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "health_center",
        "label": "รพ.สต.ที่รับผิดชอบ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "amphoe",
        "label": "อำเภอ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "province",
        "label": "จังหวัด",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "q2_1",
        "label": "2Q ข้อ 1: หดหู่ เศร้า หรือท้อแท้สิ้นหวัง ใน 2 สัปดาห์รวมวันนี้",
        "type": "text",
        "required": false,
        "example": "ไม่ใช่",
        "note": "ใช่ / ไม่ใช่; เว้นว่างหมายถึงยังไม่ได้ตอบ ไม่ใช้คำว่าปกติแทนคำตอบ"
      },
      {
        "key": "q2_2",
        "label": "2Q ข้อ 2: เบื่อ ทำอะไรก็ไม่เพลิดเพลิน ใน 2 สัปดาห์รวมวันนี้",
        "type": "text",
        "required": false,
        "example": "ไม่ใช่",
        "note": "ใช่ / ไม่ใช่; เว้นว่างหมายถึงยังไม่ได้ตอบ ไม่ใช้คำว่าปกติแทนคำตอบ"
      },
      {
        "key": "date_2q",
        "label": "วันที่คัดกรอง 2Q ค.ศ. YYYY-MM-DD",
        "type": "date",
        "required": false,
        "example": "",
        "note": "ค.ศ. YYYY-MM-DD เช่น 2026-10-31; ปีงบประมาณคำนวณจากวันที่ (1 ต.ค. เริ่มปีถัดไป)"
      },
      {
        "key": "assessor_2q",
        "label": "ชื่อผู้ประเมิน 2Q",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "note_2q",
        "label": "หมายเหตุผล 2Q",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "fiscal_year",
        "label": "ปีงบประมาณ พ.ศ. กรอกเมื่อไม่มีวันที่",
        "type": "number",
        "required": false,
        "example": "",
        "note": "พ.ศ. เช่น 2569; สำหรับ AS-01/02 ต้องมีวันที่หรือปีนี้อย่างใดอย่างหนึ่ง; วันที่มีลำดับก่อน"
      },
      {
        "key": "total_score",
        "label": "คะแนนรวม ใช้เฉพาะข้อมูลสรุปเดิมที่ไม่มีคำตอบครบ",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ข้อมูลสรุปเดิมเท่านั้น; AS-01 ถ้ามีคำตอบครบ ระบบคำนวณใหม่; AS-02 ไม่สร้างคะแนนความเสี่ยงใหม่จากประวัติน้ำ"
      },
      {
        "key": "risk_level",
        "label": "ระดับความเสี่ยงตามต้นฉบับ ใช้เมื่อไม่มีคำตอบครบ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "ข้อมูลสรุปเดิมเท่านั้น; AS-01 ถ้ามีคำตอบครบ ระบบคำนวณใหม่; AS-02 ไม่สร้างคะแนนความเสี่ยงใหม่จากประวัติน้ำ"
      },
      {
        "key": "notes",
        "label": "หมายเหตุ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      }
    ]
  },
  "as02": {
    "title": "แบบซักประวัติ Env-As-02",
    "fields": [
      {
        "key": "form_no",
        "label": "เลขที่แบบ AS-02",
        "type": "text",
        "required": true,
        "example": "70-EXAMPLE-001",
        "note": "ต้องกรอกทุกแถวข้อมูล"
      },
      {
        "key": "full_name",
        "label": "ชื่อ–นามสกุล",
        "type": "text",
        "required": true,
        "example": "บุคคลตัวอย่างสมมติสอง",
        "note": "ต้องกรอกทุกแถวข้อมูล"
      },
      {
        "key": "age",
        "label": "อายุ (ปี)",
        "type": "number",
        "required": false,
        "example": 45,
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "phone",
        "label": "เบอร์โทรศัพท์ เก็บเป็นข้อความ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เก็บเป็นข้อความเพื่อคงเลขศูนย์นำหน้า"
      },
      {
        "key": "gender",
        "label": "เพศ",
        "type": "text",
        "required": false,
        "example": "ชาย",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "weight_kg",
        "label": "น้ำหนัก (กิโลกรัม)",
        "type": "number",
        "required": false,
        "example": 60,
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "height_cm",
        "label": "ส่วนสูง (เซนติเมตร)",
        "type": "number",
        "required": false,
        "example": 165,
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "cid",
        "label": "เลขประจำตัวประชาชน เก็บเป็นข้อความ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เก็บเป็นข้อความเพื่อคงเลขศูนย์นำหน้า; ไม่มีเลข 13 หลักให้เว้นว่าง"
      },
      {
        "key": "house_no",
        "label": "บ้านเลขที่",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "moo",
        "label": "หมู่ที่",
        "type": "number",
        "required": false,
        "example": 1,
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "tambon",
        "label": "ตำบล",
        "type": "text",
        "required": false,
        "example": "ท่าตอน",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "within_1km_river",
        "label": "ที่พักอยู่ในรัศมี 1 กิโลเมตรจากแม่น้ำ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "risk_job_type",
        "label": "ประเภทอาชีพเสี่ยง เลือกได้หลายอาชีพ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "diseases",
        "label": "โรคประจำตัว / รายละเอียด",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "herb_usage",
        "label": "ความถี่การกินสมุนไพร/ยาลูกกลอนใน 3 เดือน",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "smoking_status",
        "label": "สถานะการสูบบุหรี่",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "alcohol_status",
        "label": "สถานะการดื่มสุรา",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "seafood_freq",
        "label": "ความถี่กินอาหารทะเลใน 1 เดือน",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "seafood_3days",
        "label": "กินอาหารทะเลในช่วง 3 วันที่ผ่านมาหรือไม่",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "drink_sources",
        "label": "แหล่งน้ำดื่มที่เลือก คั่นแต่ละแหล่งด้วยจุลภาค",
        "type": "text",
        "required": false,
        "example": "1. บ่อน้ำตื้น, 5. ประปาหมู่บ้าน",
        "note": "เช่น 1. บ่อน้ำตื้น, 5. ประปาหมู่บ้าน; ใช้คอลัมน์จำนวนปีแยกแต่ละแหล่ง"
      },
      {
        "key": "use_sources",
        "label": "แหล่งน้ำใช้ที่เลือก คั่นแต่ละแหล่งด้วยจุลภาค",
        "type": "text",
        "required": false,
        "example": "3. บ่อบาดาล",
        "note": "เช่น 1. บ่อน้ำตื้น, 5. ประปาหมู่บ้าน; ใช้คอลัมน์จำนวนปีแยกแต่ละแหล่ง"
      },
      {
        "key": "food_rice",
        "label": "แหล่งข้าว/ข้าวเหนียว",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "food_veg",
        "label": "แหล่งพืชผัก",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "eat_river_veg_weekly",
        "label": "กินผักริมน้ำอย่างน้อยสัปดาห์ละ 1 ครั้ง",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "flood_5years",
        "label": "เคยมีน้ำท่วมที่พักในระยะ 5 ปี",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "interviewer_name",
        "label": "ชื่อผู้สัมภาษณ์/ประเมิน",
        "type": "text",
        "required": false,
        "example": "ผู้สัมภาษณ์ตัวอย่าง",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "health_center",
        "label": "รพ.สต.ที่รับผิดชอบ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "interview_date",
        "label": "วันที่ซักประวัติ AS-02 ค.ศ. YYYY-MM-DD",
        "type": "date",
        "required": false,
        "example": "2026-10-31",
        "note": "ค.ศ. YYYY-MM-DD เช่น 2026-10-31; ปีงบประมาณคำนวณจากวันที่ (1 ต.ค. เริ่มปีถัดไป)"
      },
      {
        "key": "code",
        "label": "รหัสบุคคล / Lab Code",
        "type": "text",
        "required": false,
        "example": "EXAMPLE-LAB-001",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "respondent_id",
        "label": "รหัสภายในของ AS-01 ที่ยืนยันว่าเป็นคนเดียวกัน",
        "type": "text",
        "required": false,
        "example": "",
        "note": "ใช้เฉพาะรหัสภายใน AS-01 ที่ตรวจยืนยันแล้ว; ไม่ใช่ Lab Code และไม่จับคู่จากชื่อโดยอัตโนมัติขณะนำเข้า"
      },
      {
        "key": "amphoe",
        "label": "อำเภอ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "province",
        "label": "จังหวัด",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "marital_status",
        "label": "สถานภาพสมรส",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "education",
        "label": "ระดับการศึกษาสูงสุด",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "years_in_area",
        "label": "ระยะเวลาที่อาศัยในพื้นที่ (ปี)",
        "type": "number",
        "required": false,
        "example": "",
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "exposure_years",
        "label": "ระยะเวลาสัมผัส (ปี)",
        "type": "number",
        "required": false,
        "example": "",
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "risk_job_flag",
        "label": "มีอาชีพเสี่ยงหรือไม่",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "job_detail",
        "label": "รายละเอียดลักษณะงาน",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "job_duration",
        "label": "ระยะเวลาทำงาน ระบุปี/เดือน",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "job_hours",
        "label": "ชั่วโมงทำงานต่อวัน",
        "type": "number",
        "required": false,
        "example": "",
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "hours_at_home",
        "label": "จำนวนชั่วโมงอยู่บ้านต่อวัน",
        "type": "number",
        "required": false,
        "example": "",
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "work_out_district",
        "label": "ทำงาน/ธุระนอกอำเภอเป็นประจำหรือไม่",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "work_out_days",
        "label": "จำนวนวันต่อสัปดาห์ที่ไปนอกอำเภอ",
        "type": "number",
        "required": false,
        "example": "",
        "note": "จำนวนไม่ติดลบ; ช่องว่างหมายถึงยังไม่ทราบ ไม่ใช้ 0 แทนข้อมูลที่ขาด"
      },
      {
        "key": "herb_name",
        "label": "ชื่อสมุนไพร/ยาลูกกลอน",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "herb_fda",
        "label": "ข้อมูลทะเบียน อย. ของสมุนไพร",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "smoking_detail",
        "label": "รายละเอียดบุหรี่ จำนวนและระยะเวลา",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "food_fish",
        "label": "แหล่งปลา",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "food_snail",
        "label": "แหล่งหอย",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "home_grown_veg",
        "label": "ชนิดผัก/พืชที่ปลูกเอง",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "home_grown_water",
        "label": "แหล่งน้ำที่ใช้ปลูกพืชผัก",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "interviewer_role",
        "label": "ตำแหน่งผู้สัมภาษณ์",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "well_id",
        "label": "รหัสทะเบียนแหล่งน้ำที่เชื่อม",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "q2_1",
        "label": "2Q ข้อ 1: หดหู่ เศร้า หรือท้อแท้สิ้นหวัง ใน 2 สัปดาห์รวมวันนี้",
        "type": "text",
        "required": false,
        "example": "ไม่ใช่",
        "note": "ใช่ / ไม่ใช่; เว้นว่างหมายถึงยังไม่ได้ตอบ ไม่ใช้คำว่าปกติแทนคำตอบ"
      },
      {
        "key": "q2_2",
        "label": "2Q ข้อ 2: เบื่อ ทำอะไรก็ไม่เพลิดเพลิน ใน 2 สัปดาห์รวมวันนี้",
        "type": "text",
        "required": false,
        "example": "ไม่ใช่",
        "note": "ใช่ / ไม่ใช่; เว้นว่างหมายถึงยังไม่ได้ตอบ ไม่ใช้คำว่าปกติแทนคำตอบ"
      },
      {
        "key": "date_2q",
        "label": "วันที่คัดกรอง 2Q ค.ศ. YYYY-MM-DD",
        "type": "date",
        "required": false,
        "example": "",
        "note": "ค.ศ. YYYY-MM-DD เช่น 2026-10-31; ปีงบประมาณคำนวณจากวันที่ (1 ต.ค. เริ่มปีถัดไป)"
      },
      {
        "key": "assessor_2q",
        "label": "ชื่อผู้ประเมิน 2Q",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "note_2q",
        "label": "หมายเหตุผล 2Q",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "fiscal_year",
        "label": "ปีงบประมาณ พ.ศ. กรอกเมื่อไม่มีวันที่",
        "type": "number",
        "required": false,
        "example": "",
        "note": "พ.ศ. เช่น 2569; สำหรับ AS-01/02 ต้องมีวันที่หรือปีนี้อย่างใดอย่างหนึ่ง; วันที่มีลำดับก่อน"
      },
      {
        "key": "total_score",
        "label": "คะแนนรวม ใช้เฉพาะข้อมูลสรุปเดิมที่ไม่มีคำตอบครบ",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ข้อมูลสรุปเดิมเท่านั้น; AS-01 ถ้ามีคำตอบครบ ระบบคำนวณใหม่; AS-02 ไม่สร้างคะแนนความเสี่ยงใหม่จากประวัติน้ำ"
      },
      {
        "key": "risk_level",
        "label": "ระดับความเสี่ยงตามต้นฉบับ ใช้เมื่อไม่มีคำตอบครบ",
        "type": "text",
        "required": false,
        "example": "",
        "note": "ข้อมูลสรุปเดิมเท่านั้น; AS-01 ถ้ามีคำตอบครบ ระบบคำนวณใหม่; AS-02 ไม่สร้างคะแนนความเสี่ยงใหม่จากประวัติน้ำ"
      },
      {
        "key": "drink_sources_other",
        "label": "รายละเอียดน้ำดื่มอื่นเพิ่มเติม",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "use_sources_other",
        "label": "รายละเอียดน้ำใช้อื่นเพิ่มเติม",
        "type": "text",
        "required": false,
        "example": "",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "drink_years",
        "label": "ระยะเวลาน้ำดื่มรวมจากข้อมูลรุ่นเก่า เก็บไว้ตามเดิม",
        "type": "text",
        "required": false,
        "example": "",
        "note": "สำหรับรับข้อมูลเก่าเท่านั้น ไม่กรอกสำหรับข้อมูลใหม่ ระบบไม่กระจายปีรวมไปแต่ละแหล่ง"
      },
      {
        "key": "use_years",
        "label": "ระยะเวลาน้ำใช้รวมจากข้อมูลรุ่นเก่า เก็บไว้ตามเดิม",
        "type": "text",
        "required": false,
        "example": "",
        "note": "สำหรับรับข้อมูลเก่าเท่านั้น ไม่กรอกสำหรับข้อมูลใหม่ ระบบไม่กระจายปีรวมไปแต่ละแหล่ง"
      },
      {
        "key": "notes",
        "label": "หมายเหตุ",
        "type": "text",
        "required": false,
        "example": "ข้อมูลสมมติสำหรับดูวิธีกรอกเท่านั้น",
        "note": "เว้นว่างได้เมื่อไม่มีข้อมูล"
      },
      {
        "key": "drink_years_1",
        "label": "จำนวนปีที่ดื่มน้ำจาก 1. บ่อน้ำตื้น",
        "type": "number",
        "required": false,
        "example": 10,
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "drink_years_2",
        "label": "จำนวนปีที่ดื่มน้ำจาก 2. บ่อน้ำตื้นมีเครื่องสูบ/มือโยก",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "drink_years_3",
        "label": "จำนวนปีที่ดื่มน้ำจาก 3. บ่อบาดาล",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "drink_years_4",
        "label": "จำนวนปีที่ดื่มน้ำจาก 4. น้ำผิวดิน",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "drink_years_5",
        "label": "จำนวนปีที่ดื่มน้ำจาก 5. ประปาหมู่บ้าน",
        "type": "number",
        "required": false,
        "example": 3,
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "drink_years_6",
        "label": "จำนวนปีที่ดื่มน้ำจาก 6. ประปาภูเขา",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "drink_years_7",
        "label": "จำนวนปีที่ดื่มน้ำจาก 7. น้ำฝน",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "drink_years_8_1",
        "label": "จำนวนปีที่ดื่มน้ำจาก 8.1. น้ำขวด/ถังผลิตในพื้นที่",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "drink_years_8_2",
        "label": "จำนวนปีที่ดื่มน้ำจาก 8.2. น้ำขวด/ถังผลิตนอกพื้นที่",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "drink_years_9",
        "label": "จำนวนปีที่ดื่มน้ำจาก 9. แม่น้ำที่ปนเปื้อนฯ",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "use_years_1",
        "label": "จำนวนปีที่ใช้น้ำจาก 1. บ่อน้ำตื้น",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "use_years_2",
        "label": "จำนวนปีที่ใช้น้ำจาก 2. บ่อน้ำตื้นมีเครื่องสูบ/มือโยก",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "use_years_3",
        "label": "จำนวนปีที่ใช้น้ำจาก 3. บ่อบาดาล",
        "type": "number",
        "required": false,
        "example": 6,
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "use_years_4",
        "label": "จำนวนปีที่ใช้น้ำจาก 4. น้ำผิวดิน",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "use_years_5",
        "label": "จำนวนปีที่ใช้น้ำจาก 5. ประปาหมู่บ้าน",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "use_years_6",
        "label": "จำนวนปีที่ใช้น้ำจาก 6. ประปาภูเขา",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "use_years_7",
        "label": "จำนวนปีที่ใช้น้ำจาก 7. น้ำฝน",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "use_years_8_1",
        "label": "จำนวนปีที่ใช้น้ำจาก 8.1. น้ำขวด/ถังผลิตในพื้นที่",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "use_years_8_2",
        "label": "จำนวนปีที่ใช้น้ำจาก 8.2. น้ำขวด/ถังผลิตนอกพื้นที่",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      },
      {
        "key": "use_years_9",
        "label": "จำนวนปีที่ใช้น้ำจาก 9. แม่น้ำที่ปนเปื้อนฯ",
        "type": "number",
        "required": false,
        "example": "",
        "note": "ปีของแหล่งนี้เท่านั้น; ทศนิยมได้; 0 เป็นค่าจริง; เว้นว่างถ้ายังไม่ทราบ; เมื่อระบุปี ระบบเลือกแหล่งนี้ด้วย"
      }
    ]
  }
};

function parseCsvRows(text) {
  const rows=[];let row=[],cell='',quoted=false;
  text=String(text).replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(ch==='"') {
      if(quoted&&text[i+1]==='"'){cell+='"';i++;}
      else if(quoted||cell==='')quoted=!quoted;
      else throw Error('เครื่องหมายอัญประกาศต้องอยู่ต้นช่องข้อมูล');
    } else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(quoted)throw Error('มีข้อความในเครื่องหมายอัญประกาศที่ยังไม่ปิด');
  row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row);
  return rows;
}
function downloadTemplateCsv(type) {
  const schema=IMPORT_SCHEMAS[type];if(!schema)return;
  csvFile(`template_import_${type}.csv`,schema.fields.map(f=>f.key),[schema.fields.map(f=>f.example)]);
}
function validateImportDate(value,key,row) {
  if(!value)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!fiscalYearFromDate(value)||Number(value.slice(0,4))>2400)
    throw Error(`แถว ${row}: ${key} ต้องเป็นวันที่จริง ค.ศ. YYYY-MM-DD`);
}
function buildImportRecords(type,text,existingState=state) {
  const schema=IMPORT_SCHEMAS[type];if(!schema)throw Error('ไม่รู้จักประเภทข้อมูล');
  const rows=parseCsvRows(text);if(rows.length<2)throw Error('ไฟล์ต้องมีหัวคอลัมน์และข้อมูลอย่างน้อย 1 แถว');
  const headers=rows.shift().map(h=>h.trim());
  if(new Set(headers).size!==headers.length)throw Error('หัวคอลัมน์ซ้ำ');
  const known=new Set(schema.fields.map(f=>f.key));
  const unknown=headers.filter(h=>!known.has(h));if(unknown.length)throw Error('ไม่รู้จักคอลัมน์: '+unknown.join(', '));
  for(const field of schema.fields.filter(f=>f.required))if(!headers.includes(field.key))throw Error('ขาดหัวคอลัมน์ '+field.key);
  const records=[],duplicates=[],seen=new Set();
  for(let i=0;i<rows.length;i++) {
    const values=rows[i],line=i+2;if(values.length!==headers.length)throw Error(`แถว ${line}: จำนวนช่องไม่ตรงกับหัวคอลัมน์ (ตรวจจุลภาค/อัญประกาศ)`);
    const r={};headers.forEach((h,j)=>r[h]=values[j].trim());
    for(const field of schema.fields) {
      const value=r[field.key]??'';
      if(field.required&&!value)throw Error(`แถว ${line}: ต้องกรอก ${field.key}`);
      if(field.type==='number'&&value!=='') {
        if(!Number.isFinite(Number(value))||Number(value)<0)throw Error(`แถว ${line}: ${field.key} ต้องเป็นจำนวนไม่ติดลบ`);
        r[field.key]=Number(value);
      }
      if(field.type==='binary'&&value!=='') {
        if(!['0','1'].includes(value))throw Error(`แถว ${line}: ${field.key} ใช้ 0 หรือ 1 เท่านั้น`);
        r[field.key]=Number(value);
      }
      if(field.type==='date')validateImportDate(value,field.key,line);
    }
    for(const key of ['q2_1','q2_2'])if(r[key]&&!['ใช่','ไม่ใช่'].includes(r[key]))throw Error(`แถว ${line}: ${key} ใช้ ใช่ / ไม่ใช่`);
    if(type==='as01'||type==='as02') {
      const stage=type==='as02'?2:1,dateKey=stage===2?'interview_date':'survey_date';
      if(!r[dateKey]&&!r.fiscal_year)throw Error(`แถว ${line}: ระบุ ${dateKey} หรือ fiscal_year เพื่อเลือกปีงบประมาณ`);
      r.fiscal_year=fiscalYearFromDate(r[dateKey])||r.fiscal_year;
      if(!Number.isInteger(r.fiscal_year)||r.fiscal_year<2400||r.fiscal_year>3000)throw Error(`แถว ${line}: fiscal_year ต้องเป็นปี พ.ศ.`);
      r.source_tab=(stage===2?'เก็บแม่อาย':'ประเมินแม่อาย')+' '+r.fiscal_year;
      r.source_year=r.fiscal_year;r.dataset=stage===2?'collection':'assessment';r.status_2q=screening2QResult(r.q2_1,r.q2_2);
      if(r.well_id&&!existingState.wells.some(w=>w.well_id===r.well_id))throw Error(`แถว ${line}: ไม่พบทะเบียนแหล่งน้ำ ${r.well_id}`);
      if(type==='as01') {
        const complete=Array.from({length:11},(_,j)=>r['q'+(j+1)]).every(v=>v!==''&&v!==undefined&&v!==null&&[0,1].includes(v));
        r.assessment_complete=complete;
        if(complete){r.total_score=Array.from({length:11},(_,j)=>(r['q'+(j+1)]||0)*ENV_WEIGHTS['q'+(j+1)]).reduce((a,b)=>a+b,0);r.risk_level=riskFromAssessmentScore(r.total_score);}
        else{r.total_score=optionalNumber(r.total_score);r.risk_level=r.risk_level||'ไม่ระบุ';}
      } else {
        for(const kind of ['drink','use']) {
          const history=parseWaterSourceHistory(r,kind);
          for(const [id] of AS02_WATER_SOURCES){const key=`${kind}_years_${id.replace('.','_')}`;if(r[key]!==undefined&&r[key]!=='')history.years[id]=r[key];delete r[key];}
          r[kind+'_source_years']=history.years;
          r[kind+'_sources_other']=[history.extra,r[kind+'_sources_other']].filter(Boolean).join(', ');
          r[kind+'_sources']=formatWaterSources(r,kind);
        }
        if(r.respondent_id&&!existingState.respondents.some(a=>a.id===r.respondent_id))throw Error(`แถว ${line}: ไม่พบ respondent_id ที่ระบุ`);
        r.as01_auto_link_disabled=!r.respondent_id;
        r.history_updated=true;r.history_complete=Boolean(r.interview_date&&r.interviewer_name);
      }
    } else if(type==='wells') {
      const has=v=>v!==undefined&&v!==null&&v!=='';
      if(has(r.latitude)!==has(r.longitude)||has(r.utm_e)!==has(r.utm_n))throw Error(`แถว ${line}: ต้องกรอกพิกัดให้ครบคู่`);
      if(!has(r.latitude)&&has(r.utm_e)){const geo=utm47NToLatLng(r.utm_e,r.utm_n);r.latitude=geo.lat;r.longitude=geo.lng;r.coordinate_basis='UTM 47N/WGS84 ตามข้อมูลนำเข้า';}
      if(has(r.latitude)&&(r.latitude>90||r.longitude>180))throw Error(`แถว ${line}: พิกัดอยู่นอกช่วงที่ใช้ได้`);
    } else if(type==='waterlab') {
      if(r.standard_type&&!['DOH_2543','WHO_1984','RURAL','SOURCE_SSO'].includes(r.standard_type))throw Error(`แถว ${line}: ไม่รู้จัก standard_type`);
      if(!r.standard_type)r.standard_type='DOH_2543';
      if(r.well_id&&!existingState.wells.some(w=>w.well_id===r.well_id))throw Error(`แถว ${line}: ไม่พบทะเบียนแหล่งน้ำ ${r.well_id}`);
      for(const p of WATER_LAB_PARAMS)if(r[p.key]&&parseReportedValue(r[p.key]).type==='invalid')throw Error(`แถว ${line}: รูปแบบผลตรวจ ${p.key} ไม่ถูกต้อง`);
      r.fiscal_year=fiscalYearFromDate(r.sample_date)||Number(existingState.fiscalYear);
      const e=evaluateWaterLabRecord(r);r.overall_status=e.overallStatus;r.failed_params=e.failedNames.join(', ');
    }
    const collection=type==='wells'?existingState.wells:type==='waterlab'?existingState.waterLabs:type==='as01'?existingState.respondents:existingState.envAs02;
    const primary=type==='wells'?'well_id':type==='waterlab'?'sample_code':type==='as01'?'code':'form_no';
    const duplicateKey=[r[primary],r.fiscal_year||'',type==='waterlab'?r.sample_date||'':''].join('|');
    if(seen.has(duplicateKey)||collection.some(x=>String(x[primary]??'')===String(r[primary])&&(type==='wells'||(type==='waterlab'?String(x.sample_date||'')===String(r.sample_date||''):recordFiscalYear(x,type==='as02'?2:1)===r.fiscal_year)))){duplicates.push(line);continue;}
    seen.add(duplicateKey);
    r.id=type==='wells'?undefined:`IMPORT-${type}-${Date.now()}-${i}`;if(type==='wells')delete r.id;
    r.seq=collection.length+records.length+1;r.recorded_at=new Date().toISOString();r.updated_at=r.recorded_at;r.date_basis='imported';
    records.push(type==='wells'?normalizeWellRecord(r,r.seq-1):r);
  }
  return {records,duplicates};
}
async function handleBulkImport(type) {
  if(!state.cloudToken||!state.dataLoaded){alert('กรุณาเข้าสู่ระบบและโหลดข้อมูลส่วนกลางก่อนนำเข้า');return;}
  const importEpoch=state.sessionEpoch;
  const input=document.getElementById('import-file-'+type),file=input?.files?.[0];if(!file){alert('กรุณาเลือกไฟล์ CSV ก่อน');return;}
  try {
    const csvContent=await file.text();
    if(importEpoch!==state.sessionEpoch)return;
    const {records,duplicates}=buildImportRecords(type,csvContent);
    const collection=type==='wells'?state.wells:type==='waterlab'?state.waterLabs:type==='as01'?state.respondents:state.envAs02;
    collection.push(...records);saveLocalData();
    const action=type==='wells'?'saveWell':type==='waterlab'?'saveWaterLab':type==='as01'?'saveRespondent':'saveEnvAs02';
    for(const record of records){if(importEpoch!==state.sessionEpoch)return;await postToGoogleSheets({action,data:record});}
    if(importEpoch!==state.sessionEpoch)return;
    alert(`ประมวลผลนำเข้า ${records.length} รายการ${duplicates.length?' ข้ามรหัสซ้ำ '+duplicates.length+' รายการ':''} ${pendingCloudWrites().length?"ยังมีรายการรอส่งส่วนกลาง กรุณากดส่งรายการรอส่ง":"Google Sheets ยืนยันรายการที่ส่งสำเร็จแล้ว"}`);
    input.value='';
  }catch(error){alert('ยังไม่นำเข้าข้อมูล: '+error.message);}
}
function exportTemplateRecord(type,record) {
  const r={...record};
  if(type==='as02')for(const kind of ['drink','use']) {
    const history=parseWaterSourceHistory(r,kind);r[kind+'_sources']=formatWaterSources(r,kind);
    // The combined text carries unknown/free text. Do not duplicate it in a second column.
    r[kind+'_sources_other']='';
    for(const [id] of AS02_WATER_SOURCES)r[`${kind}_years_${id.replace('.','_')}`]=history.years[id]??'';
  }
  return IMPORT_SCHEMAS[type].fields.map(f=>r[f.key]??'');
}
