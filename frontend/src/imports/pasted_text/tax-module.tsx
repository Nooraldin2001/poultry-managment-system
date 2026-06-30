Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Extend the current Tenant / Company Dashboard by adding the complete Tax Management Workflow.

The current app already includes:

* Super Admin SaaS dashboard
* Tenant dashboard
* Sales invoice workflow
* Purchase invoice workflow
* Inventory workflow
* Customers & Customer Accounts workflow
* Suppliers & Supplier Accounts workflow
* Expenses Management workflow
* Reports & Analytics workflow
* Settings + Users & Permissions workflow
* Product Master & Pricing Rules workflow
* Quotations workflow if already built
* Payments & Receipts Center workflow
* Arabic-first RTL layout
* English language switch
* Owner/Admin, Accountant, and Cashier/Sales role views
* Tenant navigation
* Separate module files such as ProductModule, CustomerModule, SupplierModule, PurchaseModule, InventoryModule, ExpensesModule, ReportsModule, SettingsModule, QuotationsModule, and PaymentsModule

Implementation direction:
Create a self-contained TaxModule file if that matches the current project structure. Keep files balanced and avoid making App.tsx too large. Wire tax screens into App.tsx using targeted edits only.

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
Tax screens must be simple enough for business owners, but detailed enough for accountants. Use clear Arabic, simple VAT cards, obvious warnings, and export buttons. Do not make it look like a government tax portal. This is an internal VAT management and reporting view only.

Use existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Important scope:

* This module does not submit VAT returns to the FTA.
* This module only helps the tenant review VAT on sales, VAT on purchases, missing TRNs, VAT warnings, and export internal reports.
* VAT default rate should be 5% in the mock UI.
* VAT can be enabled/disabled per invoice if settings and permissions allow.
* VAT rate changes require reason and audit log.
* VAT disabled invoices require reason if settings require it.
* Company TRN comes from settings.
* Customer TRN and Supplier TRN are optional but should generate warnings when missing from taxable invoices.
* Tax Credit Note is a placeholder workflow only, not a full implementation yet.

Confirmed business rules:

* Sales invoices may be taxable or non-taxable depending on settings.
* Purchase invoices may be taxable or non-taxable depending on supplier invoice.
* VAT amount is calculated automatically.
* VAT total appears on invoice/quotation/purchase records.
* VAT reports must be exportable as PDF and Excel.
* Owner/Admin can see and configure tax.
* Accountant can view/export tax reports and edit tax if permission enabled.
* Cashier cannot access tax management by default.
* Tax-sensitive changes require reason and audit log.

Required screens:

1. Tax Dashboard Screen

Arabic title:
إدارة الضريبة VAT

Create a simple VAT control center.

Top KPI cards:

* ضريبة المبيعات هذا الشهر
* ضريبة المشتريات هذا الشهر
* صافي الضريبة التقديري
* فواتير مبيعات ضريبية
* فواتير شراء ضريبية
* فواتير بدون ضريبة
* فواتير بها تحذيرات TRN
* تغييرات ضريبية يدوية

Formula card:
صافي الضريبة = ضريبة المبيعات - ضريبة المشتريات

Add explanation:
“هذا التقرير تقديري لمساعدة المحاسب، ولا يعتبر إقراراً ضريبياً مقدماً للهيئة.”

Dashboard sections:

* VAT trend chart by month
* Sales VAT vs Purchase VAT chart
* Missing TRN warnings list
* Recent tax-sensitive changes
* Quick actions:

  * تقرير ضريبة المبيعات
  * تقرير ضريبة المشتريات
  * تقرير صافي الضريبة
  * مراجعة تحذيرات TRN
  * إعدادات الضريبة

2. Sales VAT Report Screen

Arabic title:
تقرير ضريبة المبيعات

Filters:

* Date from
* Date to
* Customer
* Invoice status
* Taxable only
* Non-taxable only
* Missing customer TRN only
* VAT manually changed only
* Cash / bank / credit

KPI cards:

* إجمالي المبيعات قبل الضريبة
* إجمالي ضريبة المبيعات
* إجمالي المبيعات بعد الضريبة
* عدد الفواتير الضريبية
* فواتير بدون TRN للعميل
* فواتير تم تغيير الضريبة بها يدوياً

Desktop table columns:

* رقم الفاتورة
* التاريخ
* العميل
* TRN العميل
* الإجمالي قبل الضريبة
* نسبة VAT
* قيمة VAT
* الإجمالي بعد الضريبة
* حالة الضريبة
* حالة TRN
* المستخدم
* الإجراءات

Mobile:
Use tax invoice cards.

Status badges:

* ضريبية
* بدون ضريبة
* TRN مفقود
* الضريبة معدلة
* ملغاة
* مسودة

Actions:

* عرض الفاتورة
* طباعة الفاتورة
* تصدير التقرير PDF
* تصدير Excel
* عرض سجل التعديل

3. Purchase VAT Report Screen

Arabic title:
تقرير ضريبة المشتريات

Filters:

* Date from
* Date to
* Supplier
* Purchase status
* Taxable only
* Non-taxable only
* Missing supplier TRN only
* VAT manually changed only
* Supplier invoice number

KPI cards:

* إجمالي المشتريات قبل الضريبة
* إجمالي ضريبة المشتريات
* إجمالي المشتريات بعد الضريبة
* عدد فواتير الشراء الضريبية
* فواتير شراء بدون TRN للمورد
* فواتير شراء تم تغيير الضريبة بها يدوياً

Desktop table columns:

* رقم فاتورة الشراء
* رقم فاتورة المورد
* التاريخ
* المورد
* TRN المورد
* الإجمالي قبل الضريبة
* نسبة VAT
* قيمة VAT
* الإجمالي بعد الضريبة
* حالة الضريبة
* حالة TRN
* المستخدم
* الإجراءات

Actions:

* عرض فاتورة الشراء
* عرض مرفق فاتورة المورد
* تصدير PDF
* تصدير Excel
* عرض سجل التعديل

4. Net VAT Estimate Screen

Arabic title:
صافي الضريبة التقديري

Purpose:
Show the accountant a simple estimated net VAT position.

Sections:
A. Sales VAT

* Taxable sales total
* Sales VAT total
* Non-taxable sales total
* Cancelled sales excluded by default

B. Purchase VAT

* Taxable purchases total
* Purchase VAT total
* Non-taxable purchases total
* Purchase-linked VAT placeholder if needed

C. Net VAT
Formula:
صافي الضريبة = ضريبة المبيعات - ضريبة المشتريات

Show:

* If positive:
  “ضريبة مستحقة تقديرية”
* If negative:
  “رصيد ضريبي تقديري”

Add warning:
“هذه أرقام داخلية تقديرية ويجب مراجعتها محاسبياً قبل أي إقرار رسمي.”

Filters:

* Tax period
* Custom date range
* Include cancelled invoices toggle
* Include manually adjusted VAT toggle

Actions:

* Print VAT summary
* Export PDF
* Export Excel

5. Tax Warnings Screen

Arabic title:
تحذيرات الضريبة

Show all tax-related warnings in one place.

Warning types:

* Company TRN missing
* Customer TRN missing
* Supplier TRN missing
* VAT disabled on sales invoice
* VAT disabled on purchase invoice
* VAT rate changed manually
* VAT amount manually overridden
* Invoice has stamp/signature missing
* Purchase invoice attachment missing
* Tax invoice missing required print settings
* Quotation marked as tax invoice by mistake warning

KPI cards:

* إجمالي التحذيرات
* تحذيرات TRN
* تحذيرات الضريبة المعدلة
* تحذيرات قوالب الطباعة
* تحذيرات فواتير الشراء

Table columns:

* التاريخ
* نوع التحذير
* المرجع
* العميل / المورد
* الوصف
* الخطورة
* الحالة
* الإجراء المطلوب
* الإجراءات

Actions:

* فتح الفاتورة
* فتح الإعدادات
* حل التحذير placeholder
* تجاهل التحذير مع سبب

Severity:

* عالي = red
* متوسط = amber
* منخفض = gray

6. VAT Change Audit Screen

Arabic title:
سجل تغييرات الضريبة

Purpose:
Show all sensitive tax changes.

Tracked actions:

* VAT rate changed
* VAT disabled on invoice
* VAT enabled manually
* VAT amount overridden
* Customer TRN edited
* Supplier TRN edited
* Company TRN edited
* Tax settings changed
* Tax report exported
* Tax warning dismissed

Table columns:

* التاريخ والوقت
* المستخدم
* الدور
* القسم
* المرجع
* الإجراء
* القيمة السابقة
* القيمة الجديدة
* السبب
* مستوى الخطورة

Every sensitive change must show:

* Previous value
* New value
* Reason
* User
* Timestamp

Actions:

* View reference
* Export audit log
* Print

7. Tax Credit Note Placeholder Screen

Arabic title:
الإشعارات الدائنة الضريبية

Important:
This is a placeholder and planning screen only.

Show explanation:
“الإشعار الدائن الضريبي يستخدم لاحقاً عند تعديل أو تخفيض فاتورة ضريبية معتمدة.”

Create cards:

* إشعارات دائمة قادمة
* مرتجعات مبيعات قادمة
* تخفيض فاتورة ضريبية قادم
* ربط الإشعار بالفاتورة الأصلية قادم

Table placeholder columns:

* رقم الإشعار
* التاريخ
* الفاتورة الأصلية
* العميل
* سبب الإصدار
* المبلغ المخفض
* VAT المخفض
* الحالة

Button:
“إنشاء إشعار دائن”
Disabled with label:
“قريباً”

Helper:
“حالياً استخدم خصم عند التحصيل لتعديل رصيد العميل فقط، أو انتظر مرحلة الإشعارات الدائنة للمعالجة الضريبية الكاملة.”

8. Non-Taxable / VAT Disabled Invoices Screen

Arabic title:
فواتير بدون ضريبة

Purpose:
Review invoices where VAT was disabled.

Filters:

* Sales invoices
* Purchase invoices
* Date range
* Customer
* Supplier
* Reason required/missing
* User

Table columns:

* Reference
* Type
* Date
* Customer/Supplier
* Subtotal
* VAT expected
* VAT actual
* Reason
* Disabled by
* Status

Warnings:

* Missing reason
* VAT disabled without permission
* Company TRN missing
* Needs review

Actions:

* Open invoice
* Add reason
* Mark reviewed
* Export

9. Tax Settings Shortcut Panel

Arabic title:
إعدادات الضريبة المختصرة

This can link to the existing SettingsModule VAT screen.

Show:

* VAT enabled by default
* Default VAT rate 5%
* Company TRN
* Allow VAT disabled on sales
* Allow VAT disabled on purchases
* Require reason for VAT changes
* Require customer TRN warning
* Require supplier TRN warning
* Show VAT on print templates

Actions:

* فتح إعدادات الضريبة الكاملة
* تعديل TRN الشركة
* فتح قوالب الطباعة

Permission:
Only Owner/Admin can edit directly.
Accountant can edit if permission enabled.
Cashier cannot edit.

10. Tax Report Export Preview

Arabic title:
معاينة تصدير تقرير الضريبة

Before export, show:

* Report type
* Period
* Sales VAT total
* Purchase VAT total
* Net VAT estimate
* Number of warnings
* Included invoices count
* Excluded drafts
* Excluded cancelled invoices unless toggle enabled

Export options:

* PDF
* Excel

Print options:

* Include company header
* Include summary formulas
* Include warning list
* Include detailed invoice table

Loading state:
“جاري تجهيز تقرير الضريبة...”

Success state:
“تم تجهيز تقرير الضريبة بنجاح”

11. Tax Dashboard Empty / Error States

Show:

* No taxable sales:
  “لا توجد فواتير مبيعات ضريبية في هذه الفترة”

* No taxable purchases:
  “لا توجد فواتير شراء ضريبية في هذه الفترة”

* No VAT warnings:
  “لا توجد تحذيرات ضريبية حالياً”

* Missing company TRN:
  “رقم TRN للشركة غير موجود في الإعدادات”

* Permission denied:
  “ليس لديك صلاحية لعرض إدارة الضريبة”

* Export failed:
  “تعذر تجهيز التقرير، حاول مرة أخرى”

12. Role and Permission States

Owner/Admin:

* Can view tax dashboard
* Can view sales and purchase VAT reports
* Can export tax reports
* Can edit tax settings
* Can dismiss warnings with reason
* Can view VAT change audit log
* Can access tax credit note placeholder

Accountant:

* Can view tax dashboard
* Can view VAT reports
* Can export tax reports
* Can edit VAT settings only if permission enabled
* Can dismiss warnings only if permission enabled
* Can view audit if permission enabled

Cashier/Sales:

* Cannot access Tax Management by default
* Can only see invoice-level VAT fields inside allowed invoice screens
* Cannot edit VAT unless permission enabled
* Cannot export VAT reports

Show disabled buttons with tooltip:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

13. Validation and Warning States

Show:

* VAT rate cannot be negative
* VAT rate change requires reason
* VAT disabled requires reason
* Company TRN missing
* Customer TRN missing
* Supplier TRN missing
* VAT amount mismatch
* VAT report has warnings
* Draft invoices excluded
* Cancelled invoices excluded by default
* Tax report export loading
* Tax audit export loading
* Permission denied
* Tax credit note not available yet

14. Mobile Tax Experience

Create mobile responsive screens.

Mobile behavior:

* Tax dashboard as stacked KPI cards
* Sales VAT and purchase VAT as cards
* Warning list as cards
* Filters in bottom sheet
* Export buttons sticky at bottom
* Net VAT formula card easy to read
* Audit log cards simplified
* Cashier sees locked screen

15. Sample Data

Use realistic UAE poultry company sample data.

Sales VAT:

* Sales taxable subtotal: AED 425,000
* Sales VAT 5%: AED 21,250
* Sales grand total: AED 446,250

Purchase VAT:

* Purchase taxable subtotal: AED 298,000
* Purchase VAT 5%: AED 14,900
* Purchase total with VAT: AED 312,900

Net VAT:

* Net VAT estimate: AED 6,350

Warnings:

* Customer TRN missing on INV-2026-00046
* Supplier TRN missing on PUR-2026-00034
* VAT disabled on INV-2026-00051 with reason required
* VAT rate manually changed on PUR-2026-00035
* Company stamp missing in print template

Audit examples:

* Owner Admin changed VAT rate from 0% to 5% on invoice INV-2026-00046
* Ahmed Accountant disabled VAT on purchase invoice PUR-2026-00035 with reason
* Owner Admin updated company TRN
* Ahmed Accountant exported VAT report for June 2026

16. Navigation Integration

Connect:
Tenant sidebar “الضريبة” → Tax Dashboard.
Tenant dashboard tax card → Tax Dashboard.
Reports VAT card → Tax Dashboard or Net VAT Estimate.
Sales invoice VAT warning → Tax Warnings or VAT Settings.
Purchase invoice VAT warning → Tax Warnings or VAT Settings.
Settings VAT screen → Tax Settings Shortcut.
Tax warning row → related invoice or settings screen.
Tax report export buttons → Tax Export Preview.

17. App.tsx Wiring

Add tax-related TenantScreen values such as:

* tax
* tax-sales
* tax-purchases
* tax-net
* tax-warnings
* tax-audit
* tax-credit-notes
* tax-non-taxable
* tax-export-preview

Wire sidebar:
“الضريبة” should open Tax Dashboard.

Wire dashboard:
Tax summary card should open Tax Dashboard.

Mobile bottom navigation:
Put Tax under “المزيد” if no direct bottom nav item exists.

18. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use realistic mock data.
Focus on screens, flows, states, responsiveness, permissions, VAT warnings, audit history, export previews, and Arabic-first clarity.

The final result should feel like a real production Tax Management workflow for UAE poultry distribution companies, covering sales VAT, purchase VAT, net VAT estimate, TRN warnings, VAT disabled invoices, manual VAT changes, tax audit logs, exportable VAT reports, and tax credit note placeholders.
