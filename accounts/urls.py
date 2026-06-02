from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('auth/google/', views.google_auth, name='google-auth'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', views.me, name='user-me'),
]
