Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Extend the current Tenant / Company Dashboard by adding the complete Reports & Analytics Workflow.

The current app already includes:

* Super Admin SaaS dashboard
* Tenant dashboard
* Sales invoice workflow
* Purchase invoice workflow
* Inventory workflow
* Customers & Customer Accounts workflow
* Suppliers & Supplier Accounts workflow
* Expenses Management workflow
* Arabic-first RTL layout
* English language switch
* Owner / Accountant / Cashier role views
* Tenant navigation
* Separate module files such as Sales/Purchase/Inventory/Customer/Supplier/Expenses modules

Implementation direction:
Create a self-contained ReportsModule file if that matches the current project structure. Keep files balanced and avoid making App.tsx too large. Wire the reports screens into App.tsx using targeted edits only.

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
Reports must be powerful for accountants but simple enough for poultry company owners. Use clear Arabic labels, visual KPI cards, simple filters, large export buttons, and easy explanations. Avoid complex accounting dashboards that confuse non-technical users.

Use existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Business rules:

* Reports must use approved transactions only by default.
* Draft invoices should not affect official reports.
* Cancelled invoices should appear only when the user enables “include cancelled”.
* Sales reports must include sales invoices, payments, remaining balances, collection discounts, and future sales returns placeholders.
* Purchase reports must include purchase invoices, supplier payments, purchase deductions, purchase-linked expenses, and future purchase returns placeholders.
* Inventory reports must include stock in, stock out, manual adjustments, stocktaking, cancellations, current balance, cartons, pieces, and KG.
* Customer reports must include balances, invoices, collections, collection discounts, and statements.
* Supplier reports must include balances, purchases, payments, deductions, and statements.
* Expense reports must include daily expenses, monthly expenses, recurring expenses, and purchase-linked expenses.
* Profit reports must include sales, purchases, FIFO cost estimate, expenses, and net profit.
* VAT/tax reports must include sales VAT, purchase VAT, net VAT estimate, and missing TRN warnings.
* Owner/Admin can see all reports.
* Accountant can see most financial reports.
* Cashier can only see limited operational reports if permission is enabled.
* Reports must support PDF and Excel export.
* Reports must support printing.

Required screens:

1. Reports Home Screen

Arabic title:
التقارير والتحليلات

Create a reports control center.

Top KPI cards:

* مبيعات اليوم
* مشتريات اليوم
* مصروفات اليوم
* صافي ربح اليوم
* مبيعات الشهر
* مشتريات الشهر
* مصروفات الشهر
* صافي ربح الشهر

Report category cards:

* تقارير المبيعات
* تقارير المشتريات
* تقارير المخزون
* تقارير العملاء
* تقارير الموردين
* تقارير المصروفات
* تقارير الضريبة
* تقارير صافي الربح
* تقرير اليوم
* كشف الحسابات

Each card should have:

* Icon
* Short Arabic description
* Quick action button
* Export shortcut if useful

Add quick filters at top:

* اليوم
* أمس
* هذا الأسبوع
* هذا الشهر
* فترة مخصصة

2. Daily Summary Report

Arabic title:
تقرير اليوم

Purpose:
Give the owner a simple end-of-day report.

Sections:

* Sales today
* Purchases today
* Collections today
* Supplier payments today
* Expenses today
* Net profit today
* Inventory movements today
* Unpaid invoices today
* Low stock alerts

KPI cards:

* Total sales
* Cash sales
* Bank sales
* Credit sales
* Total purchases
* Customer collections
* Supplier payments
* Daily expenses
* Net profit

Tables:
A. Sales invoices today
B. Purchase invoices today
C. Collections today
D. Supplier payments today
E. Expenses today
F. Stock movements today

Actions:

* Print daily report
* Export PDF
* Export Excel

3. Sales Reports Screen

Arabic title:
تقارير المبيعات

Report types as tabs/chips:

* إجمالي المبيعات
* المبيعات حسب العميل
* المبيعات حسب المنتج
* المبيعات حسب الفترة
* المبيعات كاش
* المبيعات عبر الحساب البنكي
* المبيعات الآجلة
* الفواتير غير المدفوعة
* الخصومات والتحصيلات

Filters:

* Date from / date to
* Customer
* Product
* Payment method
* Invoice status
* Cash / bank / credit
* User/cashier

KPI cards:

* Total sales
* Total VAT
* Total paid
* Total remaining
* Total cartons
* Total pieces
* Total KG
* Average invoice value

Charts:

* Sales over time line chart
* Sales by customer bar chart
* Sales by product horizontal bar chart
* Payment method donut chart

Table columns:

* Invoice number
* Date
* Customer
* Total cartons
* Total pieces
* Total KG
* Subtotal
* VAT
* Grand total
* Paid
* Remaining
* Payment method
* Status

Actions:

* View invoice
* Print invoice
* Export report PDF
* Export report Excel

4. Purchase Reports Screen

Arabic title:
تقارير المشتريات

Report types:

* إجمالي المشتريات
* المشتريات حسب المورد
* المشتريات حسب المنتج
* المشتريات حسب الفترة
* مشتريات كاش
* مشتريات عبر الحساب البنكي
* مشتريات آجلة
* الخصومات المرتبطة بالمشتريات
* المصروفات المرتبطة بالمشتريات

Filters:

* Date range
* Supplier
* Product
* Payment method
* Purchase status
* Purchase method:

  * بالكيلو
  * بالحبة
  * بالكرتون

KPI cards:

* Total purchases
* Supplier payables
* Total paid to suppliers
* Remaining supplier balance
* Purchase VAT
* Total cartons purchased
* Total pieces purchased
* Total KG purchased
* Purchase-linked deductions/costs

Charts:

* Purchases over time
* Purchases by supplier
* Purchases by product
* Supplier payment status donut

Table columns:

* Purchase invoice number
* Supplier invoice number
* Date
* Supplier
* Total cartons
* Total pieces
* Total KG
* Goods total
* Deductions/costs
* VAT
* Net payable
* Paid
* Remaining
* Status

5. Inventory Reports Screen

Arabic title:
تقارير المخزون

Report types:

* المخزون الحالي
* حركة المخزون
* المنتجات المشتراة
* المنتجات المباعة
* الكميات المتبقية
* المنتجات منخفضة المخزون
* الجرد والتعديلات
* تقييم المخزون FIFO

Filters:

* Product
* Product category
* Movement type
* Date range
* Low stock only
* Out of stock only

KPI cards:

* Total available cartons
* Total available pieces
* Total available KG
* Estimated inventory value
* Low stock products
* Out of stock products
* Stock added this period
* Stock deducted this period

Current stock table:

* Product
* Available cartons
* Available pieces
* Available KG
* Minimum stock
* Status
* FIFO estimated cost
* Last purchase
* Last sale

Movement table:

* Date
* Product
* Movement type
* Reference
* Cartons
* Pieces
* KG
* Balance after movement
* User
* Notes

Actions:

* View product detail
* Export PDF
* Export Excel
* Print stock report

6. Customer Reports Screen

Arabic title:
تقارير العملاء

Report types:

* أرصدة العملاء
* العملاء المديونين
* فواتير العملاء
* تحصيلات العملاء
* خصومات التحصيل
* كشف حساب عميل
* العملاء المتجاوزين للحد الائتماني

Filters:

* Customer
* Customer type
* Customer category
* Date range
* Balance status
* Credit limit exceeded
* Payment method

KPI cards:

* Total receivables
* Customers with balance
* Customers exceeded credit limit
* Total collections
* Total collection discounts
* Unpaid invoices
* Average collection time placeholder

Table columns:

* Customer
* Current balance
* Credit limit
* Credit usage
* Total sales
* Total collections
* Total discounts
* Last invoice
* Last collection
* Status

Actions:

* View customer profile
* Print statement
* Export customer report
* Send WhatsApp premium placeholder

7. Supplier Reports Screen

Arabic title:
تقارير الموردين

Report types:

* أرصدة الموردين
* مستحقات الموردين
* فواتير الشراء حسب المورد
* دفعات الموردين
* خصومات الموردين
* كشف حساب مورد

Filters:

* Supplier
* Supplier type
* Supplier category
* Date range
* Balance status
* Payment method

KPI cards:

* Total supplier payables
* Suppliers with balance
* Total purchases
* Total payments
* Total purchase deductions
* Unpaid purchase invoices

Table columns:

* Supplier
* Current balance
* Total purchases
* Total payments
* Total deductions
* Last purchase invoice
* Last payment
* Status

Actions:

* View supplier profile
* Print supplier statement
* Export supplier report
* Send WhatsApp premium placeholder

8. Expense Reports Screen

If the ExpensesModule already has an expense report, create a ReportsModule wrapper/entry that links to it.

Arabic title:
تقرير المصروفات

Show shortcut into existing ExpensesReportScreen and add summary cards:

* Total expenses
* Daily expenses
* Monthly expenses
* Purchase-linked expenses
* Recurring expenses
* Highest expense category

Do not duplicate the full expense report UI if it already exists. Reuse or visually link to the existing screen.

9. Tax / VAT Reports Screen

Arabic title:
تقرير الضريبة

Purpose:
Show UAE VAT summary.

Filters:

* Date range
* Sales VAT
* Purchase VAT
* Customer
* Supplier
* Taxable only
* Non-taxable only

KPI cards:

* ضريبة المبيعات
* ضريبة المشتريات
* صافي الضريبة
* فواتير بدون TRN
* فواتير بدون ضريبة
* فواتير ضريبية

Sections:
A. Sales VAT Summary

* Invoice number
* Date
* Customer
* Customer TRN
* Taxable amount
* VAT amount
* Grand total

B. Purchase VAT Summary

* Purchase invoice number
* Date
* Supplier
* Supplier TRN
* Taxable amount
* VAT amount
* Net payable

C. Net VAT Estimate
Formula:
صافي الضريبة = ضريبة المبيعات - ضريبة المشتريات

Warnings:

* Company TRN missing in settings
* Customer TRN missing
* Supplier TRN missing
* VAT disabled invoice
* Manually changed VAT rate

Actions:

* Export VAT report PDF
* Export VAT report Excel
* Print VAT summary

10. Profit Report Screen

Arabic title:
تقرير صافي الربح

This is very important.

Show simple profit calculation.

Filters:

* Date range
* Product
* Customer
* Supplier
* Include expenses
* Include purchase-linked costs
* Include collection discounts
* Include cancelled invoices toggle

KPI cards:

* Total sales
* FIFO cost of goods sold
* Gross profit
* Daily expenses
* Monthly expenses
* Purchase-linked expenses
* Collection discounts
* Net profit
* Profit margin %

Formula section:
إجمالي الربح = المبيعات - تكلفة البضاعة المباعة FIFO

صافي الربح = إجمالي الربح - المصروفات - الخصومات

Show simplified explanation:
“يتم احتساب تكلفة البضاعة المباعة بطريقة FIFO من أقدم مشتريات متاحة أولاً.”

Charts:

* Profit over time line chart
* Sales vs cost vs expenses bar chart
* Profit by product
* Profit by customer

Table columns:

* Date
* Reference
* Customer/Product
* Sales amount
* FIFO cost
* Gross profit
* Expenses/discounts
* Net profit
* Margin %

Warnings:

* Profit is estimated until all purchase costs are finalized
* Manual stock adjustments may affect inventory value
* Collection discounts reduce net profit

Visible to:

* Owner/Admin
* Accountant if permission enabled
  Hidden from:
* Cashier by default

11. Accounts Statement Center

Arabic title:
مركز كشوف الحساب

Purpose:
Quick access to customer and supplier statements.

Two tabs:

* كشوف العملاء
* كشوف الموردين

Customer statement search:

* Select customer
* Date range
* Print PDF
* Export Excel

Supplier statement search:

* Select supplier
* Date range
* Print PDF
* Export Excel

Recent exported statements:

* Date
* Account type
* Name
* Period
* Exported by
* Action

12. Report Builder / Custom Report Light

Arabic title:
تقرير مخصص

Keep this simple. Do not create a complex BI tool.

Allow user to choose:

* Report source:

  * Sales
  * Purchases
  * Inventory
  * Customers
  * Suppliers
  * Expenses
  * Tax
* Date range
* Columns to show
* Filters
* Group by:

  * Date
  * Customer
  * Supplier
  * Product
  * Payment method
* Export format:

  * PDF
  * Excel

Show preview table.

Add note:
“التقرير المخصص يساعدك على اختيار البيانات التي تريد عرضها فقط.”

13. Export / Print States

For all reports, include:

* Export PDF button
* Export Excel button
* Print button
* Loading state:
  “جاري تجهيز التقرير...”
* Success toast:
  “تم تجهيز التقرير بنجاح”
* Empty state:
  “لا توجد بيانات في هذه الفترة”
* Permission denied state:
  “ليس لديك صلاحية لعرض هذا التقرير”

14. Role and Permission States

Owner / Tenant Admin:

* Can view all reports
* Can export all reports
* Can view profit and valuation
* Can view tax
* Can view customer/supplier statements

Accountant:

* Can view financial reports
* Can view tax
* Can export reports
* Can view profit if permission enabled
* Can view statements

Cashier:

* Can view limited daily sales report if permission enabled
* Cannot view profit
* Cannot view full customer/supplier balances unless permission enabled
* Cannot export reports unless permission enabled

Show disabled buttons with tooltip:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

15. Reports Settings Panel

Arabic title:
إعدادات التقارير

Settings:

* Default report date range
* Default export format
* Show cancelled invoices in reports toggle
* Include draft invoices toggle, default off
* Include collection discounts in profit toggle
* Include purchase-linked expenses in profit toggle
* Allow accountant to view profit
* Allow cashier to view daily sales report
* Allow cashier to export reports
* Company report header settings:

  * Logo
  * Company name
  * TRN
  * Address
  * Footer notes

16. Mobile Reports Experience

Create mobile responsive reports.

Mobile behavior:

* Reports home as cards
* Filters in bottom sheet
* KPI cards stacked
* Tables become cards
* Export buttons sticky at bottom
* Charts simplified
* Profit report hidden/locked for cashier

17. Sample Data

Use realistic sample data:

Sales:

* Monthly sales: AED 425,000
* Today sales: AED 18,450
* Cash sales: AED 8,000
* Bank sales: AED 6,000
* Credit sales: AED 4,450

Purchases:

* Monthly purchases: AED 298,000
* Today purchases: AED 11,200
* Supplier payables: AED 50,442.86

Expenses:

* Today expenses: AED 850
* Monthly expenses: AED 39,050

Profit:

* FIFO COGS: AED 298,000
* Gross profit: AED 127,000
* Net profit: AED 87,950
* Margin: 20.7%

Inventory:

* Current inventory value: AED 128,450
* Low stock products: 2
* Out of stock products: 1

VAT:

* Sales VAT: AED 21,250
* Purchase VAT: AED 14,900
* Net VAT estimate: AED 6,350

Customers:

* Customer receivables: AED 35,400
* Customers exceeded credit limit: 1

Suppliers:

* Supplier payables: AED 50,442.86
* Unpaid purchase invoices: 4

18. Navigation Integration

Connect:
Tenant sidebar “التقارير” → Reports Home.
Dashboard “طباعة تقرير اليوم” → Daily Summary Report.
Dashboard profit cards → Profit Report if user has permission.
Dashboard tax card → Tax Report.
Customer statement buttons → Accounts Statement Center or Customer Statement.
Supplier statement buttons → Accounts Statement Center or Supplier Statement.
Expense report shortcut → Expense Reports Screen.
Inventory valuation shortcut → Inventory Reports / Valuation.
Report category cards → respective report screens.

Mobile bottom navigation:
Put Reports under “المزيد” if no direct bottom nav item exists.

19. App.tsx Wiring

Add report-related TenantScreen values such as:

* reports
* reports-daily
* reports-sales
* reports-purchases
* reports-inventory
* reports-customers
* reports-suppliers
* reports-expenses
* reports-tax
* reports-profit
* reports-statements
* reports-builder

Wire sidebar:
“التقارير” should open Reports Home.

Wire dashboard:
“طباعة تقرير اليوم” should open Daily Summary Report.
Profit cards should open Profit Report if allowed.
Tax summary should open Tax Report.

20. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use realistic mock data.
Focus on screens, flows, states, responsiveness, permissions, exports, report filters, Arabic-first labels, and business rule visibility.

The final result should feel like a real production Reports & Analytics workflow for UAE poultry distribution companies, covering sales, purchases, inventory, customers, suppliers, expenses, VAT, profit, daily summary, statements, and custom report preview.
