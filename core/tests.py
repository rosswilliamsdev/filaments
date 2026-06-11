from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import ActionItem, Filament, FilamentLink, Tag


class AuthedAPITestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="test@example.com", email="test@example.com"
        )

    def setUp(self):
        self.client.force_authenticate(self.user)


class AuthBoundaryTests(APITestCase):
    def test_unauthenticated_requests_are_rejected(self):
        for url in ("/api/v1/filaments", "/api/v1/search?q=x", "/api/v1/tags"):
            self.assertEqual(self.client.get(url).status_code, 401, url)


class FilamentAPITests(AuthedAPITestCase):
    def test_text_note_create_and_process_handshake(self):
        res = self.client.post(
            "/api/v1/filaments",
            {"type": "text", "title": "Note", "body": "Hello world"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertIsNone(res.data["upload_url"])
        fid = res.data["filament_id"]

        with patch("core.views.process_filament") as task:
            res = self.client.post(f"/api/v1/filaments/{fid}/process")
            self.assertEqual(res.status_code, 202)
            self.assertTrue(res.data["enqueued"])
            self.assertEqual(res.data["status"], "processing")
            task.delay.assert_called_once_with(fid)

            # Duplicate call (retry/double-tap): no-op success, no second chain
            res = self.client.post(f"/api/v1/filaments/{fid}/process")
            self.assertEqual(res.status_code, 202)
            self.assertFalse(res.data["enqueued"])
            task.delay.assert_called_once()

        self.assertEqual(Filament.objects.get(pk=fid).pipeline_attempts, 1)

    def test_text_note_requires_body(self):
        res = self.client.post("/api/v1/filaments", {"type": "text"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_file_create_without_s3_fails_loudly_and_leaves_no_row(self):
        res = self.client.post("/api/v1/filaments", {"type": "voice"}, format="json")
        self.assertEqual(res.status_code, 503)
        self.assertEqual(Filament.objects.count(), 0)

    def test_list_excludes_archived_and_deleted_by_default(self):
        Filament.objects.create(type="text", title="live", body="x")
        Filament.objects.create(type="text", title="archived", body="x", archived=True)
        Filament.objects.create(
            type="text", title="deleted", body="x", deleted_at=timezone.now()
        )

        res = self.client.get("/api/v1/filaments")
        self.assertEqual([r["title"] for r in res.data["results"]], ["live"])

        res = self.client.get("/api/v1/filaments?archived=true")
        self.assertEqual([r["title"] for r in res.data["results"]], ["archived"])

    def test_patch_title_and_tags(self):
        f = Filament.objects.create(type="text", title="old", body="b")
        res = self.client.patch(
            f"/api/v1/filaments/{f.id}",
            {"title": "new", "tags": ["focus", "deep-work", "focus"]},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["title"], "new")
        self.assertEqual(sorted(res.data["tags"]), ["deep-work", "focus"])
        self.assertEqual(Tag.objects.count(), 2)

    def test_pipeline_fields_are_read_only(self):
        f = Filament.objects.create(type="text", title="t", body="b")
        res = self.client.patch(
            f"/api/v1/filaments/{f.id}", {"status": "done"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        f.refresh_from_db()
        self.assertEqual(f.status, Filament.Status.PENDING_UPLOAD)

    def test_soft_delete_tombstones_and_hides(self):
        f = Filament.objects.create(type="text", title="t", body="b")
        res = self.client.delete(f"/api/v1/filaments/{f.id}")
        self.assertEqual(res.status_code, 204)
        f.refresh_from_db()
        self.assertIsNotNone(f.deleted_at)  # row survives for the sweep
        self.assertEqual(self.client.get(f"/api/v1/filaments/{f.id}").status_code, 404)

    def test_action_item_toggle(self):
        f = Filament.objects.create(type="text", title="t", body="b")
        item = ActionItem.objects.create(filament=f, text="do the thing")
        res = self.client.patch(
            f"/api/v1/filaments/{f.id}/action-items/{item.id}",
            {"done": True},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        item.refresh_from_db()
        self.assertTrue(item.done)


class SearchTests(AuthedAPITestCase):
    def test_fts_matches_and_filters(self):
        Filament.objects.create(
            type="text", title="Deep work", body="attention and focus"
        )
        Filament.objects.create(type="voice", title="Groceries", body="milk eggs")

        res = self.client.get("/api/v1/search?q=attention")
        self.assertEqual([r["title"] for r in res.data["results"]], ["Deep work"])

        res = self.client.get("/api/v1/search?q=attention&type=voice")
        self.assertEqual(res.data["results"], [])

        res = self.client.get("/api/v1/search")  # no q → empty, not an error
        self.assertEqual(res.data["results"], [])

    def test_search_excludes_soft_deleted(self):
        Filament.objects.create(
            type="text", title="gone", body="attention", deleted_at=timezone.now()
        )
        res = self.client.get("/api/v1/search?q=attention")
        self.assertEqual(res.data["results"], [])


class TagListTests(AuthedAPITestCase):
    def test_counts_live_filaments_only(self):
        tag = Tag.objects.create(name="focus")
        live = Filament.objects.create(type="text", title="x", body="y")
        dead = Filament.objects.create(
            type="text", title="z", body="y", deleted_at=timezone.now()
        )
        live.tags.add(tag)
        dead.tags.add(tag)

        res = self.client.get("/api/v1/tags")
        self.assertEqual(res.data, [{"id": tag.id, "name": "focus", "count": 1}])


class FilamentLinkTests(AuthedAPITestCase):
    def test_create_link_canonicalizes_and_refreshes_score(self):
        a = Filament.objects.create(type="text", title="a", body="x")
        b = Filament.objects.create(type="text", title="b", body="y")

        first = FilamentLink.create_link(a, b, 0.9)
        second = FilamentLink.create_link(b, a, 0.5)  # reversed re-process

        self.assertEqual(first.pk, second.pk)
        link = FilamentLink.objects.get()
        self.assertEqual(link.score, 0.5)
        self.assertLess(link.source_id, link.target_id)

    def test_reversed_direct_insert_rejected_by_db(self):
        a = Filament.objects.create(type="text", title="a", body="x")
        b = Filament.objects.create(type="text", title="b", body="y")
        lo, hi = sorted([a, b], key=lambda f: f.pk)
        with self.assertRaises(IntegrityError):
            FilamentLink.objects.create(source=hi, target=lo, score=0.5)

    def test_self_link_rejected(self):
        a = Filament.objects.create(type="text", title="a", body="x")
        with self.assertRaises(ValueError):
            FilamentLink.create_link(a, a, 1.0)

    def test_links_render_undirected_in_detail(self):
        a = Filament.objects.create(type="text", title="a", body="x")
        b = Filament.objects.create(type="text", title="b", body="y")
        FilamentLink.create_link(a, b, 0.9)

        for filament, other in ((a, b), (b, a)):
            res = self.client.get(f"/api/v1/filaments/{filament.id}")
            self.assertEqual(
                [link["filament_id"] for link in res.data["links"]], [str(other.id)]
            )
