import os

import boto3
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

# Upload handshake: POST /filaments returns a pre-signed PUT URL scoped to one
# key; the client uploads directly to S3 and bytes never pass through Django.

# Voice is always m4a from the recorder. Documents carry their own extension so
# the extraction step can dispatch on it (see tasks._extract_document) and a
# later download serves the right Content-Type.
VOICE_EXTENSION = ".m4a"

# Document formats the pipeline can extract text from → the Content-Type S3
# stores them under. Legacy binary `.doc` is intentionally absent: python-docx
# reads only the modern Open-XML `.docx` container. This dict is the single
# source of truth — the create endpoint validates against it and the web
# picker's allowlist mirrors it.
ACCEPTED_DOCUMENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".txt": "text/plain",
}


def document_extension(filename: str) -> str:
    """Lowercased extension of an accepted document, or raise ValueError."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ACCEPTED_DOCUMENT_TYPES:
        accepted = ", ".join(sorted(ACCEPTED_DOCUMENT_TYPES))
        raise ValueError(
            f"unsupported document type '{ext or filename}' (accepted: {accepted})"
        )
    return ext


def build_source_key(filament, ext: str | None = None) -> str:
    # Documents pass their validated extension; voice defaults to m4a; text has
    # no source object and never reaches here.
    if ext is None:
        ext = VOICE_EXTENSION if filament.type == "voice" else ""
    return f"{filament.type}/{filament.id}{ext}"


def _client():
    if not settings.USE_S3:
        raise ImproperlyConfigured(
            "File uploads need S3 (set USE_S3=True and AWS credentials in .env)"
        )
    return boto3.client(
        "s3",
        region_name=settings.AWS_S3_REGION_NAME,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def generate_upload_url(key: str, expires: int = 3600) -> str:
    return _client().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key},
        ExpiresIn=expires,
    )


def download_object(key: str) -> bytes:
    """Fetch an uploaded source file (audio/PDF) for pipeline processing."""
    response = _client().get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
    return response["Body"].read()


def delete_object(key: str) -> None:
    """Hard-delete an S3 object. Used by periodic sweep commands."""
    _client().delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
