Create a complete Arabic-first Tenant / Company Business Dashboard UI/UX for a SaaS poultry trading ERP product called “Poultry Hero”.

This screen is for the company/tenant side, not the SaaS Super Admin side.

The dashboard must be the first screen that a poultry distribution company owner sees after logging into their company account, for example:
companyname.poultryhero.com

The product is built for UAE poultry traders and poultry distribution companies. The users may include company owners, accountants, and cashier/sales employees. Many poultry company owners may be non-technical or have low education levels, so the UI must be extremely simple, visual, obvious, and easy enough for a child to understand.

Use Arabic-first design with RTL layout by default. Add a clear Arabic / English language switch. The interface should support English LTR, but Arabic is the primary experience.

Product name:
Poultry Hero

Tenant dashboard goal:
Give the company owner a simple daily business control center showing sales, purchases, inventory, expenses, customer balances, supplier balances, tax, and profit. The dashboard should help the owner answer quickly:

* How much did I sell today?
* How much did I buy today?
* How much did I spend today?
* How much profit did I make today?
* What stock is available?
* Which customers owe me money?
* Which suppliers do I owe money to?
* Are there low-stock products?
* Are there unpaid invoices?
* What should I do next?

Color system:

* Primary Brand: #0F2C59 Deep Navy — navigation, headers, primary buttons, active menu items.
* Secondary Accent: #22C55E Agri-Green — success, paid, positive profit, active status.
* Alert / Danger: #EF4444 Biosecurity Red — critical stock, overdue balances, losses, dangerous alerts.
* System Warning: #F59E0B Amber Yellow — pending invoices, low stock, upcoming payments.
* Background Neutral: #F8FAFC Slate White — main application background.
* Data Neutral: #64748B Cool Gray — secondary text, table borders, inactive states.

Visual style:

* Modern SaaS ERP.
* Clean poultry-industry business dashboard.
* Arabic local business friendly.
* Large readable numbers.
* Big icon-based actions.
* Minimal text.
* Simple business Arabic.
* High contrast.
* Rounded cards.
* Clear sections.
* Avoid clutter.
* Use visual status badges.
* Use simple charts only where useful.
* Make it professional but not complicated.

Required tenant roles:

1. Tenant Admin / Owner
   Can see all dashboard data, profit, users, settings, reports, and financial summaries.

2. Accountant
   Can see sales, purchases, tax, payments, receipts, customer/supplier balances, reports, and expenses.

3. Cashier / Sales Employee
   Can see quick sales actions, today’s sales, quotations, customers, payment collection, and limited inventory availability. Do not show full profit unless permission is granted.

Dashboard layout:
Create desktop and mobile versions.

Desktop layout:

* Top header.
* RTL sidebar navigation.
* Main dashboard content area.
* Right-to-left content alignment.
* Company name and logo in the header.
* Language switch.
* User profile menu.
* Date filter.
* Quick action button.

Mobile layout:

* Bottom navigation or collapsible menu.
* KPI cards in horizontal scroll or stacked layout.
* Large action buttons.
* Sticky “New Sale” button.
* Card-based lists instead of tables.
* RTL mobile layout.

Navigation menu:

* الرئيسية
* المبيعات
* عروض الأسعار
* المشتريات
* المخزون
* العملاء
* الموردين
* المدفوعات والتحصيلات
* المصروفات
* الحسابات
* الضريبة
* التقارير
* المستخدمين والصلاحيات
* الإعدادات

Top header:
Include:

* Company logo placeholder.
* Company name.
* Current branch/location placeholder if needed.
* Today’s date.
* Language switch: عربي / English.
* Notifications bell.
* User profile.
* Subscription status badge visible only to Tenant Admin:

  * Trial
  * Active
  * Suspended warning
  * Renewal soon

Primary dashboard KPIs:
Show these as large, simple cards with icons and Arabic labels:

1. مبيعات اليوم
   Today’s Sales

2. مشتريات اليوم
   Today’s Purchases

3. مصروفات اليوم
   Today’s Expenses

4. صافي ربح اليوم
   Today’s Net Profit

5. مبيعات الشهر
   Monthly Sales

6. مشتريات الشهر
   Monthly Purchases

7. مصروفات الشهر
   Monthly Expenses

8. صافي ربح الشهر
   Monthly Net Profit

9. العملاء المديونين
   Customers With Outstanding Balance

10. مستحقات الموردين
    Supplier Payables

11. المخزون المتاح
    Available Stock

12. منتجات منخفضة المخزون
    Low Stock Products

Profit calculation display:
Represent these formulas visually in simple Arabic tooltips:

Daily profit:
صافي ربح اليوم = مبيعات اليوم - مشتريات اليوم - مصروفات اليوم

Monthly profit:
صافي ربح الشهر = مجموع أرباح الأيام - مصروفات الشهر

Also include a small advanced tooltip for accountants:
“يمكن احتساب الربح التفصيلي لاحقاً بناءً على تكلفة الشراء وقيمة البيع لكل منتج.”

Expenses requirement:
Add a dashboard section for expenses.

Daily expenses examples:

* مصاريف سيارات
* مصاريف عمال
* مصاريف تشغيل
* مصروفات متنوعة

Monthly expenses examples:

* إيجار السكن
* إيجار السيارات
* الرواتب
* مصروفات شهرية ثابتة

Expenses card actions:

* إضافة مصروف يومي
* إضافة مصروف شهري
* عرض المصروفات

Quick actions section:
Create large easy buttons with icons:

* فاتورة بيع جديدة
* عرض سعر جديد
* فاتورة شراء جديدة
* تسجيل تحصيل من عميل
* تسجيل دفعة لمورد
* إضافة مصروف
* إضافة عميل
* إضافة مورد
* عرض المخزون
* طباعة تقرير اليوم

Make the “فاتورة بيع جديدة” button the most visually prominent.

Business health section:
Create a simple status panel called “حالة العمل اليوم”.

Show:

* Sales target progress.
* Profit status:

  * Green if positive.
  * Red if negative.
* Inventory status:

  * Green if stock is safe.
  * Amber if low stock.
  * Red if critical.
* Payment status:

  * Customers overdue.
  * Suppliers due soon.
* Tax status:

  * Tax collected this month.
  * Tax on purchases this month.

Inventory summary section:
Show:

* Total cartons available.
* Total pieces available.
* Total weight available in KG.
* Top available products.
* Low stock products.
* Products sold today.
* Products purchased today.
* Products withdrawn from slaughterhouse.
* Products remaining inside slaughterhouse.

Include a low-stock alert card:
Example:
“تنبيه: دجاج 1000 جرام منخفض في المخزون”

Inventory business rules to represent in UI:

* Purchases add stock after approval.
* Sales deduct stock after approval.
* Quotations do not deduct stock.
* Cancelled approved sales return stock.
* Sale cannot be approved if quantity exceeds available stock.
* Show clear warning if stock is not enough.

Sales summary section:
Show:

* Today’s invoices count.
* Today’s total sales.
* Cash sales.
* Bank sales.
* Credit/on-account sales.
* Unpaid or partially paid sales.
* Latest sales invoices.

Latest sales table/card fields:

* Invoice number.
* Customer.
* Total cartons.
* Total weight.
* Total amount.
* Paid amount.
* Remaining amount.
* Payment method.
* Status.
* Action: View / Print.

Purchases summary section:
Show:

* Today’s purchase invoices.
* Today’s total purchases.
* Cash purchases.
* Bank purchases.
* Credit/on-account purchases.
* Latest supplier invoices.

Customer balances section:
Show:

* Total customer receivables.
* Top customers owing money.
* Overdue customer balances.
* Recent collections.
* Button: “تحصيل من عميل”

Supplier balances section:
Show:

* Total supplier payables.
* Top suppliers to pay.
* Due supplier amounts.
* Recent supplier payments.
* Button: “دفع لمورد”

Tax summary section:
Show:

* Sales VAT this month.
* Purchase VAT this month.
* Net VAT estimate.
* Tax enabled/disabled status.
* Button: “تقرير الضريبة”

Use simple wording:

* ضريبة المبيعات
* ضريبة المشتريات
* صافي الضريبة

Reports shortcut section:
Create report cards:

* تقرير المبيعات
* تقرير المشتريات
* تقرير المخزون
* كشف حساب عميل
* كشف حساب مورد
* تقرير المصروفات
* تقرير الضريبة
* تقرير صافي الربح
* تقرير اليوم

Dashboard filters:
Add simple date filters:

* اليوم
* أمس
* هذا الأسبوع
* هذا الشهر
* فترة مخصصة

Also add:

* Customer filter.
* Supplier filter.
* Product filter.
* Payment method filter.

Use simple filter UI, not complex analytics UI.

Notifications and alerts:
Create a notification panel showing:

* Low stock warning.
* Customer overdue balance.
* Supplier payment due.
* Trial/subscription renewal reminder visible only to Tenant Admin.
* Tax report reminder.
* Invoice cancelled alert.
* Manual stock adjustment alert.

Charts:
Use only simple charts:

1. Daily sales vs purchases line chart.
2. Monthly profit bar chart.
3. Payment method donut chart:

   * Cash
   * Bank
   * Credit/on-account
4. Stock by product horizontal bar chart.

Avoid complex charts. The owner should understand the dashboard in seconds.

Important dashboard empty states:

* No sales today:
  “لا توجد مبيعات اليوم”
  Button: “إنشاء فاتورة بيع”

* No purchases today:
  “لا توجد مشتريات اليوم”
  Button: “إضافة فاتورة شراء”

* No expenses today:
  “لا توجد مصروفات اليوم”
  Button: “إضافة مصروف”

* No low stock:
  “المخزون بحالة جيدة”

* No outstanding customer balances:
  “لا توجد مبالغ مستحقة من العملاء”

* No supplier payables:
  “لا توجد مستحقات للموردين”

Important error/warning states:

* Negative profit today.
* Stock below minimum.
* Customer exceeded credit limit placeholder.
* Supplier payment overdue.
* Tax number missing in settings.
* Company stamp/signature missing in settings.
* Invoice numbering not configured.
* Subscription suspended warning for Tenant Admin.

UX simplification rules:

* Use big icons with every main action.
* Use simple Arabic words.
* Use numbers with AED clearly.
* Use KG clearly for weights.
* Use cartons and pieces clearly.
* Avoid technical accounting terms unless needed.
* Add small explanatory tooltips.
* Use green for good, amber for pending, red for danger.
* Make the dashboard actionable, not just analytical.
* Every alert should have an action button.

Poultry-specific terminology:
Use these Arabic terms:

* كرتونة
* حبة
* وزن
* كيلو
* سعر الكيلو
* المسلخ
* المشتريات
* المبيعات
* التحصيلات
* المدفوعات
* المصروفات
* صافي الربح

Sample poultry dashboard data:
Use realistic UAE sample data:

* Currency: AED
* Products:

  * دجاج 900 جرام
  * دجاج 1000 جرام
  * دجاج 1100 جرام
  * دجاج 1200 جرام
  * دجاج متحرك الوزن
* Customers:

  * مطعم الخليج
  * سوبر ماركت المدينة
  * مطبخ الإمارات
* Suppliers:

  * مزرعة العين للدواجن
  * شركة الإمارات للدواجن
* Payment methods:

  * كاش
  * حساب بنكي
  * آجل / على الحساب

Dashboard numbers should look realistic:

* Today’s sales: AED 18,450
* Today’s purchases: AED 11,200
* Today’s expenses: AED 850
* Today’s net profit: AED 6,400
* Monthly sales: AED 425,000
* Monthly purchases: AED 298,000
* Monthly expenses: AED 34,000
* Monthly net profit: AED 93,000

Access/permission visual behavior:
Create different dashboard variations or show labels explaining:

* Owner sees full financial dashboard and profit.
* Accountant sees accounts, tax, expenses, reports.
* Cashier sees sales actions, collections, quotations, and limited inventory.

Do not design deep module pages yet. This prompt should create:

1. Tenant dashboard app shell.
2. Tenant business dashboard desktop.
3. Tenant business dashboard mobile.
4. Role-based dashboard states.
5. Dashboard cards, charts, alerts, quick actions, and empty/error states.

The final design should feel like a real production SaaS ERP dashboard for poultry trading companies in the UAE. It must be simple enough for a non-technical poultry business owner, but strong enough for accountants and business operators.
