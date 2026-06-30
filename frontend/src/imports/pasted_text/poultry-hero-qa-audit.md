Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Perform a complete Final UI/UX QA, Navigation Consistency, Role Permission, and Missing Screens Audit across the entire Poultry Hero SaaS tenant and super admin interface.

This is a quality-control and cleanup phase, not a new business module.

The current app includes multiple completed phases:

* Super Admin SaaS dashboard
* Tenant company dashboard
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
* Payments & Receipts Center workflow
* Tax Management workflow
* Arabic-first RTL layout
* English language switch
* Owner/Admin, Accountant, and Cashier/Sales role views
* Mobile responsive behavior
* Separate module files such as ProductModule, CustomerModule, SupplierModule, PurchaseModule, InventoryModule, ExpensesModule, ReportsModule, SettingsModule, QuotationsModule, PaymentsModule, and TaxModule

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first RTL by default.
Support English LTR through the existing language switch.

Main goal:
Make the UI/UX feel like one polished production SaaS ERP product, not separate disconnected modules.

Do not add backend logic.
Do not rebuild modules from scratch.
Do not remove existing business functionality.
Apply targeted improvements, fixes, consistency updates, missing navigation links, naming cleanup, and UX polish only.

Use the existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Required QA work:

1. Global Navigation Audit

Check the tenant sidebar navigation and make sure every main module opens the correct screen.

Required tenant sidebar items:

* الرئيسية
* المبيعات
* عروض الأسعار
* المشتريات
* المخزون
* المنتجات
* العملاء
* الموردين
* المدفوعات والتحصيلات
* المصروفات
* الحسابات
* الضريبة
* التقارير
* المستخدمين والصلاحيات
* الإعدادات

For each sidebar item:

* Confirm it opens the correct screen.
* Confirm active state highlights correctly.
* Confirm Arabic label is consistent.
* Confirm English label works when language is switched.
* Confirm mobile navigation highlights related sub-screens correctly.

Fix any missing or broken screen mapping.

2. Dashboard Quick Actions Audit

Review all tenant dashboard quick action buttons.

Required quick actions:

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

For each quick action:

* Confirm it opens the correct screen or modal.
* Confirm it works on desktop and mobile.
* Confirm it respects user permissions.
* Confirm it does not show “screen not found”.
* Confirm the related module can navigate back to dashboard.

3. Cross-Module Navigation Audit

Check all cross-module links.

Required links:

* Customer profile → New sales invoice with customer pre-selected.
* Customer profile → Customer statement.
* Customer profile → Customer collection modal.
* Customer special price → Product selector.
* Supplier profile → New purchase invoice with supplier pre-selected.
* Supplier profile → Supplier statement.
* Supplier profile → Supplier payment modal.
* Supplier special price → Product selector.
* Sales invoice → Customer profile.
* Sales invoice → Product detail.
* Sales invoice → Collection modal.
* Sales invoice → Invoice preview.
* Sales invoice → Tax warning screen.
* Purchase invoice → Supplier profile.
* Purchase invoice → Inventory movement.
* Purchase invoice → Supplier payment modal.
* Inventory product detail → Product detail.
* Product detail → Inventory detail.
* Product detail → Sales report filtered by product.
* Product detail → Purchase report filtered by product.
* Quotation → Convert to sales invoice.
* Quotation → Customer profile.
* Payment receipt → Customer or Supplier profile.
* Reports → Related detail screens.
* Tax warnings → Related invoice or settings screen.
* Settings links → correct settings panels.

Fix missing callbacks, broken props, duplicate renderer issues, and wrong screen names.

4. Screen Renderer Audit

Review the app-level screen renderer.

Make sure every TenantScreen value has a matching renderer.

Check for screen values such as:

* dashboard
* sales
* sales-new
* sales-detail
* sales-preview
* quotations
* quotations-new
* quotation-detail
* quotation-preview
* quotation-convert
* purchases
* purchases-new
* purchase-detail
* purchase-preview
* inventory
* inventory-detail
* inventory-movements
* inventory-low-stock
* inventory-valuation
* products
* products-new
* product-detail
* product-categories
* products-bulk-setup
* products-byproducts
* customers
* customers-new
* customer-profile
* customer-statement
* suppliers
* suppliers-new
* supplier-profile
* supplier-statement
* payments
* payments-movements
* payments-report
* expenses
* expenses-report
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
* tax
* tax-sales
* tax-purchases
* tax-net
* tax-warnings
* settings
* settings-users
* settings-roles
* settings-numbering
* settings-vat
* settings-print-templates
* settings-audit

If some screens are intentionally not implemented, show a polished “قريباً” placeholder instead of a broken fallback.

5. Component Naming Conflict Audit

Search for duplicate exported component names across modules.

Known risk examples:

* ProductDetailScreen exists in both InventoryModule and ProductModule.
* SupplierPayModal exists in both PurchaseModule and SupplierModule.
* SettingsPanel names may conflict across modules.
* Report screens may conflict with module-specific reports.

Fix by aliasing imports clearly.

Examples:

* ProductModule ProductDetailScreen → ProductMasterDetailScreen if needed.
* InventoryModule ProductDetailScreen → InventoryProductDetailScreen if needed.
* PurchaseModule SupplierPayModal → PurchaseSupplierPayModal if needed.
* SupplierModule SupplierPayModal → SupplierAccountPayModal if needed.

Keep naming clear and production-friendly.

6. Arabic RTL Consistency Audit

Check every screen for Arabic-first RTL consistency.

Requirements:

* Arabic should be the primary visible language.
* English switch should still work.
* RTL alignment must be correct.
* Arabic labels should not mix awkwardly with English labels unless intentionally bilingual.
* Buttons should use consistent wording.

Standard Arabic action labels:

* إضافة
* تعديل
* عرض
* حفظ
* إلغاء
* اعتماد
* طباعة
* تصدير PDF
* تصدير Excel
* تسجيل تحصيل
* تسجيل دفعة
* عرض التفاصيل
* رجوع

Standard status labels:

* مسودة
* معتمدة
* مدفوعة
* مدفوعة جزئياً
* ملغاة
* نشط
* موقوف
* متوفر
* منخفض
* نفد
* قريباً
* ميزة متقدمة

Fix inconsistent labels.

7. Mobile Responsiveness Audit

Review all major modules on mobile.

Modules to check:

* Super Admin dashboard
* Tenant dashboard
* Sales invoice workflow
* Purchase invoice workflow
* Inventory
* Products
* Customers
* Suppliers
* Payments
* Expenses
* Reports
* Tax
* Settings

Mobile requirements:

* Tables must become cards.
* Main actions must remain visible.
* Sticky bottom action bars should not overlap content.
* Forms should be one-column.
* Modals should become full-screen sheets where needed.
* Sidebar should collapse.
* Bottom navigation should work.
* Large tap targets.
* Arabic RTL spacing should be correct.
* No horizontal overflow except intentional scrollable chips/tables.

Fix obvious mobile layout problems.

8. Role Permission Audit

Check Owner/Admin, Accountant, and Cashier/Sales views.

Roles:

* Owner/Admin
* Accountant
* Cashier/Sales

Owner/Admin:

* Can access everything.
* Can manage users.
* Can edit settings.
* Can view profit.
* Can view FIFO valuation.
* Can view tax.
* Can override credit limits.
* Can approve/cancel invoices.
* Can adjust stock.

Accountant:

* Can access financial modules.
* Can record collections/payments.
* Can view reports and tax.
* Can view profit if permission enabled.
* Cannot manage users unless permission enabled.
* Cannot change sensitive settings unless permission enabled.

Cashier/Sales:

* Can create sales or quotations if permission enabled.
* Can record collections if permission enabled.
* Can view limited inventory if permission enabled.
* Cannot view profit by default.
* Cannot view tax by default.
* Cannot access suppliers/purchases by default unless permission enabled.
* Cannot edit prices unless permission enabled.
* Cannot cancel invoices by default.

For every restricted action:

* Show disabled button.
* Show tooltip:
  “ليس لديك صلاحية لتنفيذ هذا الإجراء”
* Do not simply hide all important actions; disabled state is useful for understanding.

9. Sensitive Action Reason Audit

Ensure sensitive actions show a reason modal or reason field.

Sensitive actions:

* Edit sales price
* Edit purchase price
* Override KG
* Change carton/pieces quantity after draft
* Approve invoice
* Cancel sales invoice
* Cancel purchase invoice
* Apply collection discount
* Increase customer credit limit
* Edit opening balance
* Manual stock adjustment
* Apply stocktaking differences
* Change VAT rate
* Disable VAT
* Edit invoice numbering
* Edit print template
* Change user permissions
* Suspend/reactivate user
* Export sensitive financial reports
* Cancel receipt
* Cancel expense

Every sensitive action must visually show:

* Previous value
* New value
* Reason required
* User
* Timestamp placeholder
* Audit log entry preview where appropriate

10. Premium Feature Lock Audit

Premium features:

* WhatsApp invoice sending
* WhatsApp quotation sending
* WhatsApp statement sending
* WhatsApp payment reminder
* WhatsApp receipt sending
* Advanced reports if marked premium
* Multi-branch placeholder
* API access placeholder

If tenant plan does not allow premium:

* Show locked badge:
  “ميزة متقدمة”
* Tooltip:
  “هذه الميزة متاحة في باقة Pro أو Enterprise”
* Show upgrade placeholder button.
* Allow copy message manually when useful.

Make premium lock behavior consistent across:

* Customers
* Suppliers
* Quotations
* Sales invoices
* Payments
* Reports
* Settings

11. Document Template Consistency Audit

Check all printable document screens.

Documents:

* Sales Tax Invoice
* Quotation
* Purchase Internal Record
* Customer Receipt
* Supplier Payment Receipt
* Expense Voucher
* Customer Statement
* Supplier Statement
* Daily Report
* VAT Report

Each printable document should have:

* Company logo
* Company Arabic/English name
* TRN if relevant
* Phone/address
* Document number
* Date
* Clear bilingual title where needed
* Main table
* Totals box
* Prepared by
* Approved by where needed
* Signature/stamp area
* Print button
* PDF export button

Sales invoice should clearly say:
TAX INVOICE / فاتورة ضريبية

Quotation should clearly say:
QUOTATION / عرض سعر
and:
“عرض سعر وليس فاتورة ضريبية”

Purchase record should clearly say:
سجل شراء داخلي / INTERNAL PURCHASE RECORD

Fix inconsistent template headers or missing stamp/signature placeholders.

12. Numbering Consistency Audit

Review all document numbering references.

Document prefixes:

* Sales invoice: INV
* Purchase invoice: PUR
* Quotation: QUO
* Customer receipt: REC
* Supplier payment receipt: PAY
* Expense voucher: EXP
* Collection adjustment: ADJ
* Customer refund: REF-C
* Supplier refund: REF-S
* Stock adjustment: STK
* Statement: STM

Make sure examples are consistent:

* INV-2026-00046
* PUR-2026-00035
* QUO-2026-00012
* REC-2026-00019
* PAY-2026-00008
* EXP-2026-00023

13. Empty State Audit

Every major list should have a clean empty state.

Required empty states:

* No companies
* No customers
* No suppliers
* No products
* No sales invoices
* No purchase invoices
* No quotations
* No inventory
* No expenses
* No payments
* No reports data
* No tax warnings
* No audit logs
* No users
* No special prices
* No free products
* No attachments

Each empty state should include:

* Friendly Arabic text
* Short explanation
* Primary action button
* Optional icon

14. Error and Warning State Audit

Ensure consistent warning behavior.

Common warnings:

* Stock insufficient
* Credit limit exceeded
* VAT/TRN missing
* Stamp/signature missing
* Price below cost
* Payment amount invalid
* Discount exceeds amount
* User limit reached
* Premium feature locked
* Permission denied
* Duplicate invoice number
* Duplicate supplier invoice number
* Product missing price
* Product missing carton rules
* Negative stock not allowed
* Cancel action requires reason

Use colors consistently:

* Red for blocking errors.
* Amber for warnings.
* Green for success.
* Gray/navy for information.

15. Data Consistency Audit

Make sample data consistent across modules.

Company:
Prime Fresh Meat LLC

Customers:

* مطعم الخليج
* سوبر ماركت المدينة
* مطبخ الإمارات
* Prime Fresh Meat LLC

Suppliers:

* WESTLAND FOODSTUFF TRADING LLC
* MNM Foodstuff Trading LLC
* مزرعة العين للدواجن
* نقل الإمارات

Products:

* 900 GRAM
* 1000 GRAM
* 1100 GRAM
* 1200 GRAM
* 1300 GRAM
* Liver
* Gizzard
* Heart
* Wings
* Bone

Common totals:

* Today sales: AED 18,450
* Today purchases: AED 11,200
* Today expenses: AED 850
* Today net profit: AED 6,400
* Monthly sales: AED 425,000
* Monthly purchases: AED 298,000
* Monthly expenses: AED 39,050
* Net VAT estimate: AED 6,350

Avoid contradictory numbers across dashboard, reports, tax, and profit screens where obvious.

16. UX Simplification Audit

Make the product easy for non-technical poultry owners.

Apply these improvements:

* Prefer simple Arabic words.
* Use icons beside major actions.
* Use large financial numbers.
* Use clear formulas in helper cards.
* Avoid unnecessary technical words.
* Avoid crowded tables on mobile.
* Use guided forms for complex workflows.
* Add “what happens next” messages after approval/save.
* Ensure dangerous actions use confirmation modals.

17. Accessibility and Visual Polish

Check:

* Text contrast.
* Button sizes.
* Badge readability.
* Form spacing.
* Modal spacing.
* RTL icon direction.
* Chart labels.
* Table row readability.
* Disabled state clarity.
* Loading skeletons.
* Success toasts.
* Error toasts.

18. Final Missing Screens Report

At the end of the implementation, create a visible developer-facing internal QA summary screen or console-style component called:

UI QA Summary

Show:

* Total modules checked
* Missing screens found
* Broken links fixed
* Duplicate component names fixed
* Permission issues fixed
* Mobile issues fixed
* Remaining placeholders
* Recommended next development step

This screen can be accessible only from a temporary developer button or kept as an internal component.

19. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use mock data only.
Focus on QA, consistency, navigation, missing screens, permissions, mobile layout, naming conflicts, document templates, and polish.

Final expected result:
A polished, connected, Arabic-first Poultry Hero SaaS ERP UI ready for frontend extraction and later Cursor development.
