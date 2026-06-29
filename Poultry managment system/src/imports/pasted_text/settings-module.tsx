Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Extend the current Tenant / Company Dashboard by adding the complete Tenant Settings, Users, Roles & Permissions Workflow.

The current app already includes:

* Super Admin SaaS dashboard
* Tenant dashboard
* Sales invoice workflow
* Purchase invoice workflow
* Inventory workflow
* Customers & Customer Accounts workflow
* Suppliers & Supplier Accounts workflow
* Expenses Management workflow
* Reports & Analytics workflow if already built
* Arabic-first RTL layout
* English language switch
* Owner/Admin, Accountant, and Cashier/Sales role views
* Tenant navigation
* Separate module files such as CustomerModule, SupplierModule, PurchaseModule, InventoryModule, ExpensesModule, and ReportsModule

Implementation direction:
Create a self-contained SettingsModule file if that matches the current project structure. Keep files balanced and avoid making App.tsx too large. Wire settings screens into App.tsx using targeted edits only.

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
Settings and permissions must be powerful but not confusing. Use clear Arabic, simple tabs, grouped permissions, large toggles, warning messages, and explain every dangerous setting. The owner should understand what every permission does without technical language.

Use existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Confirmed business rules:

* Login uses email/password only.
* Tenant roles are only:

  1. Owner/Admin
  2. Accountant
  3. Cashier/Sales
* Tenant user count depends on the SaaS plan.
* Starting/default plan allows 3 users.
* If user limit is reached, block creating more users and show upgrade message.
* Admin can customize permissions per individual user.
* Permissions are role-based by default but can be overridden per user.
* Every sensitive action must require reason and must create an audit log entry.
* Product defaults are not part of this prompt. Product Master will be a separate prompt.
* Negative stock must stay disabled.
* FIFO is the locked costing method.
* WhatsApp actions are premium features and should show locked states if not included in plan.

Sensitive actions requiring reason + audit log:

* Edit sales price
* Override KG
* Change carton/pieces quantity after draft
* Approve invoice
* Cancel sales invoice
* Cancel purchase invoice
* Apply collection discount
* Increase customer credit limit
* Edit customer opening balance
* Edit supplier opening balance
* Edit supplier payable adjustment
* Manual stock adjustment
* Apply stocktaking differences
* Change VAT rate
* Disable VAT on invoice
* Edit invoice numbering
* Edit print template
* Change user permissions
* Suspend/reactivate user
* Export sensitive financial reports
* Delete/cancel expense
* Edit approved financial transaction

Required screens:

1. Settings Home Screen

Arabic title:
الإعدادات

Create a settings control center.

Top cards:

* بيانات الشركة
* المستخدمين والصلاحيات
* ترقيم المستندات
* الضريبة VAT
* قوالب الطباعة
* إعدادات الفواتير
* إعدادات الحسابات
* إعدادات المخزون
* إعدادات التقارير
* سجل العمليات

Each card should show:

* Icon
* Short Arabic explanation
* Status badge if incomplete
* Open button

Show setup completeness card:
“اكتمال إعدادات الشركة”
Progress examples:

* Logo uploaded
* TRN added
* Stamp uploaded
* Signature uploaded
* Invoice numbering configured
* Users configured
* VAT configured

Show warnings:

* TRN missing
* Stamp missing
* Signature missing
* Invoice numbering not configured
* User limit reached
* WhatsApp premium disabled

2. Company Profile Settings

Arabic title:
بيانات الشركة

Sections:

A. Company Identity
Fields:

* Company Arabic name
* Company English name
* Trade license number
* TRN
* Emirate
* Address Arabic
* Address English
* Phone
* Email
* Website optional

B. Branding
Upload areas:

* Company logo
* Company stamp
* Authorized signature

Show preview:

* Invoice header preview
* Receipt header preview
* Statement header preview

Warnings:

* “الشعار غير مرفوع”
* “الختم غير مرفوع”
* “التوقيع غير مرفوع”
* “رقم TRN غير موجود”

Actions:

* Save changes
* Preview invoice header
* Reset changes

Validation:

* Company name required
* TRN optional but validate format if entered
* Phone required
* Invalid email warning

3. Users List Screen

Arabic title:
المستخدمين

Top KPI cards:

* المستخدمين الحاليين
* الحد المسموح حسب الباقة
* المستخدمين النشطين
* المستخدمين الموقوفين
* Owner/Admin users
* Accountants
* Cashiers/Sales

Show SaaS plan user limit:
Example:
“الباقة الحالية تسمح بـ 3 مستخدمين”
Progress:
2 / 3 users used

If limit reached:
Show red/amber banner:
“تم الوصول إلى الحد الأقصى للمستخدمين في الباقة الحالية.”
Actions:

* ترقية الباقة placeholder
* تواصل مع الدعم placeholder

Table columns:

* الاسم
* البريد الإلكتروني
* الدور
* الحالة
* آخر تسجيل دخول
* صلاحيات مخصصة
* تاريخ الإنشاء
* الإجراءات

Actions:

* إضافة مستخدم
* تعديل
* تخصيص الصلاحيات
* إيقاف
* إعادة تفعيل
* إعادة تعيين كلمة المرور
* عرض سجل النشاط

Mobile:
Use user cards with role badge and status badge.

4. Create / Edit User Screen

Arabic title:
إضافة مستخدم جديد

Fields:

* Full name
* Email
* Role:

  * Owner/Admin
  * Accountant
  * Cashier/Sales
* Status:

  * Active
  * Inactive
* Temporary password
* Confirm temporary password
* Force password change on first login toggle
* Permission template:

  * Use role default permissions
  * Customize permissions for this user

Important:
Login is email/password only. Do not add phone login.

Validation:

* Name required
* Email required
* Invalid email
* Duplicate email
* Password required
* Password confirmation mismatch
* User limit reached
* At least one Owner/Admin must remain active

If user limit reached:
Disable save button and show:
“لا يمكن إضافة مستخدم جديد لأن الباقة الحالية وصلت للحد المسموح.”

5. Role Permissions Overview

Arabic title:
الصلاحيات حسب الدور

Create a clean permission matrix.

Roles:

* Owner/Admin
* Accountant
* Cashier/Sales

Permission groups:

* Dashboard
* Sales
* Quotations
* Purchases
* Inventory
* Customers
* Suppliers
* Expenses
* Payments & Receipts
* Reports
* Tax
* Settings
* Users
* Audit Logs
* Premium Communications

For each permission group, show:

* View
* Create
* Edit
* Approve
* Cancel/Delete
* Export/Print
* Sensitive action access

Owner/Admin:
Default all permissions enabled.

Accountant:
Default:

* Can view financial dashboard
* Can manage customers/suppliers
* Can record collections/payments
* Can view tax
* Can export reports
* Can create/edit expenses
* Can view profit if allowed
* Cannot manage users unless explicitly allowed

Cashier/Sales:
Default:

* Can create sales invoices/drafts
* Can select customers
* Can record collection if enabled
* Can view limited inventory availability
* Cannot see profit
* Cannot edit prices unless enabled
* Cannot cancel invoices unless enabled
* Cannot access supplier/purchase modules unless enabled

Add note:
“يمكن تعديل الصلاحيات لكل مستخدم بشكل منفصل من ملف المستخدم.”

6. Individual User Permissions Screen

Arabic title:
صلاحيات المستخدم

Purpose:
Allow Admin to customize permissions per individual user.

Header:

* User name
* Email
* Base role
* Effective permissions status
* Custom permissions enabled toggle

Show two modes:
A. Use role default permissions
B. Customize permissions

When customize is enabled:
Show grouped permission toggles.

Important permission toggles:

Sales:

* View sales
* Create sales draft
* Approve sales invoice
* Edit draft invoice
* Edit approved invoice placeholder
* Edit price
* Override KG
* Edit carton/pieces quantity
* Apply free product
* Change VAT
* Cancel approved sales invoice
* Record collection
* Apply collection discount
* Print/export invoice

Purchases:

* View purchases
* Create purchase draft
* Approve purchase invoice
* Edit purchase price
* Change purchase method
* Override KG/cartons/pieces
* Add purchase deductions/costs
* Cancel approved purchase
* Record supplier payment
* Upload supplier invoice

Inventory:

* View inventory
* View FIFO valuation
* Manual stock adjustment
* Apply stocktaking differences
* Edit minimum stock
* View stock movement
* Export inventory report

Customers:

* Create/edit customer
* View customer balance
* Set opening balance
* Edit credit limit
* Override credit limit
* Add special prices
* Add free products
* Stop/reactivate customer
* Print/export customer statement
* WhatsApp premium actions

Suppliers:

* View suppliers
* Create/edit supplier
* View supplier balance
* Set opening balance
* Add special purchase prices
* Add supplier agreements
* Record supplier payment
* Stop/reactivate supplier
* Print/export supplier statement
* WhatsApp premium actions

Expenses:

* View expenses
* Add daily expense
* Add monthly expense
* Add purchase-linked expense
* Edit expense
* Cancel expense
* Manage categories
* View profit impact
* Export expense reports

Reports:

* View daily report
* View sales reports
* View purchase reports
* View inventory reports
* View customer/supplier reports
* View tax report
* View profit report
* Export reports
* Use custom report builder

Settings:

* View settings
* Edit company profile
* Edit VAT settings
* Edit numbering settings
* Edit print templates
* Edit permission settings
* Manage users
* View audit logs

Show effective permissions preview:
“الصلاحيات الفعلية لهذا المستخدم”

Show warning:
“تعديل صلاحيات المستخدم سيتم تسجيله في سجل العمليات.”

Require reason when saving permission changes.

7. Sensitive Action Rules Screen

Arabic title:
قواعد الإجراءات الحساسة

Purpose:
Central place to define actions that require reason and audit logging.

Show table:

* Action name
* Module
* Requires reason
* Requires permission
* Requires Owner/Admin only
* Audit log enabled
* Status

Actions list:

* تعديل سعر البيع
* تعديل سعر الشراء
* تعديل الكيلو يدوياً
* تغيير الضريبة
* إلغاء فاتورة بيع
* إلغاء فاتورة شراء
* خصم عند التحصيل
* رفع الحد الائتماني
* تعديل رصيد افتتاحي للعميل
* تعديل رصيد افتتاحي للمورد
* تعديل مخزون يدوي
* تطبيق فروقات الجرد
* تعديل ترقيم الفواتير
* تعديل قالب الطباعة
* تغيير صلاحيات مستخدم
* إيقاف مستخدم
* تصدير تقرير مالي حساس

Each row:

* Toggle reason required
* Toggle audit enabled locked ON
* Risk level badge:

  * عالي
  * متوسط
  * منخفض

Important:
Audit logging should appear locked/enforced for all sensitive actions.

Show note:
“لا يمكن إيقاف سجل العمليات للإجراءات الحساسة.”

8. Reason Required Modal Pattern

Create a reusable modal design shown whenever a sensitive action happens.

Arabic title examples:

* سبب تعديل السعر
* سبب إلغاء الفاتورة
* سبب تعديل المخزون
* سبب رفع الحد الائتماني

Fields:

* Action summary
* Previous value
* New value
* Reason required
* Notes optional
* Confirmation checkbox for dangerous actions

Buttons:

* تأكيد
* إلغاء

Validation:

* Reason is required
* Confirmation checkbox required for cancellation/stock actions

This modal should be visually referenced across settings as the standard sensitive action modal.

9. Audit Log Screen

Arabic title:
سجل العمليات

Create tenant-level audit log.

Filters:

* Date range
* User
* Module
* Action type
* Risk level
* Sensitive actions only
* Reference number

Table columns:

* التاريخ والوقت
* المستخدم
* الدور
* القسم
* الإجراء
* المرجع
* القيمة السابقة
* القيمة الجديدة
* السبب
* IP placeholder
* الحالة

Action categories:

* User created
* User suspended
* Permission changed
* Price edited
* KG overridden
* Invoice approved
* Invoice cancelled
* Credit limit increased
* Stock adjusted
* VAT changed
* Numbering changed
* Print template changed
* Report exported

Use color badges:

* High risk = red
* Medium risk = amber
* Low risk = gray
* Success = green

Actions:

* View details
* Export audit log
* Print audit log

Permission:
Visible to Owner/Admin.
Accountant can view only if permission enabled.
Cashier cannot view.

10. Numbering Settings Screen

Arabic title:
إعدادات ترقيم المستندات

Documents:

* Sales invoices
* Purchase invoices
* Quotations
* Customer receipts
* Supplier payment receipts
* Expense vouchers
* Collection adjustments
* Stock adjustments
* Customer statements
* Supplier statements

For each document type:
Fields:

* Prefix
* Next number
* Number length
* Reset rule:

  * No reset
  * Monthly
  * Yearly
* Preview
* Active toggle

Examples:

* INV-2026-00045
* PUR-2026-00034
* QUO-2026-00012
* REC-2026-00018
* PAY-2026-00007
* EXP-2026-00022
* ADJ-2026-00004

Warnings:

* Changing numbering affects new documents only.
* Duplicate numbering not allowed.
* Reason required when changing numbering.

Actions:

* Save numbering
* Preview all
* Reset to default

11. VAT / Tax Settings Screen

Arabic title:
إعدادات الضريبة VAT

Fields:

* VAT enabled by default
* Default VAT rate, 5%
* Allow VAT disabled on sales invoice
* Allow VAT disabled on purchase invoice
* Allow VAT rate edit by permission
* Require customer TRN for tax invoice toggle
* Require supplier TRN for purchase VAT toggle
* Show VAT warnings toggle
* Company TRN display

Show VAT preview:

* Subtotal
* VAT 5%
* Grand total

Warnings:

* TRN missing
* VAT enabled but company TRN missing
* VAT rate changed requires reason
* VAT disabled requires reason

12. Print Template Settings Screen

Arabic title:
قوالب الطباعة

Templates:

* Sales tax invoice
* Purchase internal record
* Customer receipt
* Supplier payment receipt
* Expense voucher
* Customer statement
* Supplier statement
* Daily report

For each template:
Fields:

* Show company logo
* Show company stamp
* Show signature
* Show TRN
* Show Arabic labels
* Show English labels
* Show amount in words
* Footer notes
* Receiver signature required
* Paper size:

  * A4
  * Thermal receipt placeholder
* Preview button

Show live preview card.

Warnings:

* Logo missing
* Stamp missing
* Signature missing
* TRN missing

Permission:
Only Owner/Admin can edit by default.
Accountant can edit if permission enabled.

13. Invoice & Transaction Settings Screen

Arabic title:
إعدادات الفواتير والمعاملات

Sales settings:

* Allow save draft
* Stock deduction only on approval locked ON
* Prevent sales above available stock locked ON
* Allow collection discount
* Require reason for collection discount
* Allow price edit by permission
* Allow KG override by permission
* Allow free product by permission
* Require reason for invoice cancellation

Purchase settings:

* Allow save draft
* Stock addition only on approval locked ON
* Allow purchase price edit by permission
* Allow purchase-linked costs/deductions
* Require supplier invoice number warning
* Warn duplicate supplier invoice number
* Require reason for purchase cancellation

Inventory settings:

* Allow manual stock adjustment
* Require reason for stock adjustment locked ON
* Negative stock disabled locked ON
* Costing method FIFO locked
* Low stock alerts enabled

Customer settings:

* Default credit limit
* Block sales when credit limit exceeded
* Allow Owner/Admin credit override
* Require reason for credit limit increase
* Enable customer special prices
* Enable customer free products

Supplier settings:

* Track supplier balance
* Enable supplier special prices
* Enable supplier agreements
* Allow cashier supplier access by permission

14. Premium Features / Plan Limits Screen

Arabic title:
الباقة والميزات

Show tenant current SaaS plan:

* Basic / Pro / Enterprise
* Status: Trial / Active / Suspended
* Renewal date
* User limit
* Users used
* Premium communications status

Feature list:

* User limit
* WhatsApp invoice sending
* WhatsApp statement sending
* WhatsApp payment reminders
* Custom reports
* Advanced profit analytics
* Multi-branch placeholder
* API access placeholder

Show locked premium features:

* واتساب للعملاء
* واتساب للموردين
* تذكير بالدفع
* إرسال كشف الحساب
* تقارير متقدمة

If feature locked:
Show:
“هذه الميزة متاحة في باقة Pro أو Enterprise.”

Actions:

* Request upgrade placeholder
* Contact support placeholder

15. Security Settings Screen

Arabic title:
إعدادات الأمان

Login method:

* Email/password only

Fields/settings:

* Require strong password
* Minimum password length
* Force password change on first login
* Session timeout
* Lock user after failed attempts
* Password reset by Owner/Admin
* Last login tracking
* Active sessions placeholder

Do not add phone login.
Do not add OTP unless marked future placeholder.

16. Settings Search

Add search bar at top of settings:
“ابحث في الإعدادات”

Search examples:

* VAT
* TRN
* رقم الفاتورة
* الصلاحيات
* الختم
* المستخدمين
* واتساب
* المخزون

Show results as setting cards.

17. Role and Permission States

Owner/Admin:

* Can access all settings
* Can manage users
* Can customize permissions
* Can edit numbering
* Can edit VAT
* Can edit templates
* Can view audit logs
* Can manage premium feature settings display

Accountant:

* Can view selected settings
* Can edit financial settings if permission enabled
* Can view audit logs if permission enabled
* Cannot manage users by default
* Cannot change plan limits

Cashier/Sales:

* No settings access by default
* Can view own profile only
* Cannot change permissions
* Cannot view audit logs
* Cannot edit company/tax/numbering settings

Show disabled buttons with tooltip:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

18. Empty States

No users:
“لا يوجد مستخدمين بعد”

No audit logs:
“لا توجد عمليات مسجلة حتى الآن”

No custom permissions:
“يستخدم هذا المستخدم صلاحيات الدور الافتراضية”

No uploaded stamp:
“لم يتم رفع الختم بعد”

No uploaded signature:
“لم يتم رفع التوقيع بعد”

19. Mobile Settings Experience

Create mobile responsive settings.

Mobile behavior:

* Settings home as cards
* Users as cards
* Permissions matrix becomes grouped accordion
* Settings panels become full-screen sheets
* Large toggles
* Sticky save button
* Audit logs as cards
* Numbering preview stacked
* Print template preview scrollable

20. Sample Data

Use realistic sample data:

Tenant:
Prime Fresh Meat LLC
Plan: Basic
User limit: 3
Users used: 3
Status: Active
Renewal date: 30/09/2026

Users:

1. Owner Admin
   Email: [owner@primefresh.ae](mailto:owner@primefresh.ae)
   Role: Owner/Admin
   Status: Active
   Custom permissions: No

2. Ahmed Accountant
   Email: [accountant@primefresh.ae](mailto:accountant@primefresh.ae)
   Role: Accountant
   Status: Active
   Custom permissions: Yes

3. Sale Cashier
   Email: [cashier@primefresh.ae](mailto:cashier@primefresh.ae)
   Role: Cashier/Sales
   Status: Active
   Custom permissions: Yes

User limit banner:
“تم استخدام 3 من 3 مستخدمين في الباقة الحالية”

Numbering previews:
INV-2026-00046
PUR-2026-00035
REC-2026-00019
PAY-2026-00008
EXP-2026-00023

Audit examples:

* Sale Cashier attempted price edit without permission
* Owner Admin increased customer credit limit from AED 15,000 to AED 20,000
* Ahmed Accountant changed VAT setting from disabled to enabled
* Owner Admin cancelled sales invoice INV-2026-00046
* Owner Admin applied stock adjustment for 1000 GRAM
* Ahmed Accountant exported profit report

21. Navigation Integration

Connect:
Tenant sidebar “الإعدادات” → Settings Home.
Tenant sidebar “المستخدمين والصلاحيات” → Users List or Permissions Overview.
Settings card “المستخدمين” → Users List.
Settings card “الصلاحيات” → Role Permissions Overview.
User row “Customize permissions” → Individual User Permissions.
Settings card “سجل العمليات” → Audit Log.
Settings card “ترقيم المستندات” → Numbering Settings.
Settings card “الضريبة VAT” → VAT Settings.
Settings card “قوالب الطباعة” → Print Template Settings.
Settings card “الباقة والميزات” → Premium Features / Plan Limits.
Settings card “الأمان” → Security Settings.

Wire existing module settings links:

* Invoice numbering link → Numbering Settings
* Print template link → Print Template Settings
* VAT warning link → VAT Settings
* User limit warning → Premium Features / Plan Limits
* Permission denied tooltip can link to Permissions if Owner/Admin

22. App.tsx Wiring

Add settings-related TenantScreen values such as:

* settings
* settings-company
* settings-users
* settings-user-new
* settings-user-permissions
* settings-roles
* settings-sensitive-actions
* settings-audit
* settings-numbering
* settings-vat
* settings-print-templates
* settings-transactions
* settings-plan
* settings-security

Wire sidebar:
“الإعدادات” should open Settings Home.
“المستخدمين والصلاحيات” should open Users/Permissions.

Mobile bottom navigation:
Put Settings under “المزيد” if there is no direct bottom nav item.

23. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use realistic mock data.
Focus on screens, flows, states, responsiveness, permissions, plan limits, premium locks, audit reasons, settings UX, and Arabic-first clarity.

The final result should feel like a real production Settings + Users & Permissions workflow for UAE poultry distribution companies, with company profile, users, plan user limit, custom permissions per user, sensitive action reason requirements, audit logs, numbering, VAT, print templates, invoice rules, security settings, and premium feature locks.
