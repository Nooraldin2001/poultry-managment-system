from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ExpenseCategoryViewSet,
    ExpenseProfitImpactView,
    ExpenseSummaryView,
    ExpenseViewSet,
    RecurringExpenseViewSet,
)

router = DefaultRouter()
router.register("expense-categories", ExpenseCategoryViewSet, basename="expense-categories")
router.register("expenses", ExpenseViewSet, basename="expenses")
router.register("recurring-expenses", RecurringExpenseViewSet, basename="recurring-expenses")

urlpatterns = [
    path("expenses/summary/", ExpenseSummaryView.as_view(), name="expenses-summary"),
    path("expenses/profit-impact/", ExpenseProfitImpactView.as_view(), name="expenses-profit-impact"),
]
urlpatterns += router.urls
