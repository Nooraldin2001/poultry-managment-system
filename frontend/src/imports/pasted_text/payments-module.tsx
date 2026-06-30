Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Extend the current Tenant / Company Dashboard by adding the complete Payments & Receipts Center Workflow.

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
* Quotations workflow
* Arabic-first RTL layout
* English language switch
* Owner/Admin, Accountant, and Cashier/Sales role views
* Tenant navigation
* Separate module files such as CustomerModule, SupplierModule, PurchaseModule, InventoryModule, ExpensesModule, ReportsModule, SettingsModule, ProductModule, and QuotationsModule

Implementation direction:
Create a self-contained PaymentsModule file if that matches the current project structure. Keep files balanced and avoid making App.tsx too large. Wire payment screens into App.tsx using targeted edits only.

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
Payments and receipts must be extremely clear for business owners and accountants. The user should immediately understand what money came in, what money went out, who paid, who is still owed, and which receipts were issued. Use simple Arabic, large status badges, obvious cash/bank icons, and strong separation between customer money received and supplier money paid.

Use existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Confirmed business rules:

* Customer collection records money received from customers.
* Supplier payment records money paid to suppliers.
* Customer collection can be linked to a specific sales invoice.
* Customer collection can also be recorded generally against customer account balance.
* Supplier payment can be linked to a specific purchase invoice.
* Supplier payment can also be recorded generally against supplier account balance.
* Payments can be full or partial.
* Payment methods include cash, bank transfer, cheque, and other.
* Payment records update customer/supplier balance.
* Receipts must be printable/exportable.
* Customer refunds and supplier refunds must be supported.
* Collection discounts already exist and should appear in the payment timeline but are not the same as cash collection.
* Supplier purchase deductions should appear in the supplier/payment context but are not the same as cash payment.
* Sensitive payment edits/cancellations require reason and audit log.
* WhatsApp sending is a premium feature.
* Cashier/Sales permissions are controlled by Admin.

Important terminology:
Use clear Arabic labels:

* تحصيل من عميل = money received from customer
* دفعة لمورد = money paid to supplier
* إيصال قبض = receipt for customer collection
* إيصال دفع = receipt for supplier payment
* استرجاع مبلغ للعميل = customer refund
* استرداد مبلغ من المورد = supplier refund
* طريقة الدفع = payment method
* خزنة = cash box
* حساب بنكي = bank account

Required screens:

1. Payments & Receipts Overview Screen

Arabic title:
المدفوعات والتحصيلات

Create a central financial operations dashboard.

Top KPI cards:

* تحصيلات اليوم
* دفعات الموردين اليوم
* صافي النقد اليوم
* كاش اليوم
* تحويلات بنكية اليوم
* شيكات اليوم
* مستحقات العملاء
* مستحقات الموردين

Secondary KPI cards:

* إيصالات قبض اليوم
* إيصالات دفع اليوم
* مبالغ مسترجعة للعملاء
* مبالغ مستردة من الموردين
* تحصيلات هذا الشهر
* دفعات الموردين هذا الشهر

Simple explanation banner:
“هذا المركز يعرض كل حركة مالية: تحصيل من عميل، دفعة لمورد، استرجاع مبلغ، واسترداد مبلغ.”

Quick action buttons:

* تسجيل تحصيل من عميل
* تسجيل دفعة لمورد
* استرجاع مبلغ للعميل
* استرداد مبلغ من المورد
* طباعة إيصال
* تقرير المدفوعات

Charts:

* Cash in vs cash out over last 7 days
* Payment methods donut chart:

  * Cash
  * Bank transfer
  * Cheque
  * Other
* Monthly collections vs supplier payments bar chart

Latest movements list:
Show last 10 financial movements with:

* Type
* Customer/Supplier
* Amount
* Method
* Reference
* User
* Time

2. All Payment Movements Screen

Arabic title:
كل الحركات المالية

This is a unified ledger-style list for all payment-related movements.

Movement types:

* تحصيل من عميل
* دفعة لمورد
* استرجاع مبلغ للعميل
* استرداد مبلغ من المورد
* خصم عند التحصيل
* خصم من مستحق المورد
* مصروف مرتبط
* تسوية حساب

Desktop table columns:

* رقم الحركة
* التاريخ
* النوع
* العميل / المورد
* المبلغ
* اتجاه الحركة
* طريقة الدفع
* مرتبط بفاتورة
* رقم الإيصال
* المستخدم
* الحالة
* الإجراءات

Direction badges:

* داخل / Money In = green
* خارج / Money Out = red
* تسوية / Adjustment = amber
* بدون حركة نقدية / Non-cash adjustment = gray

Mobile layout:
Use financial movement cards.

Filters:

* Date range
* Movement type
* Customer
* Supplier
* Payment method
* User
* Receipt status
* Linked invoice only
* Unlinked account payment only

Actions:

* View details
* Print receipt
* Export PDF
* Send WhatsApp premium
* Cancel movement if permission allowed

3. Customer Collection Screen / Modal

Arabic title:
تسجيل تحصيل من عميل

Support two modes:

Mode 1:
تحصيل على فاتورة محددة

Fields:

* Customer
* Select sales invoice
* Invoice total
* Already paid
* Invoice outstanding
* Amount collected
* Payment method:

  * كاش
  * تحويل بنكي
  * شيك
  * أخرى
* Payment date
* Cash box or bank account
* Reference number
* Notes
* Attachment upload

Mode 2:
تحصيل على حساب العميل

Fields:

* Customer
* Current customer balance
* Amount collected
* Payment method
* Payment date
* Cash box or bank account
* Reference number
* Notes
* Allocation method:

  * توزيع تلقائي على أقدم فواتير غير مدفوعة
  * توزيع يدوي على الفواتير
  * تسجيل كرصيد دائن للعميل

Show allocation preview:

* Invoice numbers affected
* Amount applied to each invoice
* Remaining customer balance after collection
* Credit balance if collection exceeds balance

Validation:

* Customer required
* Amount required
* Amount must be greater than zero
* Payment method required
* Bank reference required for bank transfer if settings require it
* Amount cannot exceed selected invoice outstanding unless account credit is allowed

After success:

* Show success card:
  “تم تسجيل التحصيل بنجاح”
* Actions:

  * طباعة إيصال قبض
  * إرسال واتساب premium
  * تسجيل تحصيل آخر
  * فتح حساب العميل

4. Supplier Payment Screen / Modal

Arabic title:
تسجيل دفعة لمورد

Support two modes:

Mode 1:
دفعة على فاتورة شراء محددة

Fields:

* Supplier
* Select purchase invoice
* Net payable
* Already paid
* Invoice outstanding
* Amount paid
* Payment method:

  * كاش
  * تحويل بنكي
  * شيك
  * أخرى
* Payment date
* Cash box or bank account
* Reference number
* Notes
* Attachment upload

Mode 2:
دفعة على حساب المورد

Fields:

* Supplier
* Current supplier balance
* Amount paid
* Payment method
* Payment date
* Cash box or bank account
* Reference number
* Notes
* Allocation method:

  * توزيع تلقائي على أقدم فواتير غير مدفوعة
  * توزيع يدوي على الفواتير
  * تسجيل كرصيد لنا عند المورد

Show allocation preview:

* Purchase invoice numbers affected
* Amount applied to each invoice
* Remaining supplier balance after payment
* Credit balance if payment exceeds payable

Validation:

* Supplier required
* Amount required
* Amount must be greater than zero
* Payment method required
* Bank reference required for bank transfer if settings require it
* Amount cannot exceed selected invoice outstanding unless supplier credit is allowed

After success:

* Show success card:
  “تم تسجيل دفعة المورد بنجاح”
* Actions:

  * طباعة إيصال دفع
  * إرسال واتساب premium
  * تسجيل دفعة أخرى
  * فتح حساب المورد

5. Customer Refund Screen

Arabic title:
استرجاع مبلغ للعميل

Purpose:
Record money returned to a customer.

Use cases:

* Customer overpaid
* Goods issue settlement
* Cancelled invoice with paid amount
* Account credit returned
* Manual refund

Fields:

* Customer
* Current customer balance
* Refund amount
* Refund reason
* Payment method:

  * كاش
  * تحويل بنكي
  * شيك
  * أخرى
* Cash box or bank account
* Refund date
* Reference number
* Related invoice optional
* Notes
* Attachment upload

Preview:

* Customer balance before refund
* Refund amount
* Customer balance after refund

Important warning:
“استرجاع المبلغ سيقلل الرصيد الدائن أو يزيد المبلغ المستحق حسب حالة حساب العميل.”

Validation:

* Customer required
* Refund amount required
* Reason required
* Amount must be greater than zero
* Cannot refund more than customer credit balance unless Owner/Admin confirms reason
* Reference required for bank transfer if settings require it

After success:

* Create refund receipt.
* Show button:
  “طباعة إيصال استرجاع”

6. Supplier Refund Screen

Arabic title:
استرداد مبلغ من المورد

Purpose:
Record money received back from supplier.

Use cases:

* Supplier overpaid
* Purchase cancellation
* Supplier credit returned
* Purchase deduction settled in cash
* Manual supplier refund

Fields:

* Supplier
* Current supplier balance
* Refund amount received
* Refund reason
* Payment method:

  * كاش
  * تحويل بنكي
  * شيك
  * أخرى
* Cash box or bank account
* Refund date
* Reference number
* Related purchase invoice optional
* Notes
* Attachment upload

Preview:

* Supplier balance before refund
* Refund amount
* Supplier balance after refund

Validation:

* Supplier required
* Amount required
* Reason required
* Payment method required
* Reference required for bank transfer if settings require it

After success:

* Create supplier refund receipt.
* Show button:
  “طباعة إيصال استرداد”

7. Receipt Detail Screen

Arabic title:
تفاصيل الإيصال

Receipt types:

* إيصال قبض من عميل
* إيصال دفع لمورد
* إيصال استرجاع للعميل
* إيصال استرداد من المورد
* إيصال تسوية

Show:

* Receipt number
* Receipt type
* Date
* Customer/Supplier
* Amount
* Payment method
* Reference number
* Linked invoice/account movement
* Created by
* Created time
* Notes
* Attachment
* Status

Statuses:

* Active
* Cancelled
* Reversed

Actions:

* Print receipt
* Export PDF
* Send WhatsApp premium
* Send Email placeholder
* Cancel receipt if permission allowed
* Duplicate receipt placeholder

Tabs:

* Details
* Linked invoice/account
* Attachments
* Audit Log

8. Receipt Preview / Print Screen

Arabic title:
طباعة الإيصال

Create printable bilingual receipt templates.

Receipt templates:
A. Customer collection receipt
Title:
إيصال قبض / Receipt Voucher

B. Supplier payment receipt
Title:
إيصال دفع / Payment Voucher

C. Customer refund receipt
Title:
إيصال استرجاع مبلغ / Refund Receipt

D. Supplier refund receipt
Title:
إيصال استرداد من مورد / Supplier Refund Receipt

Header:

* Company logo
* Company Arabic name
* Company English name
* TRN
* Phone
* Address
* Receipt number
* Date

Body:

* Received from / Paid to
* Customer/Supplier name
* Amount
* Amount in words
* Payment method
* Reference number
* Linked invoice number optional
* Description
* Notes

Footer:

* Prepared by
* Received by
* Approved by
* Company stamp
* Signature

Buttons:

* Print
* Export PDF
* Send WhatsApp premium
* Send Email placeholder

9. Receipt Numbering Settings

Arabic title:
إعدادات ترقيم الإيصالات

This can be a settings panel or link to existing numbering settings.

Document types:

* Customer collection receipts
* Supplier payment receipts
* Customer refund receipts
* Supplier refund receipts
* Adjustment receipts

Fields:

* Prefix
* Next number
* Reset rule:

  * No reset
  * Monthly
  * Yearly
* Preview

Examples:

* REC-2026-00019
* PAY-2026-00008
* REF-C-2026-00003
* REF-S-2026-00002

Changing numbering requires reason and audit log.

10. Payment Method Summary Screen

Arabic title:
ملخص طرق الدفع

Purpose:
Show cash, bank, cheque, and other payment summaries.

KPI cards:

* إجمالي الكاش الداخل
* إجمالي الكاش الخارج
* صافي الكاش
* التحويلات البنكية الداخلة
* التحويلات البنكية الخارجة
* الشيكات
* طرق أخرى

Sections:
A. Cash movements
B. Bank transfer movements
C. Cheque movements
D. Other movements

Table columns:

* Date
* Type
* Customer/Supplier
* Amount
* Direction
* Method
* Reference
* User

Filters:

* Date range
* Payment method
* Direction
* User
* Customer/Supplier

Actions:

* Export PDF
* Export Excel
* Print

11. Cash / Bank Accounts Placeholder Screen

Arabic title:
الخزنة والحسابات البنكية

Keep this simple as a UI placeholder.

Sections:

* Cash box balance placeholder
* Bank account list placeholder
* Today cash in
* Today cash out
* Bank transfers in
* Bank transfers out

Bank account card fields:

* Bank name
* Account nickname
* Current balance placeholder
* Active/inactive
* Last movement

Actions:

* Add bank account placeholder
* View movements
* Export

Note:
“إدارة الخزنة والحسابات البنكية سيتم ربطها لاحقاً بالقيود المالية.”

12. Cancel / Reverse Payment Flow

Arabic title:
إلغاء حركة مالية

This is sensitive and requires reason.

Trigger:

* Cancel customer collection
* Cancel supplier payment
* Cancel refund receipt
* Reverse wrong receipt

Confirmation modal:
Show:

* Movement type
* Receipt number
* Customer/Supplier
* Amount
* Payment method
* Linked invoice/account effect

Fields:

* Reason required
* Notes
* Confirmation checkbox:
  “أفهم أن إلغاء هذه الحركة سيعدل رصيد العميل أو المورد.”

Rules:

* Cancelling customer collection increases customer outstanding balance again.
* Cancelling supplier payment increases supplier payable balance again.
* Cancelling refund reverses the refund effect.
* Cancelled receipt remains visible for audit.
* Cancellation requires permission.
* Cancellation creates audit log.

13. Payments Reports Screen

Arabic title:
تقرير المدفوعات والتحصيلات

Filters:

* Date range
* Movement type
* Customer
* Supplier
* Payment method
* User
* Receipt status
* Linked invoice/account

KPI cards:

* Total customer collections
* Total supplier payments
* Total customer refunds
* Total supplier refunds
* Net cash movement
* Bank transfers total
* Cheque total
* Cancelled receipts

Charts:

* Collections vs supplier payments over time
* Payment method donut chart
* Cash in vs cash out bar chart
* Top customers by collection
* Top suppliers by payment

Table columns:

* Date
* Movement number
* Type
* Customer/Supplier
* Amount
* Direction
* Payment method
* Receipt number
* Reference
* User
* Status

Actions:

* Export PDF
* Export Excel
* Print report

14. Premium WhatsApp Receipt Sending

Arabic title:
إرسال الإيصال عبر واتساب

If premium disabled:
Show locked state:
“إرسال الإيصالات عبر واتساب متاح في باقات Pro و Enterprise.”
Buttons:

* Copy message manually
* Request upgrade placeholder

If premium enabled:
Fields:

* Customer/Supplier WhatsApp number
* Message template
* Attach receipt toggle
* Send button

Sample customer receipt message:
“مرحباً، تم تسجيل تحصيل بقيمة AED 1,000. مرفق إيصال القبض. شكراً لكم.”

Sample supplier payment message:
“مرحباً، تم تسجيل دفعة لكم بقيمة AED 3,000. مرفق إيصال الدفع. شكراً لكم.”

15. Payments Settings Panel

Arabic title:
إعدادات المدفوعات والإيصالات

Settings:

* Allow cashier to record customer collection
* Allow cashier to record supplier payment
* Allow cashier to issue refunds
* Require reference for bank transfer
* Require attachment above amount
* Allow account-level payment without invoice link
* Auto-allocate account payment to oldest invoices
* Allow manual allocation
* Allow customer credit balance
* Allow supplier credit balance
* Require reason when cancelling receipt
* Require reason for refunds
* Enable WhatsApp premium receipt sending
* Receipt template settings
* Receipt numbering settings

Permission note:
“يمكن التحكم في صلاحيات التحصيل والدفع حسب كل مستخدم من إعدادات الصلاحيات.”

16. Role and Permission States

Owner/Admin:

* Can view all payments and receipts
* Can record customer collections
* Can record supplier payments
* Can issue customer refunds
* Can record supplier refunds
* Can cancel/reverse payment movements
* Can print/export receipts
* Can view payment reports
* Can edit payment settings
* Can use WhatsApp premium if plan allows

Accountant:

* Can record collections/payments
* Can print/export receipts
* Can view reports
* Can issue refunds if permission enabled
* Can cancel receipts if permission enabled
* Can access cash/bank summary if permission enabled

Cashier/Sales:

* Can record customer collections if permission enabled
* Can print customer receipts if permission enabled
* Cannot record supplier payments by default
* Cannot issue refunds by default
* Cannot cancel receipts by default
* Cannot view full financial reports unless permission enabled

Show disabled buttons with tooltip:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

17. Validation and Error States

Show:

* Missing customer
* Missing supplier
* Missing amount
* Amount must be greater than zero
* Missing payment method
* Missing reference for bank transfer
* Attachment required
* Amount exceeds invoice remaining
* Amount exceeds customer credit balance
* Amount exceeds supplier credit balance
* Cannot cancel already cancelled receipt
* Reason required
* Permission denied
* Premium WhatsApp locked
* Receipt export loading
* Receipt printed successfully
* Payment saved successfully
* Refund saved successfully

18. Empty States

No payment movements:
“لا توجد حركات مالية حالياً”

No collections today:
“لا توجد تحصيلات اليوم”

No supplier payments today:
“لا توجد دفعات للموردين اليوم”

No receipts:
“لا توجد إيصالات”

No report data:
“لا توجد بيانات في هذه الفترة”

19. Mobile Payments Experience

Create mobile responsive screens.

Mobile behavior:

* Overview as KPI cards
* Big action buttons:

  * تحصيل
  * دفع مورد
  * استرجاع
  * إيصالات
* Movements list as cards
* Receipt preview mobile-friendly
* Payment forms as step-by-step sections
* Sticky save button
* Filters in bottom sheet
* Print/WhatsApp actions visible but premium locked if needed

20. Sample Data

Use realistic UAE poultry business sample data.

Customer collections:

* REC-2026-00019, مطعم الخليج, AED 1,000, Cash, linked to INV-2026-00046
* REC-2026-00020, سوبر ماركت المدينة, AED 3,500, Bank transfer, account payment

Supplier payments:

* PAY-2026-00008, WESTLAND FOODSTUFF TRADING LLC, AED 2,000, Bank transfer, linked to PUR-2026-00034
* PAY-2026-00009, MNM Foodstuff Trading LLC, AED 3,000, Cheque, account payment

Refunds:

* REF-C-2026-00003, Prime Fresh Meat LLC, AED 250, customer refund
* REF-S-2026-00002, WESTLAND, AED 300, supplier refund received

Payment method summary:

* Cash in today: AED 8,000
* Cash out today: AED 2,500
* Bank in today: AED 6,000
* Bank out today: AED 5,000
* Cheques today: AED 3,000
* Net cash movement: AED 5,500

21. Navigation Integration

Connect:
Tenant sidebar “المدفوعات والتحصيلات” → Payments Overview.
Tenant dashboard quick action “تسجيل تحصيل من عميل” → Customer Collection Modal.
Tenant dashboard quick action “تسجيل دفعة لمورد” → Supplier Payment Modal.
Customer profile “تسجيل تحصيل” → Customer Collection Modal with customer pre-selected.
Supplier profile “تسجيل دفعة للمورد” → Supplier Payment Modal with supplier pre-selected.
Sales invoice detail “Record Collection” → Customer Collection Modal linked to invoice.
Purchase invoice detail “Pay Supplier” → Supplier Payment Modal linked to purchase invoice.
Receipt row “Print” → Receipt Preview.
Reports payment shortcut → Payments Reports Screen.

22. App.tsx Wiring

Add payment-related TenantScreen values such as:

* payments
* payments-movements
* payments-customer-collection
* payments-supplier-payment
* payments-customer-refund
* payments-supplier-refund
* payment-receipt-detail
* payment-receipt-preview
* payments-method-summary
* payments-cash-bank
* payments-report
* payments-settings

Wire sidebar:
“المدفوعات والتحصيلات” should open Payments Overview.

Wire dashboard:
“تسجيل تحصيل من عميل” should open Customer Collection modal.
“تسجيل دفعة لمورد” should open Supplier Payment modal.

Mobile bottom navigation:
Put Payments under “المزيد” if there is no direct bottom nav item.

23. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use realistic mock data.
Focus on screens, flows, states, responsiveness, permissions, receipt printing, payment allocation, refunds, premium WhatsApp locks, and Arabic-first clarity.

The final result should feel like a real production Payments & Receipts Center for UAE poultry distribution companies, centralizing customer collections, supplier payments, refunds, receipts, cash/bank summaries, payment reports, and audit-safe cancellation flows.
