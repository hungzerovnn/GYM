# Browser Extension

Extension nay la lop thu 3 trong `Trung tam lien ket thiet bi`.

## Muc dich

- claim session tu trinh duyet dang mo kenh social/chat
- doc sidebar that tu Messenger Web va day danh sach hoi thoai vao inbox noi bo
- luu `deviceSecret` local trong `chrome.storage.local`
- gui heartbeat thu cong khi can

## Cai dat

1. Mo `chrome://extensions` hoac `edge://extensions`
2. Bat `Developer mode`
3. Chon `Load unpacked`
4. Tro den thu muc:
   - `tools/SocialBridge/browser-extension`

## Cach dung

1. Tao session trong `Mang xa hoi > Trung tam lien ket`, chon `Browser extension`
2. Copy `session token` hoac `pair code`
3. Mo popup extension
4. Nhap:
   - `Server API`
   - `Tenant`
   - `Session token` hoac `Pair code`
5. Bam `Claim session`
6. Sau khi thanh cong, extension se luu `device secret`
7. Mo tab `https://www.messenger.com/`, giu cot trai danh sach doan chat dang hien
8. Bam `Sync sidebar` de day danh sach thread that vao CRM
9. Neu can, bam `Heartbeat`

## Ghi chu

- Extension nay hien uu tien `Messenger Web` cho luong sync sidebar that.
- Neu can heartbeat nen tu dong theo chu ky, co the mo rong them service worker sau.
