import uuid

from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVector, SearchVectorField
from django.db import models
from pgvector.django import VectorField


class Filament(models.Model):
    """
    Single polymorphic model for all input types. Voice, document, and text
    share the same pipeline, summary, tags, links, and search behavior — only
    the source differs (see backend-planning-doc.md → Data Model).
    """

    class Type(models.TextChoices):
        VOICE = "voice", "Voice"
        DOCUMENT = "document", "Document"
        TEXT = "text", "Text"

    class Status(models.TextChoices):
        PENDING_UPLOAD = "pending_upload", "Pending upload"
        PROCESSING = "processing", "Processing"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=10, choices=Type.choices)
    title = models.TextField(blank=True)
    # Canonical searchable text for every type: transcript text OR extracted
    # document text OR the note itself. Search and embedding both read this.
    body = models.TextField(blank=True)
    summary = models.TextField(blank=True)
    key_ideas = models.JSONField(default=list, blank=True)
    # Voice only: [{start, end, speaker, text}]. `speaker` stays null in v1.
    transcript = models.JSONField(null=True, blank=True)
    source_key = models.TextField(null=True, blank=True)  # S3 key; null for text notes
    embedding = VectorField(dimensions=1536, null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING_UPLOAD
    )
    pipeline_attempts = models.IntegerField(default=0)
    # Postgres STORED generated column — DB-computed on every write, cannot desync.
    search_vector = models.GeneratedField(
        expression=SearchVector("title", "body", "summary", config="english"),
        output_field=SearchVectorField(),
        db_persist=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    pinned = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    # Soft-delete tombstone; null = live. Hard-deleted by sweep after grace window.
    deleted_at = models.DateTimeField(null=True, blank=True)

    tags = models.ManyToManyField("Tag", through="FilamentTag", related_name="filaments")

    class Meta:
        ordering = ["-created_at"]
        indexes = [GinIndex(fields=["search_vector"], name="filament_search_gin")]

    def __str__(self):
        return f"{self.type}: {self.title or self.id}"


class ActionItem(models.Model):
    """Extracted to-dos. Own table (not JSONB) — they carry `done` state."""

    filament = models.ForeignKey(
        Filament, on_delete=models.CASCADE, related_name="action_items"
    )
    text = models.TextField()
    done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.text[:50]


class Tag(models.Model):
    """Shared, editable vocabulary. Never cascaded when filaments are deleted."""

    name = models.CharField(max_length=64, unique=True)

    def __str__(self):
        return self.name


class FilamentTag(models.Model):
    filament = models.ForeignKey(Filament, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["filament", "tag"], name="uniq_filament_tag")
        ]


class FilamentLink(models.Model):
    """
    One row per linked pair, undirected at the query layer:
    Q(source=f) | Q(target=f).

    Pairs are stored in canonical order (lower UUID as source), enforced by
    link_pair_canonical_order, so a reversed duplicate is impossible at the
    schema level. Create links only through create_link(), never
    objects.create(). See tradeoffs-discussed.md → Implementation Phase.
    """

    source = models.ForeignKey(
        Filament, on_delete=models.CASCADE, related_name="links_as_source"
    )
    target = models.ForeignKey(
        Filament, on_delete=models.CASCADE, related_name="links_as_target"
    )
    score = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["source", "target"], name="uniq_link_pair"),
            models.CheckConstraint(
                condition=models.Q(source_id__lt=models.F("target_id")),
                name="link_pair_canonical_order",
            ),
        ]

    @classmethod
    def create_link(cls, a: "Filament", b: "Filament", score: float) -> "FilamentLink":
        """Create or refresh the single undirected link between two filaments."""
        if a.pk == b.pk:
            raise ValueError("cannot link a filament to itself")
        source, target = (a, b) if a.pk < b.pk else (b, a)
        link, _ = cls.objects.update_or_create(
            source=source, target=target, defaults={"score": score}
        )
        return link

    def __str__(self):
        return f"{self.source_id} ↔ {self.target_id} ({self.score:.2f})"
