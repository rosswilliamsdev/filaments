import boto3
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

# Upload handshake: POST /filaments returns a pre-signed PUT URL scoped to one
# key; the client uploads directly to S3 and bytes never pass through Django.

EXTENSIONS = {"voice": ".m4a", "document": ".pdf"}


def build_source_key(filament) -> str:
    return f"{filament.type}/{filament.id}{EXTENSIONS.get(filament.type, '')}"


def generate_upload_url(key: str, expires: int = 3600) -> str:
    if not settings.USE_S3:
        raise ImproperlyConfigured(
            "File uploads need S3 (set USE_S3=True and AWS credentials in .env)"
        )
    client = boto3.client(
        "s3",
        region_name=settings.AWS_S3_REGION_NAME,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    return client.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key},
        ExpiresIn=expires,
    )
