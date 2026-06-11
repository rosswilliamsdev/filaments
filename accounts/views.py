from django.conf import settings
from django.contrib.auth.models import User
from google.oauth2 import id_token
from google.auth.transport import requests as g_requests
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

class GoogleAuthView(APIView):
    permission_classes = [AllowAny]          # the one public route

    def post(self, request):
        token = request.data.get("id_token")
        try:
            claims = id_token.verify_oauth2_token(
                token, g_requests.Request(), settings.GOOGLE_WEB_CLIENT_ID
            )
        except ValueError:
            return Response({"error": "invalid google token"}, status=status.HTTP_401_UNAUTHORIZED)
        if not claims.get("email_verified"):
            return Response({"error": "invalid google token"}, status=status.HTTP_401_UNAUTHORIZED)
        email = claims["email"]
        if email not in settings.ALLOWED_GOOGLE_EMAILS:     # check BEFORE get_or_create
            return Response({"error": "email not permitted"}, status=status.HTTP_403_FORBIDDEN)
        user, _ = User.objects.get_or_create(username=email, defaults={"email": email})
        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {"id": user.id, "email": user.email},
        })
