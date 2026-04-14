import { AppLocale, defaultLocale, normalizeUtf8Text } from "./runtime";
import {
  baseUserManagedFields,
  enumDomains,
  exactPermissionCodes,
  exactText,
  localeLabels as rawLocaleLabels,
  permissionActions,
  permissionModules,
  phraseEntries,
  roleLabels,
  statuses,
  supplementalVietnameseExactText,
  type LocalizedValue,
  type PhraseEntry,
} from "./messages-cleaned";

const localizedExactTextOverrides: Record<string, LocalizedValue> = {
  "Ban le": { vi: "BÃ¡n láº»", en: "Retail", ko: "ì†Œë§¤" },
  "Khan / vat tu dich vu": { vi: "KhÄƒn / váº­t tÆ° dá»‹ch vá»¥", en: "Towel / service item", ko: "ìˆ˜ê±´ / ì„œë¹„ìŠ¤ ìš©í’ˆ" },
  "Dung chung": { vi: "DÃ¹ng chung", en: "Shared use", ko: "ê²¸ìš©" },
  "Khan / vat tu": { vi: "KhÄƒn / váº­t tÆ°", en: "Towel / supplies", ko: "ìˆ˜ê±´ / ë¹„í’ˆ" },
  "Loai vat tu": { vi: "Loáº¡i váº­t tÆ°", en: "Item type", ko: "í’ˆëª© ìœ í˜•" },
  "Ngay phat": { vi: "NgÃ y phÃ¡t", en: "Issue date", ko: "ì§€ê¸‰ì¼" },
  "Han tra": { vi: "Háº¡n tráº£", en: "Return due date", ko: "ë°˜ë‚© ê¸°í•œ" },
  "Thue Tu do": { vi: "ThuÃª Tá»§ Ä‘á»“", en: "Locker rental", ko: "ì‚¬ë¬¼í•¨ ëŒ€ì—¬" },
  "Them khan / vat tu": { vi: "ThÃªm khÄƒn / váº­t tÆ°", en: "Add towel / supplies", ko: "ìˆ˜ê±´ / ë¹„í’ˆ ì¶”ê°€" },
  "Chua co khan / vat tu dich vu": {
    vi: "ChÆ°a cÃ³ khÄƒn / váº­t tÆ° dá»‹ch vá»¥",
    en: "No towel / service item yet",
    ko: "ì•„ì§ ìˆ˜ê±´ / ì„œë¹„ìŠ¤ ìš©í’ˆì´ ì—†ìŠµë‹ˆë‹¤",
  },
  "Them nhom hang": { vi: "ThÃªm nhÃ³m hÃ ng", en: "Add product group", ko: "í’ˆëª© ê·¸ë£¹ ì¶”ê°€" },
  "San sang": { vi: "Sáºµn sÃ ng", en: "Ready", ko: "ì¤€ë¹„ë¨" },
  "SL thue luot": { vi: "SL thuÃª lÆ°á»£t", en: "Rental qty", ko: "ëŒ€ì—¬ ìˆ˜ëŸ‰" },
  "SL da ban": { vi: "SL Ä‘Ã£ bÃ¡n", en: "Sold qty", ko: "íŒë§¤ ìˆ˜ëŸ‰" },
  "Dang phat": { vi: "Äang phÃ¡t", en: "Issued", ko: "ì§€ê¸‰ ì¤‘" },
  "Dang giat": { vi: "Äang giáº·t", en: "In laundry", ko: "ì„¸íƒ ì¤‘" },
  "Hu hong": { vi: "HÆ° há»ng", en: "Damaged", ko: "íŒŒì†" },
  "Mat": { vi: "Máº¥t", en: "Lost", ko: "ë¶„ì‹¤" },
  "Chon chi nhanh truoc": { vi: "Chá»n chi nhÃ¡nh trÆ°á»›c", en: "Select branch first", ko: "ë¨¼ì € ì§€ì ì„ ì„ íƒí•˜ì„¸ìš”" },
  "Hay chon Chi nhanh truoc de loc danh sach phu hop.": {
    vi: "HÃ£y chá»n Chi nhÃ¡nh trÆ°á»›c Ä‘á»ƒ lá»c danh sÃ¡ch phÃ¹ há»£p.",
    en: "Select a branch first to filter the matching list.",
    ko: "í•´ë‹¹ ëª©ë¡ì„ í•„í„°ë§í•˜ë ¤ë©´ ë¨¼ì € ì§€ì ì„ ì„ íƒí•˜ì„¸ìš”.",
  },
  "Chon loai vat tu truoc": { vi: "Chá»n loáº¡i váº­t tÆ° trÆ°á»›c", en: "Select item type first", ko: "ë¨¼ì € í’ˆëª© ìœ í˜•ì„ ì„ íƒí•˜ì„¸ìš”" },
  "Hay chon Chi nhanh va Loai vat tu truoc de loc Nhom hang phu hop.": {
    vi: "HÃ£y chá»n Chi nhÃ¡nh vÃ  Loáº¡i váº­t tÆ° trÆ°á»›c Ä‘á»ƒ lá»c NhÃ³m hÃ ng phÃ¹ há»£p.",
    en: "Select the branch and item type first to filter the matching product group.",
    ko: "ë§žëŠ” í’ˆëª© ê·¸ë£¹ì„ í•„í„°ë§í•˜ë ¤ë©´ ë¨¼ì € ì§€ì ê³¼ í’ˆëª© ìœ í˜•ì„ ì„ íƒí•˜ì„¸ìš”.",
  },
  "Chua co goi dich vu cho chi nhanh nay": {
    vi: "ChÆ°a cÃ³ gÃ³i dá»‹ch vá»¥ cho chi nhÃ¡nh nÃ y",
    en: "No service package for this branch",
    ko: "ì´ ì§€ì ì—ëŠ” ì„œë¹„ìŠ¤ íŒ¨í‚¤ì§€ê°€ ì—†ìŠµë‹ˆë‹¤",
  },
  "Chua co dich vu cho chi nhanh nay": {
    vi: "ChÆ°a cÃ³ dá»‹ch vá»¥ cho chi nhÃ¡nh nÃ y",
    en: "No service for this branch",
    ko: "ì´ ì§€ì ì—ëŠ” ì„œë¹„ìŠ¤ê°€ ì—†ìŠµë‹ˆë‹¤",
  },
  "Chua co nha cung cap cho chi nhanh nay": {
    vi: "ChÆ°a cÃ³ nhÃ  cung cáº¥p cho chi nhÃ¡nh nÃ y",
    en: "No supplier for this branch",
    ko: "ì´ ì§€ì ì—ëŠ” ê³µê¸‰ì—…ì²´ê°€ ì—†ìŠµë‹ˆë‹¤",
  },
  "Chua co tu do cho chi nhanh nay": {
    vi: "ChÆ°a cÃ³ tá»§ Ä‘á»“ cho chi nhÃ¡nh nÃ y",
    en: "No locker for this branch",
    ko: "ì´ ì§€ì ì—ëŠ” ì‚¬ë¬¼í•¨ì´ ì—†ìŠµë‹ˆë‹¤",
  },
  "Chua co nhom hang phu hop cho chi nhanh nay": {
    vi: "ChÆ°a cÃ³ nhÃ³m hÃ ng phÃ¹ há»£p cho chi nhÃ¡nh nÃ y",
    en: "No matching product group for this branch",
    ko: "ì´ ì§€ì ì—ëŠ” ë§žëŠ” í’ˆëª© ê·¸ë£¹ì´ ì—†ìŠµë‹ˆë‹¤",
  },
  "Chi nhanh nay chua co Goi dich vu nao. Hay tao truoc tai Nghiep vu > Bang gia dich vu, sau do quay lai dang ky hop dong.": {
    vi: "Chi nhÃ¡nh nÃ y chÆ°a cÃ³ GÃ³i dá»‹ch vá»¥ nÃ o. HÃ£y táº¡o trÆ°á»›c táº¡i Nghiá»‡p vá»¥ > Báº£ng giÃ¡ dá»‹ch vá»¥, sau Ä‘Ã³ quay láº¡i Ä‘Äƒng kÃ½ há»£p Ä‘á»“ng.",
    en: "This branch does not have any service package yet. Create one in Operations > Service price list, then return to register the contract.",
    ko: "ì´ ì§€ì ì—ëŠ” ì•„ì§ ì„œë¹„ìŠ¤ íŒ¨í‚¤ì§€ê°€ ì—†ìŠµë‹ˆë‹¤. ì—…ë¬´ > ì„œë¹„ìŠ¤ ê°€ê²©í‘œì—ì„œ ë¨¼ì € ìƒì„±í•œ ë’¤ ê³„ì•½ ë“±ë¡ìœ¼ë¡œ ëŒì•„ì˜¤ì„¸ìš”.",
  },
  "Chi nhanh nay chua co Dich vu nao. Hay tao truoc tai Nghiep vu > Bang gia dich vu, sau do quay lai them Goi dich vu.": {
    vi: "Chi nhÃ¡nh nÃ y chÆ°a cÃ³ Dá»‹ch vá»¥ nÃ o. HÃ£y táº¡o trÆ°á»›c táº¡i Nghiá»‡p vá»¥ > Báº£ng giÃ¡ dá»‹ch vá»¥, sau Ä‘Ã³ quay láº¡i thÃªm GÃ³i dá»‹ch vá»¥.",
    en: "This branch does not have any service yet. Create one in Operations > Service price list, then return to add the service package.",
    ko: "ì´ ì§€ì ì—ëŠ” ì•„ì§ ì„œë¹„ìŠ¤ê°€ ì—†ìŠµë‹ˆë‹¤. ì—…ë¬´ > ì„œë¹„ìŠ¤ ê°€ê²©í‘œì—ì„œ ë¨¼ì € ìƒì„±í•œ ë’¤ ì„œë¹„ìŠ¤ íŒ¨í‚¤ì§€ ì¶”ê°€ë¡œ ëŒì•„ì˜¤ì„¸ìš”.",
  },
  "Chi nhanh nay chua co Nha cung cap nao. Hay tao truoc tai Pro Shop > Khach hang / NCC.": {
    vi: "Chi nhÃ¡nh nÃ y chÆ°a cÃ³ NhÃ  cung cáº¥p nÃ o. HÃ£y táº¡o trÆ°á»›c táº¡i Pro Shop > KhÃ¡ch hÃ ng / NCC.",
    en: "This branch does not have any supplier yet. Create one in Pro Shop > Customers / Suppliers.",
    ko: "ì´ ì§€ì ì—ëŠ” ì•„ì§ ê³µê¸‰ì—…ì²´ê°€ ì—†ìŠµë‹ˆë‹¤. Pro Shop > ê³ ê° / ê³µê¸‰ì—…ì²´ì—ì„œ ë¨¼ì € ìƒì„±í•˜ì„¸ìš”.",
  },
  "Chi nhanh nay chua co Tu do nao. Hay tao truoc tai Pro Shop > Tu do.": {
    vi: "Chi nhÃ¡nh nÃ y chÆ°a cÃ³ Tá»§ Ä‘á»“ nÃ o. HÃ£y táº¡o trÆ°á»›c táº¡i Pro Shop > Tá»§ Ä‘á»“.",
    en: "This branch does not have any locker yet. Create one in Pro Shop > Lockers.",
    ko: "ì´ ì§€ì ì—ëŠ” ì•„ì§ ì‚¬ë¬¼í•¨ì´ ì—†ìŠµë‹ˆë‹¤. Pro Shop > ì‚¬ë¬¼í•¨ì—ì„œ ë¨¼ì € ìƒì„±í•˜ì„¸ìš”.",
  },
  "Chi nhanh nay chua co Nhom hang nao phu hop voi Loai vat tu da chon. Hay tao truoc tai Pro Shop > Nhom hang / cap phat.": {
    vi: "Chi nhÃ¡nh nÃ y chÆ°a cÃ³ NhÃ³m hÃ ng nÃ o phÃ¹ há»£p vá»›i Loáº¡i váº­t tÆ° Ä‘Ã£ chá»n. HÃ£y táº¡o trÆ°á»›c táº¡i Pro Shop > NhÃ³m hÃ ng / cáº¥p phÃ¡t.",
    en: "This branch does not have a product group matching the selected item type. Create one in Pro Shop > Product groups / allocations.",
    ko: "ì´ ì§€ì ì—ëŠ” ì„ íƒí•œ í’ˆëª© ìœ í˜•ì— ë§žëŠ” í’ˆëª© ê·¸ë£¹ì´ ì—†ìŠµë‹ˆë‹¤. Pro Shop > í’ˆëª© ê·¸ë£¹ / ì§€ê¸‰ì—ì„œ ë¨¼ì € ìƒì„±í•˜ì„¸ìš”.",
  },
  "Man nay chi hien vat tu co loai su dung la Khan / vat tu dich vu hoac Dung chung. Hay them moi vat tu va chon dung loai truoc khi lap phieu phat / tra.": {
    vi: "MÃ n nÃ y chá»‰ hiá»‡n váº­t tÆ° cÃ³ loáº¡i sá»­ dá»¥ng lÃ  KhÄƒn / váº­t tÆ° dá»‹ch vá»¥ hoáº·c DÃ¹ng chung. HÃ£y thÃªm má»›i váº­t tÆ° vÃ  chá»n Ä‘Ãºng loáº¡i trÆ°á»›c khi láº­p phiáº¿u phÃ¡t / tráº£.",
    en: "This page only shows items with usage type Towel / service item or Shared use. Add the item and choose the correct type before creating an issue / return slip.",
    ko: "ì´ í™”ë©´ì—ëŠ” ì‚¬ìš© ìœ í˜•ì´ ìˆ˜ê±´ / ì„œë¹„ìŠ¤ ìš©í’ˆ ë˜ëŠ” ê²¸ìš©ì¸ í’ˆëª©ë§Œ í‘œì‹œë©ë‹ˆë‹¤. ì§€ê¸‰ / ë°˜ë‚© ì „í‘œë¥¼ ë§Œë“¤ê¸° ì „ì— í’ˆëª©ì„ ì¶”ê°€í•˜ê³  ì˜¬ë°”ë¥¸ ìœ í˜•ì„ ì„ íƒí•˜ì„¸ìš”.",
  },
  "Hay tao nhom hang truoc, sau do quay lai man hinh Khan tap / vat tu hoac Pro Shop de gan vao tung mat hang.": {
    vi: "HÃ£y táº¡o nhÃ³m hÃ ng trÆ°á»›c, sau Ä‘Ã³ quay láº¡i mÃ n hÃ¬nh KhÄƒn táº­p / váº­t tÆ° hoáº·c Pro Shop Ä‘á»ƒ gÃ¡n vÃ o tá»«ng máº·t hÃ ng.",
    en: "Create the product group first, then return to the Towel / supplies or Pro Shop screen to assign it to each item.",
    ko: "ë¨¼ì € í’ˆëª© ê·¸ë£¹ì„ ë§Œë“  ë’¤ ìˆ˜ê±´ / ë¹„í’ˆ ë˜ëŠ” Pro Shop í™”ë©´ìœ¼ë¡œ ëŒì•„ê°€ ê° í’ˆëª©ì— ì—°ê²°í•˜ì„¸ìš”.",
  },
  "Vi du 1: Ten nhom Towel Service | Loai Khan / vat tu dich vu | Chi nhanh VNChoice": {
    vi: "VÃ­ dá»¥ 1: TÃªn nhÃ³m Towel Service | Loáº¡i KhÄƒn / váº­t tÆ° dá»‹ch vá»¥ | Chi nhÃ¡nh VNChoice",
    en: "Example 1: Group name Towel Service | Type Towel / service item | Branch VNChoice",
    ko: "ì˜ˆì‹œ 1: ê·¸ë£¹ëª… Towel Service | ìœ í˜• ìˆ˜ê±´ / ì„œë¹„ìŠ¤ ìš©í’ˆ | ì§€ì  VNChoice",
  },
  "Vi du 2: Ten nhom Accessory | Loai Ban le | Chi nhanh VNChoice": {
    vi: "VÃ­ dá»¥ 2: TÃªn nhÃ³m Accessory | Loáº¡i BÃ¡n láº» | Chi nhÃ¡nh VNChoice",
    en: "Example 2: Group name Accessory | Type Retail | Branch VNChoice",
    ko: "ì˜ˆì‹œ 2: ê·¸ë£¹ëª… Accessory | ìœ í˜• ì†Œë§¤ | ì§€ì  VNChoice",
  },
  "Vi du 1: Ma TWL001 | Ten Khan tap test | Don vi cai | Loai Khan / vat tu dich vu": {
    vi: "VÃ­ dá»¥ 1: MÃ£ TWL001 | TÃªn KhÄƒn táº­p test | ÄÆ¡n vá»‹ cÃ¡i | Loáº¡i KhÄƒn / váº­t tÆ° dá»‹ch vá»¥",
    en: "Example 1: Code TWL001 | Name Test workout towel | Unit piece | Type Towel / service item",
    ko: "ì˜ˆì‹œ 1: ì½”ë“œ TWL001 | ì´ë¦„ í…ŒìŠ¤íŠ¸ ìš´ë™ ìˆ˜ê±´ | ë‹¨ìœ„ ê°œ | ìœ í˜• ìˆ˜ê±´ / ì„œë¹„ìŠ¤ ìš©í’ˆ",
  },
  "Vi du 2: Ton kho 20 | Nguong toi thieu 5 | Gia nhap 12000 | Gia ban 25000": {
    vi: "VÃ­ dá»¥ 2: Tá»“n kho 20 | NgÆ°á»¡ng tá»‘i thiá»ƒu 5 | GiÃ¡ nháº­p 12000 | GiÃ¡ bÃ¡n 25000",
    en: "Example 2: Stock 20 | Minimum threshold 5 | Purchase price 12000 | Sale price 25000",
    ko: "ì˜ˆì‹œ 2: ìž¬ê³  20 | ìµœì†Œ ê¸°ì¤€ 5 | ìž…ê³ ê°€ 12000 | íŒë§¤ê°€ 25000",
  },
  "Vi du 3: Sau khi tao xong, vao Phat / tra khan hoac Phieu thu -> Cho thue khan / vat tu de lap giao dich": {
    vi: "VÃ­ dá»¥ 3: Sau khi táº¡o xong, vÃ o PhÃ¡t / tráº£ khÄƒn hoáº·c Phiáº¿u thu -> Cho thuÃª khÄƒn / váº­t tÆ° Ä‘á»ƒ láº­p giao dá»‹ch",
    en: "Example 3: After creating it, go to Towel issue / return or Receipt -> Towel / supplies rental to create the transaction",
    ko: "ì˜ˆì‹œ 3: ìƒì„± í›„ ìˆ˜ê±´ ì§€ê¸‰ / ë°˜ë‚© ë˜ëŠ” ì˜ìˆ˜ì¦ -> ìˆ˜ê±´ / ë¹„í’ˆ ëŒ€ì—¬ë¡œ ì´ë™í•´ ê±°ëž˜ë¥¼ ìƒì„±í•˜ì„¸ìš”",
  },
  "Ap dung them cho cac ngay": {
    vi: "Ãp dá»¥ng thÃªm cho cÃ¡c ngÃ y",
    en: "Apply to selected dates",
    ko: "ì„ íƒí•œ ë‚ ì§œì— ì¶”ê°€ ì ìš©",
  },
  "Ngay hien tai": {
    vi: "NgÃ y hiá»‡n táº¡i",
    en: "Current date",
    ko: "í˜„ìž¬ ë‚ ì§œ",
  },
  "Khong tick thi chi luu cho ngay hien tai.": {
    vi: "KhÃ´ng tick thÃ¬ chá»‰ lÆ°u cho ngÃ y hiá»‡n táº¡i.",
    en: "If nothing is checked, only the current date will be saved.",
    ko: "ì²´í¬í•˜ì§€ ì•Šìœ¼ë©´ í˜„ìž¬ ë‚ ì§œì—ë§Œ ì €ìž¥ë©ë‹ˆë‹¤.",
  },
  "Tick ngay nao thi he thong tao cung khung gio cho dung cac ngay do. Khong tick them thi chi ap dung ngay dang chon.": {
    vi: "Tick ngÃ y nÃ o thÃ¬ há»‡ thá»‘ng táº¡o cÃ¹ng khung giá» cho Ä‘Ãºng cÃ¡c ngÃ y Ä‘Ã³. KhÃ´ng tick thÃªm thÃ¬ chá»‰ Ã¡p dá»¥ng ngÃ y Ä‘ang chá»n.",
    en: "The system will create the same time slot for every checked date. If you do not check any extra date, it only applies to the selected day.",
    ko: "ì²´í¬í•œ ë‚ ì§œë§ˆë‹¤ ê°™ì€ ì‹œê°„ëŒ€ë¡œ ì¼ì •ì´ ìƒì„±ë©ë‹ˆë‹¤. ì¶”ê°€ ë‚ ì§œë¥¼ ì²´í¬í•˜ì§€ ì•Šìœ¼ë©´ í˜„ìž¬ ì„ íƒí•œ ë‚ ì§œì—ë§Œ ì ìš©ë©ë‹ˆë‹¤.",
  },
  "Khung gio nay da co lich PT o cac ngay:": {
    vi: "Khung giá» nÃ y Ä‘Ã£ cÃ³ lá»‹ch PT á»Ÿ cÃ¡c ngÃ y:",
    en: "This PT time slot is already booked on:",
    ko: "ì´ PT ì‹œê°„ëŒ€ëŠ” ë‹¤ìŒ ë‚ ì§œì— ì´ë¯¸ ì˜ˆì•½ë˜ì–´ ìžˆìŠµë‹ˆë‹¤:",
  },
  "Khung gio line / phong nay da co lich o cac ngay:": {
    vi: "Khung giá» line / phÃ²ng nÃ y Ä‘Ã£ cÃ³ lá»‹ch á»Ÿ cÃ¡c ngÃ y:",
    en: "This line / room time slot is already booked on:",
    ko: "ì´ ë¼ì¸ / ë£¸ ì‹œê°„ëŒ€ëŠ” ë‹¤ìŒ ë‚ ì§œì— ì´ë¯¸ ì˜ˆì•½ë˜ì–´ ìžˆìŠµë‹ˆë‹¤:",
  },
  "Tick ngay nao thi he thong cap nhat lich tuong ung neu da co, neu chua co se tao moi. Khong tick them thi chi ap dung ngay dang chon.": {
    vi: "Tick ngÃ y nÃ o thÃ¬ há»‡ thá»‘ng cáº­p nháº­t lá»‹ch tÆ°Æ¡ng á»©ng náº¿u Ä‘Ã£ cÃ³, náº¿u chÆ°a cÃ³ sáº½ táº¡o má»›i. KhÃ´ng tick thÃªm thÃ¬ chá»‰ Ã¡p dá»¥ng ngÃ y Ä‘ang chá»n.",
    en: "For each checked date, the system updates the matching session if it already exists; otherwise it creates a new one. If no extra date is checked, only the selected day is updated.",
    ko: "ì²´í¬í•œ ë‚ ì§œë§ˆë‹¤ ê¸°ì¡´ ì¼ì •ì´ ìžˆìœ¼ë©´ í•´ë‹¹ ì¼ì •ì„ ì—…ë°ì´íŠ¸í•˜ê³ , ì—†ìœ¼ë©´ ìƒˆë¡œ ìƒì„±í•©ë‹ˆë‹¤. ì¶”ê°€ ë‚ ì§œë¥¼ ì²´í¬í•˜ì§€ ì•Šìœ¼ë©´ í˜„ìž¬ ì„ íƒí•œ ë‚ ì§œì—ë§Œ ì ìš©ë©ë‹ˆë‹¤.",
  },
  "Ap dung hang tuan": {
    vi: "ÃƒÂp dÃ¡Â»Â¥ng hÃ¡ÂºÂ±ng tuÃ¡ÂºÂ§n",
    en: "Apply weekly",
    ko: "Ã«Â§Â¤Ã¬Â£Â¼ Ã¬Â ÂÃ¬Å¡Â©",
  },
  "Den het": {
    vi: "Ã„ÂÃ¡ÂºÂ¿n hÃ¡ÂºÂ¿t",
    en: "Until",
    ko: "Ã¬Â ÂÃ¬Å¡Â© Ã¬Â¢â€¦Ã«Â£Å’",
  },
  "Ap dung cho cac ngay duoc tick.": {
    vi: "ÃƒÂp dÃ¡Â»Â¥ng cho cÃƒÂ¡c ngÃƒÂ y Ã„â€˜Ã†Â°Ã¡Â»Â£c tick.",
    en: "Applies to the checked weekdays.",
    ko: "Ã¬Â²Â´Ã­ÂÂ¬Ã­â€¢Å“ Ã¬Å¡â€Ã¬ÂÂ¼Ã¬â€”Â Ã¬Â ÂÃ¬Å¡Â©Ã«ÂÂ©Ã«â€¹Ë†Ã«â€¹Â¤.",
  },
  "Khong bat thi chi luu cho ngay hien tai.": {
    vi: "KhÃƒÂ´ng bÃ¡ÂºÂ­t thÃƒÂ¬ chÃ¡Â»â€° lÃ†Â°u cho ngÃƒÂ y hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i.",
    en: "If disabled, only the current date is saved.",
    ko: "Ã«Ââ€žÃ«Â©Â´ Ã­Ëœâ€žÃ¬Å¾Â¬ Ã«â€šÂ Ã¬Â§Å“Ã¬â€”ÂÃ«Â§Å’ Ã¬Â â‚¬Ã¬Å¾Â¥Ã«ÂÂ©Ã«â€¹Ë†Ã«â€¹Â¤.",
  },
  "Tick thu nao thi he thong cap nhat toan bo lich cung thu tu ngay dang chon den het han hop dong. Thu nao khong tick thi khong ap dung.": {
    vi: "Tick thÃ¡Â»Â© nÃƒÂ o thÃƒÂ¬ hÃ¡Â»â€¡ thÃ¡Â»â€˜ng cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t toÃƒÂ n bÃ¡Â»â„¢ lÃ¡Â»â€¹ch cÃƒÂ¹ng thÃ¡Â»Â© tÃ¡Â»Â« ngÃƒÂ y Ã„â€˜ang chÃ¡Â»Ân Ã„â€˜Ã¡ÂºÂ¿n hÃ¡ÂºÂ¿t hÃ¡ÂºÂ¡n hÃ¡Â»Â£p Ã„â€˜Ã¡Â»â€œng. ThÃ¡Â»Â© nÃƒÂ o khÃƒÂ´ng tick thÃƒÂ¬ khÃƒÂ´ng ÃƒÂ¡p dÃ¡Â»Â¥ng.",
    en: "The system updates all sessions on the checked weekdays from the selected date until the contract end date. Unticked weekdays are not affected.",
    ko: "Ã¬Â²Â´Ã­ÂÂ¬Ã­â€¢Å“ Ã¬Å¡â€Ã¬ÂÂ¼Ã¬â€”Â Ã«Å’â‚¬Ã­â€¢Â´Ã¬â€žÅ“Ã«Â§Å’ Ã¬â€žÂ Ã­Æ’ÂÃ­â€¢Å“ Ã«â€šÂ Ã¬Â§Å“Ã«Â¶â‚¬Ã­â€žÂ° ÃªÂ³â€žÃ¬â€¢Â½ Ã¬Â¢â€¦Ã«Â£Å’Ã¬ÂÂ¼ÃªÂ¹Å’Ã¬Â§â‚¬ Ã«ÂªÂ¨Ã«â€œÂ  Ã¬ÂÂ¼Ã¬Â â€¢Ã¬Ââ€ž Ã¬â€”â€¦Ã«ÂÂ°Ã¬ÂÂ´Ã­Å Â¸Ã­â€¢Â©Ã«â€¹Ë†Ã«â€¹Â¤. Ã¬Â²Â´Ã­ÂÂ¬Ã­â€¢ËœÃ¬Â§â‚¬ Ã¬â€¢Å Ã¬Ââ‚¬ Ã¬Å¡â€Ã¬ÂÂ¼Ã¬Ââ‚¬ Ã¬Â ÂÃ¬Å¡Â©Ã«ÂËœÃ¬Â§â‚¬ Ã¬â€¢Å Ã¬Å ÂµÃ«â€¹Ë†Ã«â€¹Â¤.",
  },
  "Hoc vien tham gia": {
    vi: "HÃ¡Â»Âc viÃƒÂªn tham gia",
    en: "Participants",
    ko: "Ã¬Â°Â¸ÃªÂ°â‚¬ Ã­Å¡Å’Ã¬â€ºÂ",
  },
  "Khong co hoc vien nao phu hop voi bo loc hien tai.": {
    vi: "KhÃƒÂ´ng cÃƒÂ³ hÃ¡Â»Âc viÃƒÂªn nÃƒÂ o phÃƒÂ¹ hÃ¡Â»Â£p vÃ¡Â»â€ºi bÃ¡Â»â„¢ lÃ¡Â»Âc hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i.",
    en: "No members match the current filter.",
    ko: "Ã­Ëœâ€žÃ¬Å¾Â¬ Ã­â€¢â€žÃ­â€žÂ°Ã¬â€”Â Ã«Â§Å¾Ã«Å â€ Ã­Å¡Å’Ã¬â€ºÂÃ¬ÂÂ´ Ã¬â€”â€ Ã¬Å ÂµÃ«â€¹Ë†Ã«â€¹Â¤.",
  },
  "Lich PT nhom cho phep tick nhieu hoc vien tham gia trong cung mot buoi. Hoc vien chinh van dung de gan hop dong chinh.": {
    vi: "LÃ¡Â»â€¹ch PT nhÃƒÂ³m cho phÃƒÂ©p tick nhiÃ¡Â»Âu hÃ¡Â»Âc viÃƒÂªn tham gia trong cÃƒÂ¹ng mÃ¡Â»â„¢t buÃ¡Â»â€¢i. HÃ¡Â»Âc viÃƒÂªn chÃƒÂ­nh vÃ¡ÂºÂ«n dÃƒÂ¹ng Ã„â€˜Ã¡Â»Æ’ gÃƒÂ¡n hÃ¡Â»Â£p Ã„â€˜Ã¡Â»â€œng chÃƒÂ­nh.",
    en: "Group PT lets you tick multiple members in the same session. The primary member is still used for the main contract.",
    ko: "ÃªÂ·Â¸Ã«Â£Â¹ PTÃ«Å â€ Ã­â€¢Å“ Ã¬â€žÂ¸Ã¬â€¦ËœÃ¬â€”Â Ã¬â€”Â¬Ã«Å¸Â¬ Ã­Å¡Å’Ã¬â€ºÂÃ¬Ââ€ž Ã¬â€žÂ Ã­Æ’ÂÃ­â€¢Â  Ã¬Ë†Ëœ Ã¬Å¾Ë†Ã¬Å ÂµÃ«â€¹Ë†Ã«â€¹Â¤. Ã¬Â£Â¼ Ã­Å¡Å’Ã¬â€ºÂÃ¬Ââ‚¬ ÃªÂ¸Â°Ã«Â³Â¸ ÃªÂ³â€žÃ¬â€¢Â½ Ã¬â€”Â°ÃªÂ²Â°Ã¬â€”Â ÃªÂ·Â¸Ã«Å’â‚¬Ã«Â¡Å“ Ã¬â€šÂ¬Ã¬Å¡Â©Ã«ÂÂ©Ã«â€¹Ë†Ã«â€¹Â¤.",
  },
  "Hoi vien chinh": {
    vi: "Hội viên chính",
    en: "Primary member",
    ko: "주 회원",
  },
  "Chi can 1 hoc vien thi block se hien theo hoi vien. Tu 2 hoc vien tro len he thong se hien Lich PT nhom. Hoc vien chinh van dung de gan hop dong chinh.": {
    vi: "Chỉ cần 1 hội viên thì block sẽ hiện theo hội viên. Từ 2 hội viên trở lên hệ thống sẽ hiện Lịch PT nhóm. Hội viên chính vẫn dùng để gắn hợp đồng chính.",
    en: "With 1 member, the block is shown as an individual PT session. With 2 or more members, it is shown as a Group PT session. The primary member is still used for the main contract.",
    ko: "회원이 1명이면 개별 PT 일정으로 표시됩니다. 2명 이상이면 PT 그룹 일정으로 표시됩니다. 주 회원은 기본 계약 연결에 그대로 사용됩니다.",
  },
};

const localizedStatusOverrides: Partial<Record<string, LocalizedValue>> = {
  ISSUED: { vi: "Äang phÃ¡t", en: "Issued", ko: "ì§€ê¸‰ ì¤‘" },
  LAUNDRY: { vi: "Äang giáº·t", en: "In laundry", ko: "ì„¸íƒ ì¤‘" },
  LOST: { vi: "Máº¥t", en: "Lost", ko: "ë¶„ì‹¤" },
  DAMAGED: { vi: "HÆ° há»ng", en: "Damaged", ko: "íŒŒì†" },
};

const supplementalPhraseEntries: PhraseEntry[] = [
  { source: "Ban le", vi: "BÃ¡n láº»", en: "Retail", ko: "ì†Œë§¤" },
  { source: "Khan / vat tu dich vu", vi: "KhÄƒn / váº­t tÆ° dá»‹ch vá»¥", en: "Towel / service item", ko: "ìˆ˜ê±´ / ì„œë¹„ìŠ¤ ìš©í’ˆ" },
  { source: "Dung chung", vi: "DÃ¹ng chung", en: "Shared use", ko: "ê²¸ìš©" },
  { source: "Khan / vat tu", vi: "KhÄƒn / váº­t tÆ°", en: "Towel / supplies", ko: "ìˆ˜ê±´ / ë¹„í’ˆ" },
  { source: "Loai vat tu", vi: "Loáº¡i váº­t tÆ°", en: "Item type", ko: "í’ˆëª© ìœ í˜•" },
  { source: "Ngay phat", vi: "NgÃ y phÃ¡t", en: "Issue date", ko: "ì§€ê¸‰ì¼" },
  { source: "Han tra", vi: "Háº¡n tráº£", en: "Return due date", ko: "ë°˜ë‚© ê¸°í•œ" },
  { source: "Dang phat", vi: "Äang phÃ¡t", en: "Issued", ko: "ì§€ê¸‰ ì¤‘" },
  { source: "Dang giat", vi: "Äang giáº·t", en: "In laundry", ko: "ì„¸íƒ ì¤‘" },
  { source: "Hu hong", vi: "HÆ° há»ng", en: "Damaged", ko: "íŒŒì†" },
];

const localizedEnumDomainOverrides: Partial<Record<string, Record<string, LocalizedValue>>> = {
  productUsageType: {
    RETAIL: { vi: "BÃ¡n láº»", en: "Retail", ko: "ì†Œë§¤" },
    TOWEL_SERVICE: { vi: "KhÄƒn / váº­t tÆ° dá»‹ch vá»¥", en: "Towel / service item", ko: "ìˆ˜ê±´ / ì„œë¹„ìŠ¤ ìš©í’ˆ" },
    BOTH: { vi: "DÃ¹ng chung", en: "Shared use", ko: "ê²¸ìš©" },
  },
};

const normalizeLocalizedValue = (value: LocalizedValue): LocalizedValue => ({
  vi: normalizeUtf8Text(value.vi),
  en: normalizeUtf8Text(value.en),
  ko: normalizeUtf8Text(value.ko),
});

const mergedExactText = Object.fromEntries(
  Object.entries({ ...exactText, ...localizedExactTextOverrides }).map(([key, value]) => [key, normalizeLocalizedValue(value)]),
) as Record<string, LocalizedValue>;

const mergedStatuses = Object.fromEntries(
  Object.entries({ ...statuses, ...localizedStatusOverrides }).flatMap(([key, value]) =>
    value ? [[key, normalizeLocalizedValue(value)]] : [],
  ),
) as Record<string, LocalizedValue>;

const mergedEnumDomains = Object.fromEntries(
  Object.entries(enumDomains).map(([domain, values]) => [
    domain,
    Object.fromEntries(
      Object.entries({
        ...values,
        ...(localizedEnumDomainOverrides[domain] || {}),
      }).flatMap(([key, value]) => (value ? [[key, normalizeLocalizedValue(value)]] : [])),
    ),
  ]),
) as Record<string, Record<string, LocalizedValue>>;

const normalizedSupplementalVietnameseExactText = Object.fromEntries(
  Object.entries(supplementalVietnameseExactText).map(([key, value]) => [key, normalizeUtf8Text(value)]),
) as Record<string, string>;

const localeLabels = Object.fromEntries(
  Object.entries(rawLocaleLabels).map(([key, value]) => [key, normalizeUtf8Text(value)]),
) as Record<AppLocale, string>;

const normalizedPhraseEntries = [...phraseEntries, ...supplementalPhraseEntries].map((entry) => ({
  source: normalizeUtf8Text(entry.source),
  vi: normalizeUtf8Text(entry.vi),
  en: normalizeUtf8Text(entry.en),
  ko: normalizeUtf8Text(entry.ko),
}));

type LocaleBundle = {
  languageLabel: string;
  exactText: Record<string, string>;
  phraseEntries: PhraseEntry[];
  statuses: Record<string, string>;
  enums: Record<string, Record<string, string>>;
  permissions: {
    modules: Record<string, string>;
    actions: Record<string, string>;
    roles: Record<string, string>;
    exactCodes: Record<string, string>;
  };
  masterData: {
    systemCatalogs: Record<string, Record<string, string>>;
    userManagedFields: Record<string, true>;
  };
};

const buildLocaleMap = <T extends Record<string, LocalizedValue>>(source: T, locale: AppLocale) =>
  Object.fromEntries(Object.entries(source).map(([key, value]) => [key, normalizeUtf8Text(value[locale])]));

const buildLocaleBundle = (locale: AppLocale): LocaleBundle => ({
  languageLabel: localeLabels[locale],
  exactText:
    locale === "vi"
      ? { ...buildLocaleMap(mergedExactText, locale), ...normalizedSupplementalVietnameseExactText }
      : buildLocaleMap(mergedExactText, locale),
  phraseEntries: normalizedPhraseEntries,
  statuses: buildLocaleMap(mergedStatuses, locale),
  enums: Object.fromEntries(Object.entries(mergedEnumDomains).map(([domain, values]) => [domain, buildLocaleMap(values, locale)])),
  permissions: {
    modules: buildLocaleMap(permissionModules, locale),
    actions: buildLocaleMap(permissionActions, locale),
    roles: buildLocaleMap(roleLabels, locale),
    exactCodes: buildLocaleMap(exactPermissionCodes, locale),
  },
  masterData: {
    systemCatalogs: {
      channel: buildLocaleMap(mergedEnumDomains.channel, locale),
      orientation: buildLocaleMap(mergedEnumDomains.orientation, locale),
      currencyScale: buildLocaleMap(mergedEnumDomains.currencyScale, locale),
      roundingMode: buildLocaleMap(mergedEnumDomains.roundingMode, locale),
      roleType: buildLocaleMap(mergedEnumDomains.roleType, locale),
    },
    userManagedFields: baseUserManagedFields,
  },
});

const localeBundleCache: Partial<Record<AppLocale, LocaleBundle>> = {};

export const getLocaleBundle = (locale: AppLocale = defaultLocale) => {
  const cached = localeBundleCache[locale];
  if (cached) {
    return cached;
  }

  const next = buildLocaleBundle(locale);
  localeBundleCache[locale] = next;
  return next;
};

export const localeBundles = {
  get vi() {
    return getLocaleBundle("vi");
  },
  get en() {
    return getLocaleBundle("en");
  },
  get ko() {
    return getLocaleBundle("ko");
  },
} as Record<AppLocale, LocaleBundle>;

export { localeLabels };
