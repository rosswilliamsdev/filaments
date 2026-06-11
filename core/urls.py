from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import FilamentViewSet, SearchView, TagListView

# trailing_slash=False matches the contract in backend-planning-doc.md
# (/filaments/{id}/process) and the existing auth routes.
router = SimpleRouter(trailing_slash=False)
router.register("filaments", FilamentViewSet, basename="filament")

urlpatterns = [
    path("tags", TagListView.as_view()),
    path("search", SearchView.as_view()),
    *router.urls,
]
