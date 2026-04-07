# API Specification

## Auth
- `GET /auth/otp-config`
- `POST /auth/request-otp`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Nen tang
- `GET|POST /users`
- `GET|PATCH|DELETE /users/:id`
- `POST /users/:id/reset-password`
- `GET|POST /roles`
- `GET|PATCH|DELETE /roles/:id`
- `GET /permissions`
- `GET|POST /branches`
- `GET|PATCH|DELETE /branches/:id`
- `GET /audit-logs`
- `GET /audit-logs/:id`
- `GET|POST /attendance-machines`
- `GET|PATCH|DELETE /attendance-machines/:id`
- `POST /attendance-machines/:id/maintenance`
- `GET|POST /staff-attendance-events`
- `GET|PATCH|DELETE /staff-attendance-events/:id`
- `GET|POST /attachments/upload`

## CRM va hoi vien
- `GET|POST /customers`
- `GET|PATCH|DELETE /customers/:id`
- `GET /customers/:id/timeline`
- `GET|POST /customer-groups`
- `GET /customer-groups/:id`
- `GET|POST /customer-sources`
- `GET /customer-sources/:id`
- `GET /lead-sources`
- `GET|POST /leads`
- `GET|PATCH|DELETE /leads/:id`
- `POST /leads/:id/logs`

## Dich vu va hop dong
- `GET|POST /services`
- `GET|PATCH|DELETE /services/:id`
- `GET|POST /service-packages`
- `GET|PATCH|DELETE /service-packages/:id`
- `GET|POST /contracts`
- `GET|PATCH|DELETE /contracts/:id`
- `POST /contracts/:id/convert`
- `POST /contracts/:id/history`

## Van hanh tap luyen
- `GET|POST /trainers`
- `GET|PATCH|DELETE /trainers/:id`
- `GET|POST /training-sessions`
- `GET|PATCH|DELETE /training-sessions/:id`
- `POST /training-sessions/:id/check-in`

## Tai chinh va coc
- `GET /payment-methods`
- `GET|POST /receipts`
- `GET|PATCH|DELETE /receipts/:id`
- `GET|POST /expenses`
- `GET|PATCH|DELETE /expenses/:id`
- `GET|POST /lockers`
- `GET /lockers/:id`
- `GET|POST /deposits`
- `GET /deposits/:id`

## Kho
- `GET|POST /products`
- `GET|POST /suppliers`
- `GET|POST /purchase-orders`
- `GET|PATCH|DELETE /products/:id`
- `GET|PATCH|DELETE /suppliers/:id`
- `GET|PATCH|DELETE /purchase-orders/:id`

## Bao cao
- `GET /dashboard/summary`
- `GET /reports/kpi`
- `GET /reports/lead`
- `GET /reports/branch-revenue`
- `GET /reports/contract-remain`
- `GET /reports/payment`
- `GET /reports/deposit`
- `GET /reports/trainer-performance`
- `GET /reports/birthday`
- `GET /reports/follow-up`
- `GET /reports/checkin`
- `GET /reports/pt-training`
- `GET /reports/staff-attendance`
- `GET /reports/class-attendance`
- `GET /reports/allocation`
- `GET /reports/sales-summary`
- `GET /reports/debt`
- `GET /reports/branch-summary`
- `GET /reports/package-progress`
- `GET /reports/card-revenue`
- `GET /reports/staff-review`
- `GET /reports/lead-status`

## Cau hinh
- `GET|PATCH /settings/company`
- `GET|PATCH /settings/e-invoice`
- `GET|PATCH /settings/bank`
- `GET|PATCH /settings/code-generation`
- `GET|PATCH /settings/print-templates`
- `GET|PATCH /settings/report-templates`
- `GET|PATCH /settings/promotions`
- `GET|PATCH /settings/loyalty-points`
- `GET|PATCH /settings/loyalty-benefits`
- `GET|PATCH /settings/tags`
- `GET|PATCH /settings/custom-fields`
- `GET|PATCH /settings/marketing`
- `GET|PATCH /settings/rounding`
- `GET|PATCH /settings/penalty`
- `GET|PATCH /settings/email`
- `GET|PATCH /settings/sms`
- `GET|PATCH /settings/zalo`
- `GET|POST /settings/birthday-template`
- `PATCH /settings/birthday-template/:id`
- `GET|PATCH /settings/general`

## OTP Login Flow
- `GET /auth/otp-config`: lay trang thai bat/tat OTP dang nhap.
- `POST /auth/request-otp`: xac thuc identifier + password, tao challenge OTP va gui ma qua Zalo.
- `POST /auth/login`: neu OTP dang bat, bat buoc gui kem `otpChallengeId` va `otpCode`.
