# Business Flow

## Giai đoạn 1: Phan tich he thong

### Muc tieu san pham
- Quan tri van hanh gym da chi nhanh theo mo hinh admin enterprise.
- Dong bo du lieu hoi vien, lead, hop dong, thu chi, tu do, kho, bao cao va he thong.
- Bao dam RBAC, audit log, export va so lieu dashboard truy van truc tiep tu database.

### Danh sach module
- Nen tang he thong: Auth, Users, Roles, Permissions, Branches, App Settings, Attachments, Audit Logs, Login OTP.
- CRM va hoi vien: Customers, Customer Groups, Customer Sources, Leads, Lead Logs, Reminders.
- Hop dong va goi tap: Services, Service Packages, Contracts, Contract Items, Contract Histories, Contract Conversions.
- Van hanh tap luyen: Trainers, Training Sessions, Training Attendance.
- Tai chinh va coc: Receipts, Expenses, Lockers, Locker Rentals, Deposits, Payment Methods.
- Kho co ban: Product Categories, Products, Suppliers, Purchase Orders, Purchase Order Items, Stock Movements.
- Bao cao: Dashboard Summary, KPI, Lead, Branch Revenue, Contract Remain Value, Payment, Deposit, Trainer Performance.
- Tich hop va cau hinh: Attendance Machines, SMS Configs, Email Configs, Zalo Configs, Zalo OTP Login, Birthday Templates, Notifications.

### Sitemap / Menu
- Tong quan
  - Dashboard tong quan
  - KPI ngay/thang
  - Bieu do doanh thu
  - Hoat dong gan day
- Hoi vien / Khach hang
  - Danh sach khach hang
  - Ho so hoi vien
  - Sinh nhat hoi vien
  - Nguon khach hang
  - Nhom khach hang
- Lead / CRM
  - Danh sach lead
  - Pipeline
  - Nhat ky cham soc
  - Lich hen
- Hop dong / Don hang
  - Danh sach hop dong
  - Tao moi
  - Gia han / chuyen doi
  - Goi tap / dich vu
  - Khuyen mai va gia tri con lai
- Lop PT / Dich vu / Buoi tap
  - Danh sach huan luyen vien
  - Lich tap
  - Buoi tap
  - Bao cao qua trinh tap
- Thu chi
  - Phieu thu
  - Phieu chi
  - Bao cao chi thu
- Tu do / Giu do / Coc
  - Danh sach tu
  - Phieu thue tu
  - Phieu coc
  - Bao cao tien coc
- Kho / Nhap hang / Ban hang
  - Danh muc hang hoa
  - Nha cung cap
  - Phieu nhap
  - Ton kho
- Bao cao
  - KPI
  - Lead
  - Doanh thu chi nhanh
  - Hop dong
  - Gia tri hop dong con lai
  - Chi thu
  - Coc giu do
  - Hoi vien hoat dong
  - Hieu suat nhan vien
- He thong / Thiet lap
  - Chi nhanh
  - Nguoi dung
  - Vai tro / quyen
  - Audit log
  - May cham cong
  - SMS / Email / Zalo
  - Mau sinh nhat
  - Cau hinh chung

### Luong nghiep vu chinh
1. Lead vao he thong tu kenh marketing hoac le tan.
2. Sales cham soc lead, cap nhat timeline, dat lich hen.
3. Lead du dieu kien duoc convert thanh customer/member.
4. Tao hop dong, ap dung goi tap/khuyen mai, sinh phieu thu.
5. Khach dat lich PT, check-in buoi tap, he thong tru so buoi con lai.
6. Thu chi, tieu dung kho, tu do/coc, cong no va so lieu bao cao duoc dong bo theo chi nhanh.
7. Tat ca thao tac quan trong duoc ghi audit log, phan quyen theo vai tro va branch scope.

### Danh sach vai tro va quyen
- Super Admin: toan quyen he thong.
- Chu he thong: xem va quan tri toan bo du lieu, duyet va cau hinh.
- Quan ly chi nhanh: quan ly du lieu trong branch, xem KPI branch.
- Le tan / Sales: lead, customer, contract, receipt trong pham vi duoc giao.
- Ke toan: receipts, expenses, reports, export.
- PT / Huan luyen vien: training sessions, attendance, customer progress.
- CSKH: customer notes, follow-up, reminders, birthdays.
- Nhan su: users, attendance machines, notifications.

### Ma tran quyen hanh dong
- `view`
- `create`
- `update`
- `delete`
- `restore`
- `approve`
- `export`
- `report`
- `branch_scope`
- `own_scope`
