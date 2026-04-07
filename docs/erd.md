# ERD Summary

## Nhom he thong
- `users` n-n `roles` qua `user_roles`
- `roles` n-n `permissions` qua `role_permissions`
- `users` n-1 `branches`
- `audit_logs` n-1 `users`, n-1 `branches`

## CRM va hoi vien
- `customers` n-1 `branches`
- `customers` n-1 `customer_groups`
- `customers` n-1 `customer_sources`
- `customer_files` n-1 `customers`
- `leads` n-1 `lead_sources`
- `leads` n-1 `branches`
- `leads` n-1 `users` (assigned staff)
- `lead_logs` n-1 `leads`
- `leads` 0..1 -> `customers` khi convert

## Hop dong va dich vu
- `services` 1-n `service_packages`
- `contracts` n-1 `customers`
- `contracts` n-1 `service_packages`
- `contracts` n-1 `branches`
- `contracts` n-1 `users` (sale)
- `contracts` 1-n `contract_items`
- `contracts` 1-n `contract_histories`
- `contract_conversions` link `old_contract_id` va `new_contract_id`

## Tap luyen
- `pt_trainers` n-1 `branches`
- `training_sessions` n-1 `contracts`
- `training_sessions` n-1 `customers`
- `training_sessions` n-1 `pt_trainers`
- `training_attendance` n-1 `training_sessions`

## Tai chinh
- `payment_methods` 1-n `payments_receipt`
- `payment_methods` 1-n `payments_expense`
- `payments_receipt` n-1 `customers`
- `payments_receipt` n-1 `contracts`
- `payments_expense` n-1 `branches`

## Tu do va coc
- `lockers` n-1 `branches`
- `locker_rentals` n-1 `lockers`
- `locker_rentals` n-1 `customers`
- `deposits` n-1 `customers`
- `deposits` 0..1 n-1 `locker_rentals`

## Kho
- `products` n-1 `product_categories`
- `products` n-1 `branches`
- `suppliers` n-1 `branches`
- `purchase_orders` n-1 `suppliers`
- `purchase_orders` n-1 `branches`
- `purchase_order_items` n-1 `purchase_orders`
- `purchase_order_items` n-1 `products`

## Cau hinh va tich hop
- `attendance_machines` n-1 `branches`
- `sms_configs`, `email_configs`, `zalo_configs`, `birthday_templates`, `app_settings` co the global hoac theo branch
- `attachments` gan da hinh theo `entity_type` + `entity_id`
