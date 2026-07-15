from django.urls import path

from .views import HostAwareTokenRefreshView, LoginView, LogoutView, MeView

# Mounted under /api/v1/auth/
urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", HostAwareTokenRefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
]
