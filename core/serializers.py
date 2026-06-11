from django.db.models import Q
from rest_framework import serializers

from .models import ActionItem, Filament, FilamentLink, Tag

SNIPPET_LENGTH = 200


class TagSerializer(serializers.ModelSerializer):
    count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tag
        fields = ["id", "name", "count"]


class ActionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActionItem
        fields = ["id", "text", "done", "created_at"]
        read_only_fields = ["id", "created_at"]


class FilamentCardSerializer(serializers.ModelSerializer):
    """Timeline / search-result card (backend doc → /search response shape)."""

    snippet = serializers.SerializerMethodField()
    tags = serializers.SlugRelatedField(many=True, read_only=True, slug_field="name")

    class Meta:
        model = Filament
        fields = [
            "id", "type", "title", "snippet", "status",
            "pinned", "archived", "created_at", "tags",
        ]

    def get_snippet(self, obj) -> str:
        text = obj.summary or obj.body
        return text[:SNIPPET_LENGTH]


class FilamentDetailSerializer(serializers.ModelSerializer):
    """
    Full detail. Writable fields cover PATCH (edit tags/title/annotations);
    pipeline-owned fields (summary, transcript, status, …) are read-only.
    """

    tags = serializers.ListField(
        child=serializers.CharField(max_length=64), required=False, write_only=True
    )
    action_items = ActionItemSerializer(many=True, read_only=True)
    links = serializers.SerializerMethodField()

    class Meta:
        model = Filament
        fields = [
            "id", "type", "title", "body", "summary", "key_ideas", "transcript",
            "status", "pinned", "archived", "created_at", "updated_at",
            "tags", "action_items", "links",
        ]
        read_only_fields = [
            "id", "type", "summary", "key_ideas", "transcript", "status",
            "created_at", "updated_at",
        ]

    def get_links(self, obj):
        links = (
            FilamentLink.objects.filter(Q(source=obj) | Q(target=obj))
            .filter(source__deleted_at__isnull=True, target__deleted_at__isnull=True)
            .select_related("source", "target")
            .order_by("-score")
        )
        out = []
        for link in links:
            other = link.target if link.source_id == obj.id else link.source
            out.append({
                "filament_id": str(other.id),
                "title": other.title,
                "type": other.type,
                "score": link.score,
            })
        return out

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["tags"] = list(instance.tags.values_list("name", flat=True))
        return rep

    def update(self, instance, validated_data):
        tag_names = validated_data.pop("tags", None)
        instance = super().update(instance, validated_data)
        if tag_names is not None:
            names = [n.strip() for n in dict.fromkeys(tag_names) if n.strip()]
            instance.tags.set([Tag.objects.get_or_create(name=n)[0] for n in names])
        return instance


class FilamentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Filament
        fields = ["type", "title", "body"]

    def validate(self, attrs):
        if attrs["type"] == Filament.Type.TEXT and not attrs.get("body", "").strip():
            raise serializers.ValidationError({"body": "Text notes require a body."})
        return attrs
