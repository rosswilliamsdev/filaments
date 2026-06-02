from django.db import models
from django.contrib.auth import get_user_model
from pgvector.django import VectorField
import uuid

User = get_user_model()


class Filament(models.Model):
    """
    A single piece of content (URL, PDF, Note, or Transcript).
    """
    CONTENT_TYPE_CHOICES = [
        ('url', 'URL'),
        ('pdf', 'PDF'),
        ('note', 'Note'),
        ('transcript', 'Transcript'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='filaments')
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES)

    # Content fields
    title = models.CharField(max_length=500, blank=True)
    raw_text = models.TextField(blank=True)  # Extracted or provided text
    summary = models.TextField(blank=True)  # AI-generated summary
    tags = models.JSONField(default=list, blank=True)  # AI-generated tags

    # Type-specific fields
    url = models.URLField(max_length=2000, blank=True, null=True)  # For URL type
    file_path = models.CharField(max_length=500, blank=True, null=True)  # For PDF/Transcript

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processing_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('processing', 'Processing'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'content_type']),
        ]

    def __str__(self):
        return f"{self.content_type}: {self.title or self.id}"


class Chunk(models.Model):
    """
    A semantic chunk of a Filament with vector embedding.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    filament = models.ForeignKey(Filament, on_delete=models.CASCADE, related_name='chunks')
    text = models.TextField()
    embedding = VectorField(dimensions=1536, null=True, blank=True)  # OpenAI ada-002 dimension
    chunk_index = models.IntegerField()  # Order within the filament

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['filament', 'chunk_index']
        indexes = [
            models.Index(fields=['filament', 'chunk_index']),
        ]
        unique_together = [['filament', 'chunk_index']]

    def __str__(self):
        return f"Chunk {self.chunk_index} of {self.filament_id}"


class Search(models.Model):
    """
    A saved semantic search query.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='searches')
    query_text = models.TextField()
    query_embedding = VectorField(dimensions=1536, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'searches'

    def __str__(self):
        return f"Search: {self.query_text[:50]}..."
