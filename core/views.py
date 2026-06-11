from django.contrib.postgres.search import SearchQuery, SearchRank
from django.core.exceptions import ImproperlyConfigured
from django.db.models import Count, F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.pagination import CursorPagination, LimitOffsetPagination
from rest_framework.response import Response

from .models import ActionItem, Filament, Tag
from .s3 import build_source_key, generate_upload_url
from .serializers import (
    ActionItemSerializer,
    FilamentCardSerializer,
    FilamentCreateSerializer,
    FilamentDetailSerializer,
    TagSerializer,
)
from .tasks import process_filament


class TimelineCursorPagination(CursorPagination):
    """Stable under inserts: new captures appear at the top without shifting pages."""

    ordering = "-created_at"
    page_size = 30


class SearchPagination(LimitOffsetPagination):
    """Relevance-ranked results have no stable cursor key; offset is fine here."""

    default_limit = 30


class FilamentViewSet(viewsets.ModelViewSet):
    pagination_class = TimelineCursorPagination
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = Filament.objects.filter(deleted_at__isnull=True).prefetch_related(
            "tags", "action_items"
        )
        if self.action == "list":
            params = self.request.query_params
            qs = qs.filter(archived=params.get("archived") in ("true", "1"))
            if filament_type := params.get("type"):
                qs = qs.filter(type=filament_type)
            if tag := params.get("tag"):
                qs = qs.filter(tags__name=tag)
            if params.get("pinned") in ("true", "1"):
                qs = qs.filter(pinned=True)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return FilamentCardSerializer
        if self.action == "create":
            return FilamentCreateSerializer
        return FilamentDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        filament = serializer.save()

        upload_url = None
        if filament.type != Filament.Type.TEXT:
            filament.source_key = build_source_key(filament)
            try:
                upload_url = generate_upload_url(filament.source_key)
            except ImproperlyConfigured as exc:
                filament.delete()  # don't strand a row the client can never upload to
                return Response(
                    {"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            filament.save(update_fields=["source_key"])

        return Response(
            {"filament_id": str(filament.id), "upload_url": upload_url},
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        # Soft delete: tombstone only. The sweep hard-deletes (and cascades +
        # cleans S3) after the grace window — see backend doc → Business Logic.
        filament = self.get_object()
        filament.deleted_at = timezone.now()
        filament.save(update_fields=["deleted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        """
        Confirm upload complete; enqueue the pipeline. Idempotent via
        conditional update: a duplicate call (retry, double-tap, offline
        replay) affects 0 rows and is a no-op success — no second chain.
        """
        updated = Filament.objects.filter(
            pk=pk, deleted_at__isnull=True, status=Filament.Status.PENDING_UPLOAD
        ).update(
            status=Filament.Status.PROCESSING,
            pipeline_attempts=F("pipeline_attempts") + 1,
        )
        if updated:
            process_filament.delay(str(pk))
        filament = get_object_or_404(Filament, pk=pk, deleted_at__isnull=True)
        return Response(
            {"id": str(filament.id), "status": filament.status, "enqueued": bool(updated)},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["patch"], url_path=r"action-items/(?P<item_id>\d+)")
    def action_item(self, request, pk=None, item_id=None):
        item = get_object_or_404(
            ActionItem, pk=item_id, filament_id=pk, filament__deleted_at__isnull=True
        )
        serializer = ActionItemSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TagListView(ListAPIView):
    serializer_class = TagSerializer
    pagination_class = None
    queryset = (
        Tag.objects.annotate(
            count=Count("filaments", filter=Q(filaments__deleted_at__isnull=True))
        )
        .filter(count__gt=0)
        .order_by("name")
    )


class SearchView(ListAPIView):
    """Read-only FTS over the search_vector generated column."""

    serializer_class = FilamentCardSerializer
    pagination_class = SearchPagination

    def get_queryset(self):
        params = self.request.query_params
        q = params.get("q", "").strip()
        if not q:
            return Filament.objects.none()

        query = SearchQuery(q, config="english")
        qs = (
            Filament.objects.filter(deleted_at__isnull=True, search_vector=query)
            .annotate(rank=SearchRank(F("search_vector"), query))
            .prefetch_related("tags")
            .order_by("-rank", "-created_at")
        )
        if filament_type := params.get("type"):
            qs = qs.filter(type=filament_type)
        if tag := params.get("tag"):
            qs = qs.filter(tags__name=tag)
        if date_from := params.get("from"):
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to := params.get("to"):
            qs = qs.filter(created_at__date__lte=date_to)
        return qs
