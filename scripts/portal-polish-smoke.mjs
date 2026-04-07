import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const WEB_URL = process.env.FITFLOW_WEB_URL || "http://localhost:6173";
const API_URL = process.env.FITFLOW_API_URL || "http://localhost:6273/api";
const TENANT_KEY = process.env.FITFLOW_TENANT_KEY || "MASTER";
const IDENTIFIER = process.env.FITFLOW_IDENTIFIER || "admin@fitflow.local";
const PASSWORD = process.env.FITFLOW_PASSWORD || "Admin@123";
const outputDirName = process.env.FITFLOW_OUTPUT_DIR_NAME || "medium-traffic-polish-smoke";

const outputDir = path.join(repoRoot, ".tmp", outputDirName);
const screenshotDir = path.join(outputDir, "screenshots");
const outputPath = path.join(outputDir, "results.json");

const selectedRouteFilters = String(process.env.FITFLOW_ROUTE_FILTER || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const scenarios = [
  {
    route: "/members/customer-sources",
    pageTexts: [
      "Nguon khach hang",
      "Danh muc nguon khach tu referral, walk-in, social, ads va CRM hoi vien.",
      "Ma nguon",
      "Nhom kenh",
    ],
    detailTexts: ["Nhom kenh", "Mo ta", "Ngay tao", "Cap nhat lan cuoi"],
    forbiddenTexts: ["s o c i a l", "o f f l i n e", "r e f e r r a l"],
  },
  {
    route: "/settings/attendance-machines",
    pageTexts: [
      "Quan ly may cham cong",
      "Thiet bi cham cong, cong ket noi, IP / Domain va trang thai dong bo.",
      "Cong ket noi",
      "So su kien",
      "Lan dong bo cuoi",
    ],
    detailTexts: ["Trang thai dong bo", "Mat khau thiet bi", "Cau hinh ket noi", "Bao tri", "Su kien gan day", "Ket noi thiet bi", "Dong bo du lieu"],
    detailTabs: ["Cau hinh ket noi", "Su kien gan day"],
    forbiddenTexts: ["lan sync cuoi", "password status", "last synced date time"],
  },
  {
    route: "/roles",
    pageTexts: ["Vai tro", "Vai tro, mo ta va ma tran quyen.", "So nguoi dung"],
    detailTexts: ["Loai vai tro", "So nguoi dung", "Ma tran quyen", "Nguoi dung"],
    forbiddenTexts: ["so user", "danh sach quyen"],
  },
  {
    route: "/class-schedule/line-layout",
    pageTexts: [
      "So do line / phong",
      "Bo tri line, phong tap, suc chua va quy tac dat lich theo chi nhanh.",
      "Ma chi nhanh",
      "Chi nhanh / so do",
      "Khung gio hoat dong",
      "Luot dat/ngay",
      "Yeu cau coc",
      "Nhan vien",
      "May cham cong",
    ],
    detailTexts: ["Khung gio hoat dong", "Van hanh", "Dat lich / coc"],
    detailTabs: ["Van hanh"],
    forbiddenTexts: ["quy tac coc"],
  },
  {
    route: "/class-schedule/line-categories",
    pageTexts: [
      "Danh muc Line",
      "Danh muc line, loai lop, khu vuc va cau hinh van hanh phong tap.",
      "Ma line",
      "Ten line",
      "So lop",
      "Dang mo",
    ],
    detailTexts: ["Danh muc line", "Danh sach lop", "Loai line", "Gia mac dinh", "So lop", "Luot dung"],
    detailTabs: ["Danh muc line", "Danh sach lop"],
    forbiddenTexts: ["goi dich vu", "default price", "package count", "active package count"],
  },
  {
    route: "/class-schedule/line-schedule",
    pageTexts: [
      "Lich Line",
      "Phan bo lich theo line, line booking va cong suat phong tap.",
      "Ma lich",
      "Line / Khu vuc",
      "Huong dan",
      "Booking",
      "Dinh kem",
    ],
    detailTexts: ["Van hanh line", "Booking / diem danh", "Lich line", "Line / Khu vuc", "So booking", "So nguoi co mat"],
    detailTabs: ["Van hanh line", "Booking / diem danh"],
    forbiddenTexts: ["thong tin buoi tap", "dia diem", "so ban ghi diem danh"],
  },
  {
    route: "/class-schedule/bookings",
    pageTexts: ["Danh sach book lich", "Ma booking", "Hoi vien", "PT phu trach", "Line / Khu vuc", "Dinh kem"],
    detailTexts: ["Thong tin booking", "Diem danh", "Lich dat", "Hoi vien", "Ma hop dong", "So tep dinh kem"],
    detailTabs: ["Thong tin booking", "Diem danh"],
    forbiddenTexts: ["thong tin buoi tap", "scheduled date time", "customer name", "contract package name", "duration minutes"],
  },
  {
    route: "/class-schedule/classes",
    pageTexts: ["Danh sach lop", "Ma lop", "Ten lop", "Dich vu", "Nhom line", "So dang ky"],
    detailTexts: ["Cau hinh lop", "Dang ky", "Dich vu", "Loai goi", "Tong buoi", "So dang ky"],
    detailTabs: ["Cau hinh lop", "Dang ky"],
    forbiddenTexts: ["dich vu cha", "service name", "package type", "session count", "bonus sessions", "contract count", "remaining value rule"],
  },
  {
    route: "/class-schedule/timetable",
    pageTexts: ["Lich lop", "Ma lich", "Huong dan", "Booking chinh", "Line / Phong", "Diem danh"],
    detailTexts: ["Van hanh lop", "Diem danh", "Khung gio", "Booking chinh", "So nguoi co mat", "So tep dinh kem"],
    detailTabs: ["Van hanh lop", "Diem danh"],
    forbiddenTexts: ["thong tin buoi tap", "scheduled date time", "customer name", "contract package name", "duration minutes"],
  },
  {
    route: "/class-schedule/group-pt",
    pageTexts: ["Lich PT nhom", "Ma lich", "PT", "Khu vuc", "So booking", "Tru buoi"],
    detailTexts: ["Thong tin PT nhom", "Diem danh", "Lich PT nhom", "So booking", "Tru buoi", "So nguoi co mat"],
    detailTabs: ["Thong tin PT nhom", "Diem danh"],
    forbiddenTexts: ["thong tin buoi tap", "scheduled date time", "customer name", "contract package name", "duration minutes"],
  },
  {
    route: "/class-schedule/booking-attachments",
    pageTexts: [
      "Dinh kem Booking",
      "Tra cuu booking va file dinh kem phat sinh trong qua trinh van hanh lop / PT.",
      "Ma booking",
      "Hoi vien",
      "PT",
      "So tep",
      "Diem danh",
    ],
    detailTexts: ["Ho so booking", "Tai lieu", "Hoi vien", "PT phu trach", "Ma hop dong", "So tep dinh kem"],
    detailTabs: ["Ho so booking", "Tai lieu"],
    forbiddenTexts: ["thong tin buoi tap", "attachment count", "duration minutes", "customer name"],
  },
  {
    route: "/class-schedule/cskh-booking",
    pageTexts: [
      "Booking CSKH",
      "Theo doi booking phat sinh tu CSKH, lich hen va nhac viec cham soc.",
      "Tong dau viec",
      "Qua han",
      "Co lich hen",
      "Ten lead",
      "Nhan vien phu trach",
      "Lan cham soc toi",
      "Muc uu tien",
    ],
    forbiddenTexts: ["Bao cao Follow-up", "Cong viec follow-up, lich hen va canh bao qua han."],
    skipDetail: true,
  },
  {
    route: "/members/customers",
    pageTexts: [
      "Hoi vien / khach hang",
      "Ho so hoi vien, trang thai, cong no, lich su mua goi va thong tin lien he.",
      "Ma hoi vien",
      "Thong tin hoi vien",
      "NV phu trach",
      "So ho so",
      "Cong no",
    ],
    detailTexts: ["Lich su", "Hop dong", "Phieu thu", "Buoi tap", "Trang thai hoi vien", "Cong no", "So hop dong"],
    detailTabs: ["Lich su", "Hop dong", "Phieu thu", "Buoi tap"],
    forbiddenTexts: ["Khach hang / Hoi vien", "Thong tin khach hang"],
  },
  {
    route: "/members/leads",
    pageTexts: [
      "Ho so Lead",
      "Danh sach lead, pipeline, lich hen va lich su cham soc.",
      "Ma lead",
      "Thong tin lead",
      "Nguon lead",
      "Nhan vien phu trach",
      "Tinh trang follow-up",
      "Hen tiep theo",
    ],
    detailTexts: ["Lich su cham soc", "Chuyen doi", "Tinh trang follow-up", "Hen tiep theo", "Muc do tiem nang"],
    detailTabs: ["Lich su cham soc", "Chuyen doi"],
    forbiddenTexts: ["Lead / CRM", "Pipeline lead, lich hen, nguon lead va ket qua cham soc."],
  },
  {
    route: "/members/status",
    pageTexts: [
      "Trang thai hoi vien",
      "Theo doi hoi vien dang hoat dong, tiem nang, ngung hoat dong va cac canh bao lien quan.",
      "Hoi vien",
      "Trang thai",
      "Bat dau tap",
      "Het han tap",
      "Cong no",
      "Thong tin khac",
    ],
    detailTexts: ["Lich su", "Hop dong", "Phieu thu", "Buoi tap", "Trang thai hoi vien", "Cong no"],
    detailTabs: ["Lich su", "Hop dong", "Phieu thu", "Buoi tap"],
    forbiddenTexts: ["Khach hang / Hoi vien", "Thong tin khach hang"],
  },
  {
    route: "/members/debt",
    pageTexts: [
      "Cong no hoi vien",
      "Tong hop hop dong con no, gia tri con lai va nhac viec can thu.",
      "Tong GT con lai",
      "Tong cong no",
      "Ma hop dong",
      "Khach hang",
      "Gia tri goc",
      "So tien con no",
    ],
    forbiddenTexts: ["Gia tri hop dong con lai", "Gia tri goc, gia tri da dung, gia tri con lai va cong no."],
    skipDetail: true,
  },
  {
    route: "/members/birthday",
    pageTexts: [
      "Sinh nhat hoi vien",
      "Lich nhac sinh nhat, doi tuong can CSKH va thong tin hoi vien dang hoat dong.",
      "Sap toi",
      "Hom nay",
      "Tuan nay",
      "Hoi vien active",
    ],
    forbiddenTexts: ["Danh sach sinh nhat sap toi de CSKH chu dong cham soc va gui uu dai."],
    skipDetail: true,
  },
  {
    route: "/members/customer-groups",
    pageTexts: ["Nhom khach hang", "Danh muc phan nhom hoi vien, VIP va doanh nghiep.", "Ma nhom", "Ngay tao"],
    detailTexts: ["Mo ta", "Ngay tao", "Cap nhat lan cuoi"],
    forbiddenTexts: ["created at", "updated at"],
  },
  {
    route: "/operations/lockers",
    pageTexts: ["Tu do", "Theo doi tinh trang tu do, khach dang thue, tien coc va lich su su dung.", "Nhan tu", "Khach dang thue", "Luot thue mo"],
    detailTexts: ["Khach dang thue", "Ma thue hien tai", "Tong luot thue", "Thong tin thue"],
    detailTabs: ["Thong tin thue"],
    forbiddenTexts: ["current rental code", "current customer name", "rental count", "active rental count"],
  },
  {
    route: "/operations/service-registration",
    pageTexts: [
      "Dang ky dich vu",
      "Mo hop dong moi, dang ky goi tap va lien ket thanh toan hoi vien.",
      "Ma dang ky",
      "Hoi vien",
      "Goi dang ky",
      "Sale phu trach",
      "Tong tien",
      "Con no",
    ],
    detailTexts: [
      "Ho so dang ky",
      "Lich su dang ky",
      "Thanh toan",
      "Goi dang ky",
      "Lich tap",
      "Dieu chinh hop dong",
      "Sale phu trach",
      "PT phu trach",
      "Thoi han goi",
    ],
    detailTabs: ["Ho so dang ky", "Lich su dang ky", "Thanh toan", "Goi dang ky", "Lich tap", "Dieu chinh hop dong"],
    forbiddenTexts: ["hang muc"],
  },
  {
    route: "/operations/contract-renewal",
    pageTexts: [
      "Gia han hop dong",
      "Danh sach hop dong sap het han va xu ly gia han / tiep tuc goi tap.",
      "Ma hop dong",
      "Goi hien tai",
      "Buoi con lai",
      "Ngay con lai",
      "Ngay het han",
      "Sale phu trach",
      "PT phu trach",
    ],
    detailTexts: [
      "Ho so gia han",
      "Lich su gia han",
      "Thanh toan",
      "Goi hien tai",
      "Lich tap",
      "Dieu chinh hop dong",
      "Ky han hop dong",
      "Sale phu trach",
      "PT phu trach",
    ],
    detailTabs: ["Ho so gia han", "Lich su gia han", "Thanh toan", "Goi hien tai", "Lich tap", "Dieu chinh hop dong"],
    forbiddenTexts: ["hang muc"],
  },
  {
    route: "/operations/service-price-book",
    pageTexts: [
      "Bang gia dich vu",
      "Bang gia membership, PT, combo, buoi KM va quy tac gia tri con lai.",
      "Ma goi",
      "Ten goi",
      "Phan loai goi",
      "Gia ban",
      "So dang ky",
    ],
    detailTexts: [
      "Thong tin bang gia",
      "Dang ky su dung",
      "Phan loai goi",
      "Cau hinh buoi",
      "Gia ban",
      "So dang ky",
    ],
    detailTabs: ["Thong tin bang gia", "Dang ky su dung"],
    forbiddenTexts: ["dich vu cha"],
  },
  {
    route: "/operations/contract-upgrade",
    pageTexts: [
      "Nang cap hop dong",
      "Nang cap goi tap, cap nhat gia chenh lech va Quy doi so buoi.",
      "Ma hop dong",
      "Goi hien tai",
      "Hop dong tham chieu",
      "Gia tri con lai",
      "Tong giam",
      "Tong tien",
    ],
    detailTexts: [
      "Ho so nang cap",
      "Lich su nang cap",
      "Thanh toan",
      "Hang muc nang cap",
      "Lich tap",
      "Quy doi / chenh lech",
      "Hop dong tham chieu",
      "Gia tri goc",
    ],
    detailTabs: ["Ho so nang cap", "Lich su nang cap", "Thanh toan", "Hang muc nang cap", "Lich tap", "Quy doi / chenh lech"],
    forbiddenTexts: ["hd tham chieu", "gt con lai"],
  },
  {
    route: "/operations/contract-freeze",
    pageTexts: [
      "Bao luu hop dong",
      "Theo doi hop dong tam dung, bao luu va ngay kich hoat lai.",
      "Ma hop dong",
      "Hoi vien",
      "Goi tam dung",
      "Bat dau bao luu",
      "Ket thuc bao luu",
      "Buoi con lai",
    ],
    detailTexts: [
      "Thong tin bao luu",
      "Lich su bao luu",
      "Thanh toan",
      "Goi tam dung",
      "Lich tap",
      "Dieu chinh hop dong",
      "Bat dau bao luu",
      "Ket thuc bao luu",
    ],
    detailTabs: ["Thong tin bao luu", "Lich su bao luu", "Thanh toan", "Goi tam dung", "Lich tap", "Dieu chinh hop dong"],
    forbiddenTexts: [],
  },
  {
    route: "/operations/contract-transfer",
    pageTexts: [
      "Chuyen nhuong hop dong",
      "Chuyen nhuong / doi chu hop dong va lich su dieu chinh lien quan.",
      "Ma hop dong",
      "Chu hop dong",
      "Goi dang chuyen",
      "Hop dong goc",
      "Buoi con lai",
      "GT con lai",
    ],
    detailTexts: [
      "Ho so chuyen nhuong",
      "Lich su chuyen nhuong",
      "Thanh toan",
      "Goi dang chuyen",
      "Lich tap",
      "Dieu chinh hop dong",
      "Chu hop dong",
      "Hop dong goc",
    ],
    detailTabs: ["Ho so chuyen nhuong", "Lich su chuyen nhuong", "Thanh toan", "Goi dang chuyen", "Lich tap", "Dieu chinh hop dong"],
    forbiddenTexts: ["hang muc"],
  },
  {
    route: "/operations/branch-transfer",
    pageTexts: [
      "Chuyen chi nhanh",
      "Theo doi hoi vien, hop dong va giao dich duoc dieu chuyen giua cac chi nhanh.",
      "Ma hop dong",
      "Chi nhanh hien tai",
      "Hoi vien",
      "Goi dang tap",
      "Sale phu trach",
      "PT phu trach",
    ],
    detailTexts: [
      "Thong tin dieu chuyen",
      "Lich su dieu chuyen",
      "Thanh toan",
      "Goi dang tap",
      "Lich tap",
      "Dieu chinh hop dong",
      "Chi nhanh hien tai",
      "PT phu trach",
    ],
    detailTabs: ["Thong tin dieu chuyen", "Lich su dieu chuyen", "Thanh toan", "Goi dang tap", "Lich tap", "Dieu chinh hop dong"],
    forbiddenTexts: ["hang muc"],
  },
  {
    route: "/operations/contract-conversion",
    pageTexts: [
      "Chuyen doi hop dong",
      "Xu ly chuyen doi goi, quy doi gia tri con lai va cap nhat lich su.",
      "Ma hop dong",
      "Hoi vien",
      "Goi hien tai",
      "Hop dong cu",
      "Buoi con lai",
      "GT con lai",
    ],
    detailTexts: [
      "Ho so chuyen doi",
      "Lich su chuyen doi",
      "Thanh toan",
      "Goi chuyen doi",
      "Lich tap",
      "Quy doi / chenh lech",
      "Hop dong cu",
    ],
    detailTabs: ["Ho so chuyen doi", "Lich su chuyen doi", "Thanh toan", "Goi chuyen doi", "Lich tap", "Quy doi / chenh lech"],
    forbiddenTexts: ["hang muc"],
  },
  {
    route: "/operations/contract-cancel",
    pageTexts: [
      "Huy hop dong",
      "Danh sach hop dong huy / dong va lich su thao tac lien quan.",
      "Chua co hop dong huy",
      "Bo loc hien tai chua co hop dong nao duoc huy. Hay dieu chinh bo loc hoac lap giao dich huy moi.",
    ],
    forbiddenTexts: [],
    skipDetail: true,
  },
  {
    route: "/staff/attendance-adjustments",
    pageTexts: ["Dieu chinh cham cong", "Them, sua, xoa su kien vao/ra, doi nguon du lieu va theo doi lich su audit cho HR.", "Loai su kien", "Ma NV"],
    detailTexts: ["Thong tin cham cong", "Ma cham cong", "Ten dang nhap", "Ma nhan vien", "Ma cham cong"],
    detailTabs: ["Thong tin cham cong"],
    forbiddenTexts: ["staff code", "attendance code", "event date time", "machine name"],
  },
  {
    route: "/staff/exercise-library",
    pageTexts: [
      "Danh muc bai tap",
      "Thu vien bai tap, dung cu tap va tai nguyen ho tro PT trien khai giao an.",
      "Ma bai tap",
      "Ten bai tap / dung cu",
      "Danh muc",
      "Nhom",
      "So luong",
    ],
    detailTexts: ["Thong tin bai tap", "Cap phat / bo sung", "Nhom bai tap", "So luong san sang", "Canh bao dung cu"],
    detailTabs: ["Thong tin bai tap", "Cap phat / bo sung"],
    forbiddenTexts: ["ton kho", "lich su nhap", "purchase price", "sale price", "stock quantity", "stock alert label"],
  },
  {
    route: "/staff/stages",
    pageTexts: [
      "Danh sach Stage",
      "Quan ly stage, cap do, nhom phu trach va mo ta quy trinh huan luyen.",
      "Ma stage",
      "Ten stage",
      "Loai",
      "So nhan vien",
      "So quyen",
    ],
    detailTexts: ["Loai stage", "Quy trinh stage", "Moc quy trinh", "Nhan su phu trach", "Nhan su dang gan", "So moc"],
    detailTabs: ["Quy trinh stage", "Moc quy trinh", "Nhan su phu trach"],
    forbiddenTexts: ["ma tran quyen", "role type", "permission count", "user count"],
  },
  {
    route: "/staff/programs",
    pageTexts: [
      "Giao an",
      "Danh sach giao an, huan luyen vien phu trach va tai nguyen lien quan.",
      "Ma giao an",
      "PT phu trach",
      "Hoc vien dang theo",
      "Lich sap toi",
      "Da hoan thanh",
    ],
    detailTexts: ["Thong tin giao an", "Hoc vien dang theo", "Lich ap dung", "PT phu trach", "Buoi tiep theo"],
    detailTabs: ["Thong tin giao an", "Hoc vien dang theo", "Lich ap dung"],
    forbiddenTexts: ["lich va tai trong", "hop dong dang mo", "buoi tap", "active contract count", "completed session count"],
  },
  {
    route: "/settings/audit-logs",
    pageTexts: ["Lich su thao tac", "Lich su thao tac, dang nhap, xuat file va cap nhat cau hinh he thong.", "Mo-dun", "Doi tuong", "Ma tham chieu"],
    detailTexts: ["Mo-dun", "Hanh dong", "Doi tuong", "Thong tin audit", "Du lieu thay doi"],
    detailTabs: ["Thong tin audit", "Du lieu thay doi"],
    forbiddenTexts: ["entity type", "before data", "after data", "metadata"],
  },
  {
    route: "/deposits",
    pageTexts: ["Tien coc", "Theo doi coc giu do, coc tu do va tinh trang hoan coc.", "Khach nop coc", "Ma thue tu", "Loai coc"],
    detailTexts: ["Loai coc", "Khach nop coc", "Ma thue tu", "Thong tin coc", "Thoi gian nhan", "Thoi gian tra"],
    detailTabs: ["Thong tin coc"],
    forbiddenTexts: ["locker_deposit", "item type", "received at", "returned at", "locker rental code"],
  },
  {
    route: "/dashboard",
    pageTexts: [
      "Tong quan he thong",
      "Tong hop hoi vien, hop dong, lead, doanh thu, cong no va canh bao van hanh theo chi nhanh.",
      "Hoi vien dang hoat dong",
      "Hop dong hieu luc",
      "Doanh thu hom nay",
      "Doanh thu thang",
      "Lead moi",
      "Lead da chuyen doi",
      "Cong no can thu",
      "Doanh thu theo chi nhanh",
      "Hoi vien moi 7 ngay gan nhat",
      "Lead theo nguon",
      "Nhac viec can xu ly",
      "Top nhan vien ban hang",
      "Hoat dong gan day",
    ],
    forbiddenTexts: [
      "Dashboard tong quan",
      "Tong hop van hanh he thong.",
      "Dashboard gap loi",
      "Khong tai duoc du lieu dashboard. Hay kiem tra API, seed data va phien dang nhap.",
    ],
    skipDetail: true,
  },
  {
    route: "/overview/kpi",
    pageTexts: [
      "Dashboard KPI ngay / thang",
      "Theo doi lead, hop dong, doanh thu va % KPI tren mot man hinh tong hop.",
      "Tong doanh thu",
      "Tong hop dong",
      "Ma nhan vien",
      "Nhan vien",
      "Hop dong moi",
      "Lead moi",
      "Lead chuyen doi",
      "Doanh thu thuc thu",
      "Muc dat KPI",
    ],
    forbiddenTexts: ["Bao cao KPI", "Lead, hop dong, doanh thu va % KPI theo nhan vien.", "actual revenue", "new contracts", "kpi percent"],
    skipDetail: true,
  },
  {
    route: "/overview/branch-revenue",
    pageTexts: [
      "Doanh thu theo chi nhanh",
      "So sanh doanh thu membership, PT, coc va cac nguon thu giua cac chi nhanh.",
      "Tong doanh thu",
      "Chi nhanh",
      "Doanh thu Hoi vien",
      "Doanh thu PT",
      "Doanh thu coc",
    ],
    forbiddenTexts: ["Doanh thu chi nhanh", "Tong hop doanh thu theo chi nhanh va loai dich vu."],
    skipDetail: true,
  },
  {
    route: "/overview/birthday",
    pageTexts: [
      "Sinh nhat hoi vien",
      "Danh sach hoi vien sap sinh nhat de CSKH chu dong chuc mung va gui uu dai.",
      "Sap toi",
      "Hom nay",
      "Tuan nay",
      "Hoi vien active",
      "Ma hoi vien",
      "Hoi vien",
      "Ngay sinh",
      "Sinh nhat toi",
      "Con bao nhieu ngay",
      "Tuoi sap toi",
      "Trang thai hoi vien",
      "Cong no",
    ],
    forbiddenTexts: [
      "Danh sach sinh nhat sap toi de CSKH chu dong cham soc va gui uu dai.",
      "Lich nhac sinh nhat, doi tuong can CSKH va thong tin hoi vien dang hoat dong.",
    ],
    skipDetail: true,
  },
  {
    route: "/overview/lead",
    pageTexts: [
      "Bao cao Lead",
      "Tong hop lead, nguon lead, nhan vien phu trach va ty le chuyen doi.",
      "Tong lead",
      "Lead moi",
      "Da chuyen doi",
      "Ma lead",
      "Ten lead",
      "Nguon lead",
      "Trang thai lead",
      "Do nong",
      "Nhan vien phu trach",
      "Lan cham soc toi",
    ],
    forbiddenTexts: ["Tong lead, lead moi, cham soc va chuyen doi.", "customer name", "assigned to", "next follow up at", "potential"],
    skipDetail: true,
  },
  {
    route: "/overview/follow-up",
    pageTexts: [
      "Cham soc / lich hen",
      "Tong hop lich hen, follow-up, dau viec qua han va nhac viec CSKH.",
      "Tong dau viec",
      "Qua han",
      "Den han hom nay",
      "Co lich hen",
      "Ma lead",
      "Ten lead",
      "Nhan vien phu trach",
      "Ket qua gan nhat",
      "Muc uu tien",
    ],
    forbiddenTexts: ["lead name", "assigned to", "next follow up at", "last contact result", "appointment at"],
    skipDetail: true,
  },
  {
    route: "/reports/payment",
    pageTexts: [
      "Bao cao thu chi",
      "Thu, chi va loi nhuan tam tinh trong ky.",
      "Tong thu",
      "Tong chi",
      "Loi nhuan",
      "Ngay hach toan",
      "Loai phieu",
      "Ma phieu",
      "Doi tac / nguoi nop",
      "Ma tham chieu",
    ],
    forbiddenTexts: ["partner", "reference", "receipt", "expense"],
    skipDetail: true,
  },
  {
    route: "/reports/contract-remain",
    pageTexts: [
      "Gia tri hop dong con lai",
      "Gia tri goc, gia tri da dung, gia tri con lai va cong no.",
      "Tong GT con lai",
      "Tong cong no",
      "Ma hop dong",
      "Khach hang",
      "Goi dich vu",
      "Gia tri goc",
      "Da su dung",
      "So tien con no",
      "Trang thai hop dong",
    ],
    forbiddenTexts: ["original value", "used value", "customer", "service package"],
    skipDetail: true,
  },
  {
    route: "/reports/deposit",
    pageTexts: [
      "Bao cao tien coc",
      "Tong tien coc dang giu, da tra va qua han.",
      "Dang giu",
      "Da tra",
      "Qua han",
      "Ma coc",
      "Khach nop coc",
      "Loai coc",
      "Thoi gian nhan",
      "Thoi gian tra",
      "Tinh trang coc",
    ],
    forbiddenTexts: ["received at", "returned at", "item type", "customer"],
    skipDetail: true,
  },
  {
    route: "/reports/kpi",
    pageTexts: [
      "Bao cao KPI",
      "Lead, hop dong, doanh thu va % KPI theo nhan vien.",
      "Tong doanh thu",
      "Tong hop dong",
      "Ma nhan vien",
      "Nhan vien",
      "Hop dong moi",
      "Lead moi",
      "Lead chuyen doi",
      "Doanh thu thuc thu",
      "Muc dat KPI",
    ],
    forbiddenTexts: ["actual revenue", "new contracts", "kpi percent"],
    skipDetail: true,
  },
  {
    route: "/staff/kpi",
    pageTexts: [
      "KPI nhan vien",
      "Lead, hop dong, doanh thu va % hoan thanh KPI theo nhan vien.",
      "Tong doanh thu",
      "Tong hop dong",
      "Nhan vien",
      "Hop dong moi",
      "Lead moi",
      "Lead chuyen doi",
      "Doanh thu thuc thu",
      "Muc dat KPI",
    ],
    forbiddenTexts: ["Bao cao KPI", "Lead, hop dong, doanh thu va % KPI theo nhan vien."],
    skipDetail: true,
  },
  {
    route: "/reports/lead",
    pageTexts: [
      "Bao cao Lead",
      "Tong lead, lead moi, cham soc va chuyen doi.",
      "Tong lead",
      "Lead moi",
      "Da chuyen doi",
      "Ma lead",
      "Ten lead",
      "Nguon lead",
      "Trang thai lead",
      "Do nong",
      "Nhan vien phu trach",
      "Lan cham soc toi",
    ],
    forbiddenTexts: ["customer name", "assigned to", "next follow up at", "potential"],
    skipDetail: true,
  },
  {
    route: "/pro-shop/partners",
    pageTexts: ["Khach hang / NCC", "Danh sach doi tac, nha cung cap va thong tin lien he phuc vu Pro Shop.", "Ma doi tac", "Ten doi tac", "Gia tri nhap", "Lan nhap gan nhat"],
    detailTexts: ["Thong tin doi tac", "Tong phieu nhap", "Gia tri nhap", "Phieu nhap", "Nguoi lien he"],
    detailTabs: ["Thong tin doi tac", "Phieu nhap"],
    forbiddenTexts: ["contact name", "purchase order count", "completed purchase order count", "total purchase amount", "last order date"],
  },
  {
    route: "/pro-shop/purchase-orders",
    pageTexts: ["Nhap hang", "Phieu nhap hang Pro Shop, nha cung cap va tong gia tri nhap.", "Ngay nhap", "Nha cung cap", "Tong SL", "Nguoi lap"],
    detailTexts: ["Thong tin nhap", "Ngay nhap", "Ngay du kien", "Nguoi lap", "Dong hang", "Tong so luong"],
    detailTabs: ["Thong tin nhap", "Dong hang"],
    forbiddenTexts: ["order date", "expected date", "supplier contact name", "supplier phone", "created user name", "product summary"],
  },
  {
    route: "/pt-schedule/calendar",
    pageTexts: ["Lich PT", "Dat lich PT, check-in buoi tap, ket qua buoi va tru so buoi con lai.", "Ma lich", "Khu vuc", "Diem danh", "Dinh kem"],
    detailTexts: ["Lich tap", "PT phu trach", "Thong tin buoi tap", "Diem danh", "So ban ghi diem danh", "So tep dinh kem"],
    detailTabs: ["Thong tin buoi tap", "Diem danh"],
    forbiddenTexts: ["scheduled date time", "trainer name", "contract package name", "duration minutes", "attachment count", "check in date time", "thanh phan"],
  },
  {
    route: "/pt-schedule/penalty-history",
    pageTexts: [
      "Lich su Penalty",
      "Nhat ky penalty, vi pham, cap nhat lich va cac thao tac lien quan den dat lich.",
      "Chua co penalty nao",
      "Bo loc hien tai chua ghi nhan penalty hay dieu chinh lich nao.",
    ],
    forbiddenTexts: ["khong co du lieu lich su penalty", "module", "doi tuong", "try adjusting filters or create a new record"],
    skipDetail: true,
  },
  {
    route: "/services",
    pageTexts: ["Dich vu", "Danh muc dich vu membership, PT va class.", "Ma DV", "Ten dich vu", "So goi"],
    detailTexts: ["Goi dich vu", "Van hanh", "Gia mac dinh", "So buoi mac dinh", "Tong goi", "Goi dang mo", "Luot su dung"],
    detailTabs: ["Goi dich vu", "Van hanh"],
    forbiddenTexts: ["default price", "default sessions", "duration days", "package count", "contract item count", "dang active"],
  },
  {
    route: "/service-packages",
    pageTexts: ["Goi dich vu", "Gia, bonus, so buoi va quy tac gia tri con lai.", "Ma goi", "Ten goi", "Dich vu", "So buoi"],
    detailTexts: ["Dich vu cha", "Hop dong", "Loai goi", "Tong buoi", "Quy tac gia tri con lai", "So hop dong"],
    detailTabs: ["Dich vu cha", "Hop dong"],
    forbiddenTexts: ["service name", "package type", "session count", "bonus sessions", "bonus days", "contract count", "remaining value rule"],
  },
  {
    route: "/trainers",
    pageTexts: ["Huan luyen vien", "Quan ly ho so PT, chuyen mon va lich lam viec.", "Ma PT", "Chuyen mon", "Lich sap toi"],
    detailTexts: ["Lich va tai trong", "Hop dong", "Buoi tap", "Hop dong dang mo", "Lich sap toi", "Buoi tiep theo"],
    detailTabs: ["Lich va tai trong", "Hop dong", "Buoi tap"],
    forbiddenTexts: ["full name", "active contract count", "upcoming session count", "completed session count", "next session date time", "hop dong active"],
  },
  {
    route: "/training-sessions",
    pageTexts: ["Buoi tap", "Lich tap, check-in va tru so buoi con lai.", "Ma buoi", "Lich tap", "Khach hang", "Tru buoi"],
    detailTexts: ["Thong tin buoi tap", "Diem danh", "Khach hang", "PT", "Hop dong", "Dia diem", "Tru buoi"],
    detailTabs: ["Thong tin buoi tap", "Diem danh"],
    forbiddenTexts: ["customer name", "consumed sessions", "duration minutes", "contract package name"],
  },
  {
    route: "/pro-shop/products",
    pageTexts: ["San pham", "Danh muc san pham, ton kho, gia ban va trang thai ban hang.", "Ma san pham", "Ten san pham", "Gia tri ton", "Canh bao ton"],
    detailTexts: ["Ton kho", "Lich su nhap", "Danh muc", "Nhom hang", "Don vi", "Gia nhap", "Gia ban", "Gia tri ton", "So dong nhap", "Lan nhap gan nhat"],
    detailTabs: ["Ton kho", "Lich su nhap"],
    forbiddenTexts: ["category name", "group name", "purchase price", "sale price", "stock quantity", "stock alert label", "stock value", "purchase item count", "last purchase date"],
  },
  {
    route: "/pro-shop/price-book",
    pageTexts: ["Bang gia Pro Shop", "Bang gia ban le, gia nhap va ton kho san pham Pro Shop.", "Ma san pham", "Ten san pham", "Gia nhap", "Gia ban", "Canh bao ton"],
    detailTexts: ["Ton kho", "Lich su nhap", "Danh muc", "Nhom hang", "Don vi", "Gia nhap", "Gia ban", "Lan nhap gan nhat"],
    detailTabs: ["Ton kho", "Lich su nhap"],
    forbiddenTexts: ["category name", "group name", "purchase price", "sale price", "stock quantity", "stock alert label", "last purchase date"],
  },
  {
    route: "/operations/towels",
    pageTexts: ["Khan tap", "Vat tu khan tap, ton kho, gia von va xuat dung noi bo.", "Them vat tu", "Shaker Bottle", "Whey Protein 2kg"],
    detailTexts: ["Thong tin khan tap", "Lich su bo sung", "Danh muc vat tu", "Nhom cap phat", "So luong ton", "Nguong toi thieu", "Lan nhap gan nhat"],
    detailTabs: ["Thong tin khan tap", "Lich su bo sung"],
    forbiddenTexts: ["group name", "stock quantity", "min stock quantity", "stock alert label", "last purchase date", "purchase history"],
  },
  {
    route: "/operations/loyalty",
    pageTexts: ["Dang ky HD Loyalty", "Theo doi hoi vien loyalty, uu dai tich diem va phan nhom khach hang trung thanh.", "Hang loyalty", "Ngay dang ky loyalty", "Het han uu dai", "Uu dai / ghi chu"],
    detailTexts: ["Ho so loyalty", "Lich su loyalty", "Hop dong lien quan", "Giao dich thu", "Nhan vien CSKH", "Het han uu dai"],
    detailTabs: ["Ho so loyalty", "Lich su loyalty", "Hop dong lien quan", "Giao dich thu"],
    forbiddenTexts: ["assigned user name", "registration date", "start training date", "end training date"],
  },
  {
    route: "/pro-shop/sales",
    pageTexts: ["Ban hang", "Giao dich ban hang Pro Shop, thu ngan, san pham va in hoa don ban le.", "Ngay ban", "Ma giao dich", "Khach mua", "Thu ngan", "Tong tien"],
    detailTexts: ["Thong tin ban hang", "San pham ban", "Khach mua", "Phuong thuc", "Thu ngan", "So dong", "Tong so luong"],
    detailTabs: ["Thong tin ban hang", "San pham ban"],
    forbiddenTexts: ["receipt date", "payment method name", "collector name", "line items text"],
  },
  {
    route: "/pro-shop/returns",
    pageTexts: ["Tra hang", "Danh sach tra hang, hoan tien, dieu chinh ton kho va in phieu tra Pro Shop.", "Ngay tra", "Ma phieu tra", "Khach nhan hoan", "Tong hoan"],
    detailTexts: ["Thong tin tra hang", "San pham tra", "Khach nhan hoan", "Phuong thuc", "Nguoi phe duyet", "Nguoi lap", "Tong so luong"],
    detailTabs: ["Thong tin tra hang", "San pham tra"],
    forbiddenTexts: ["expense date", "payment method name", "approver name", "line items text", "xu ly tra hang"],
  },
  {
    route: "/staff/program-templates",
    pageTexts: [
      "Template giao an",
      "Tam thoi dung chung thu vien template he thong trong khi module giao an mau chua co backend rieng.",
      "Thong ke mau",
      "Them mau dung chung",
      "Nguon du lieu dung chung",
    ],
    forbiddenTexts: ["Quan ly noi dung chuc mung sinh nhat", "Them mau sinh nhat", "Cap nhat mau sinh nhat"],
    skipDetail: true,
  },
].filter((scenario) => !selectedRouteFilters.length || selectedRouteFilters.some((filter) => scenario.route.includes(filter)));

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const includesNormalized = (haystack, needle) => normalizeText(haystack).includes(normalizeText(needle));

const sanitizeFileName = (value) => value.replace(/[<>:"/\\|?*\s]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");

const resolvePlaywrightModulePath = () => {
  const pathEntries = String(process.env.PATH || "").split(path.delimiter);

  for (const entry of pathEntries) {
    if (!entry || !entry.includes(`${path.sep}node_modules${path.sep}.bin`)) continue;

    const moduleRoot = path.resolve(entry, "..");
    const playwrightPath = path.join(moduleRoot, "playwright", "index.mjs");

    try {
      return pathToFileURL(playwrightPath).href;
    } catch {
      continue;
    }
  }

  throw new Error(
    'Could not resolve the temporary "playwright" package. Run this script via: npm exec --yes --package=playwright -- node scripts/portal-polish-smoke.mjs',
  );
};

const loadPlaywright = async () => import(resolvePlaywrightModulePath());

const createRecorder = (page) => {
  const events = {
    pageErrors: [],
    consoleErrors: [],
    requestFailures: [],
    responseErrors: [],
  };

  const onPageError = (error) => {
    events.pageErrors.push(String(error?.message || error));
  };

  const onConsole = (message) => {
    if (message.type() === "error") {
      events.consoleErrors.push(message.text());
    }
  };

  const onRequestFailed = (request) => {
    const url = request.url();
    if (!url.startsWith(API_URL)) return;
    const failureText = request.failure()?.errorText || "request failed";
    if (failureText.includes("ERR_ABORTED")) {
      return;
    }
    events.requestFailures.push(`${request.method()} ${url} :: ${failureText}`);
  };

  const onResponse = async (response) => {
    const url = response.url();
    if (!url.startsWith(API_URL) || response.status() < 400) return;

    let details = "";
    try {
      const contentType = response.headers()["content-type"] || "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        const message =
          typeof payload?.message === "string"
            ? payload.message
            : Array.isArray(payload?.message)
              ? payload.message.join("; ")
              : "";
        details = message ? ` :: ${message}` : "";
      }
    } catch {
      details = "";
    }

    events.responseErrors.push(`${response.status()} ${response.request().method()} ${url}${details}`);
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  return {
    events,
    detach() {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    },
  };
};

const loginByApi = async () => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-key": TENANT_KEY,
    },
    body: JSON.stringify({
      identifier: IDENTIFIER,
      password: PASSWORD,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.accessToken) {
    throw new Error(`Login failed for ${IDENTIFIER}: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
};

const waitForPageSettle = async (page, timeoutMs = 1800) => {
  await Promise.race([
    page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {}),
    page.waitForTimeout(timeoutMs),
  ]);
};

const clickDrawerTab = async (drawer, label) =>
  drawer.locator("button").evaluateAll((buttons, target) => {
    const normalize = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\u0111/g, "d")
        .replace(/\u0110/g, "D")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const button = buttons.find((item) => normalize(item.textContent || "").includes(normalize(target)));
    if (!button) return false;
    button.click();
    return true;
  }, label);

const main = async () => {
  const { chromium } = await loadPlaywright();
  const loginPayload = await loginByApi();

  await fs.mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 960 },
  });

  await context.addInitScript(
    ({ accessToken, tenantKey }) => {
      window.localStorage.setItem("fitflow_access_token", accessToken);
      window.localStorage.setItem("fitflow_tenant_key", tenantKey);
    },
    {
      accessToken: loginPayload.accessToken,
      tenantKey: TENANT_KEY,
    },
  );

  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(20000);

  const results = {
    generatedAt: new Date().toISOString(),
    webUrl: WEB_URL,
    apiUrl: API_URL,
    tenantKey: TENANT_KEY,
    routeCount: scenarios.length,
    routes: [],
  };

  try {
    await page.goto(`${WEB_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForPageSettle(page, 1800);

    if (page.url().includes("/login")) {
      await page.evaluate(
        ({ accessToken, tenantKey }) => {
          window.localStorage.setItem("fitflow_access_token", accessToken);
          window.localStorage.setItem("fitflow_tenant_key", tenantKey);
        },
        {
          accessToken: loginPayload.accessToken,
          tenantKey: TENANT_KEY,
        },
      );
      await page.goto(`${WEB_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await waitForPageSettle(page, 1800);
    }

    if (page.url().includes("/login")) {
      throw new Error("Browser session redirected to login after bootstrap.");
    }

    for (const scenario of scenarios) {
      const recorder = createRecorder(page);
      const routeResult = {
        route: scenario.route,
        detailRequired: !scenario.skipDetail,
        detailOpened: false,
        missingPageTexts: [],
        missingDetailTexts: [],
        forbiddenTextsFound: [],
        pageErrors: [],
        consoleErrors: [],
        requestFailures: [],
        responseErrors: [],
        screenshotPath: null,
        hasIssue: false,
      };

      try {
        await page.goto(`${WEB_URL}${scenario.route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await waitForPageSettle(page, 2200);

        if (page.url().includes("/login")) {
          throw new Error(`Redirected to login while opening ${scenario.route}`);
        }

        let pageText = await page.locator("body").innerText();
        routeResult.missingPageTexts = scenario.pageTexts.filter((text) => !includesNormalized(pageText, text));
        routeResult.forbiddenTextsFound = scenario.forbiddenTexts.filter((text) => includesNormalized(pageText, text));

        const firstRow = page.locator("tbody tr").first();
        let hasRow = Boolean(await firstRow.count());

        if (!hasRow || routeResult.missingPageTexts.length) {
          await waitForPageSettle(page, 2600);
          pageText = await page.locator("body").innerText();
          routeResult.missingPageTexts = scenario.pageTexts.filter((text) => !includesNormalized(pageText, text));
          routeResult.forbiddenTextsFound = scenario.forbiddenTexts.filter((text) => includesNormalized(pageText, text));
          hasRow = Boolean(await firstRow.count());
        }

        if (routeResult.missingPageTexts.length) {
          await waitForPageSettle(page, 1800);
          pageText = await page.locator("body").innerText();
          routeResult.missingPageTexts = scenario.pageTexts.filter((text) => !includesNormalized(pageText, text));
          routeResult.forbiddenTextsFound = scenario.forbiddenTexts.filter((text) => includesNormalized(pageText, text));
          hasRow = Boolean(await firstRow.count());
        }

        if (hasRow && !scenario.skipDetail) {
          const viewButton = firstRow.locator("button").first();
          await viewButton.click();
          const drawer = page.locator("div.fixed.inset-0.z-50").last();
          await drawer.waitFor({ state: "visible", timeout: 5000 });
          await page.waitForTimeout(350);

          const drawerTextSamples = [await drawer.innerText()];
          for (const tab of scenario.detailTabs || []) {
            const clicked = await clickDrawerTab(drawer, tab);
            if (!clicked) {
              routeResult.pageErrors.push(`Detail tab not found: ${tab}`);
              continue;
            }
            await page.waitForTimeout(300);
            drawerTextSamples.push(await drawer.innerText());
          }

          const drawerText = drawerTextSamples.join("\n");
          routeResult.detailOpened = true;
          routeResult.missingDetailTexts = scenario.detailTexts.filter((text) => !includesNormalized(drawerText, text));
          routeResult.forbiddenTextsFound = [
            ...routeResult.forbiddenTextsFound,
            ...scenario.forbiddenTexts.filter((text) => includesNormalized(drawerText, text)),
          ].filter((value, index, source) => source.indexOf(value) === index);
        }
      } catch (error) {
        routeResult.pageErrors.push(String(error?.message || error));
      } finally {
        recorder.detach();
        routeResult.pageErrors.push(...recorder.events.pageErrors);
        routeResult.consoleErrors.push(...recorder.events.consoleErrors);
        routeResult.requestFailures.push(...recorder.events.requestFailures);
        routeResult.responseErrors.push(...recorder.events.responseErrors);
          routeResult.hasIssue =
            routeResult.missingPageTexts.length > 0 ||
            routeResult.missingDetailTexts.length > 0 ||
            routeResult.forbiddenTextsFound.length > 0 ||
            routeResult.pageErrors.length > 0 ||
            routeResult.consoleErrors.length > 0 ||
            routeResult.requestFailures.length > 0 ||
            routeResult.responseErrors.length > 0 ||
            (!scenario.skipDetail && !routeResult.detailOpened);

        if (routeResult.hasIssue) {
          const screenshotPath = path.join(screenshotDir, `${sanitizeFileName(scenario.route)}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
          routeResult.screenshotPath = screenshotPath;
        }

        results.routes.push(routeResult);
      }
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const summary = {
    totalRoutes: results.routes.length,
    detailOpened: results.routes.filter((route) => route.detailOpened).length,
    issueCount: results.routes.filter((route) => route.hasIssue).length,
    missingTextRoutes: results.routes.filter((route) => route.missingPageTexts.length || route.missingDetailTexts.length).length,
    forbiddenTextRoutes: results.routes.filter((route) => route.forbiddenTextsFound.length).length,
    runtimeErrorRoutes: results.routes.filter(
      (route) => route.pageErrors.length || route.consoleErrors.length || route.requestFailures.length || route.responseErrors.length,
    ).length,
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify({ ...results, summary }, null, 2));

  console.log(JSON.stringify({ outputPath, summary }, null, 2));

  if (summary.issueCount > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
