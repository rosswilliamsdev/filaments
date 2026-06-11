"""
Seed realistic demo filaments so the mobile prototype has data to render.
Dev-only convenience: wipes ALL existing filaments first (refuses unless DEBUG).
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from core.models import ActionItem, Filament, FilamentLink, Tag

SPECS = [
    {
        "key": "deep-work",
        "type": "document",
        "title": "Deep Work — chapter highlights",
        "body": (
            "The ability to perform deep work is becoming increasingly rare at exactly "
            "the same time it is becoming increasingly valuable in our economy. The few "
            "who cultivate this skill, and then make it the core of their working life, "
            "will thrive. High-quality work produced is a function of time spent and "
            "intensity of focus. Attention residue from task switching degrades "
            "performance long after the switch."
        ),
        "summary": (
            "Newport argues deep, distraction-free focus is the defining economic skill "
            "of the decade, and that attention residue from constant switching quietly "
            "taxes every block of work that follows."
        ),
        "key_ideas": [
            "Deep work is rare and valuable at the same time",
            "Output = time × intensity of focus",
            "Attention residue lingers after every context switch",
        ],
        "tags": ["focus", "deep-work", "reading"],
        "action_items": [("Block two deep-work hours before 10am", False)],
        "status": "done",
        "days_ago": 1,
    },
    {
        "key": "digital-minimalism",
        "type": "text",
        "title": "Digital minimalism notes",
        "body": (
            "Cheap digital novelty fragments attention. The intersection of digital "
            "minimalism and cognitive endurance keeps coming up: the fewer low-value "
            "inputs I allow, the longer I can hold a single thread of thought. Worth "
            "treating attention like a budget with hard line items."
        ),
        "summary": (
            "Recurring theme: digital minimalism as training for cognitive endurance — "
            "treat attention like a budget with hard line items."
        ),
        "key_ideas": [
            "Low-value inputs shorten the longest thread of thought you can hold",
            "Attention budgeting beats willpower",
        ],
        "tags": ["attention", "focus"],
        "action_items": [],
        "status": "done",
        "days_ago": 1,
    },
    {
        "key": "morning-reading-queue",
        "type": "voice",
        "title": "Morning thoughts on the reading queue",
        "body": (
            "I keep adding books to the queue faster than I finish them. Maybe the rule "
            "should be one in, one out. Also thinking the queue should live somewhere I "
            "see daily, not buried in an app. The analog notebook idea keeps resurfacing."
        ),
        "summary": (
            "Reading queue is growing faster than it shrinks; proposes a one-in-one-out "
            "rule and a visible, possibly analog, home for the queue."
        ),
        "key_ideas": [
            "One in, one out for the reading queue",
            "Queues need daily visibility to function",
        ],
        "transcript": [
            {"start": 0.0, "end": 7.4, "speaker": None, "text": "I keep adding books to the queue faster than I finish them. Maybe the rule should be one in, one out."},
            {"start": 7.4, "end": 14.8, "speaker": None, "text": "Also thinking the queue should live somewhere I see daily, not buried in an app."},
            {"start": 14.8, "end": 19.2, "speaker": None, "text": "The analog notebook idea keeps resurfacing."},
        ],
        "tags": ["reading", "habits"],
        "action_items": [
            ("Adopt one-in-one-out for the reading queue", False),
            ("Move the queue to the desk notebook", True),
        ],
        "status": "done",
        "days_ago": 0,
    },
    {
        "key": "revenge-of-analog",
        "type": "document",
        "title": "The Revenge of Analog — excerpts",
        "body": (
            "Tactile information systems survive because they impose useful constraints. "
            "Paper forces sequence, edges, and endings; digital tools dissolve all three. "
            "The notebook's value is precisely that it cannot do everything."
        ),
        "summary": (
            "Analog tools persist because their constraints — sequence, edges, endings — "
            "are features, not limitations."
        ),
        "key_ideas": [
            "Constraints are the feature: paper forces endings",
            "Tools that can do everything decide nothing",
        ],
        "tags": ["analog", "tools", "reading"],
        "action_items": [],
        "status": "done",
        "days_ago": 5,
    },
    {
        "key": "weekly-review",
        "type": "voice",
        "title": "Weekly review — what actually moved",
        "body": (
            "The deep work blocks held four days out of five. Search project moved the "
            "most on the days I started before checking anything. Next week: protect the "
            "first ninety minutes, and write the day's single question the night before."
        ),
        "summary": (
            "Deep-work blocks held 4/5 days; progress correlates with starting before "
            "any inputs. Next week: protect the first 90 minutes."
        ),
        "key_ideas": [
            "Starting before inputs predicts the best days",
            "Write tomorrow's single question tonight",
        ],
        "transcript": [
            {"start": 0.0, "end": 8.1, "speaker": None, "text": "The deep work blocks held four days out of five. The search project moved the most on the days I started before checking anything."},
            {"start": 8.1, "end": 15.6, "speaker": None, "text": "Next week: protect the first ninety minutes, and write the day's single question the night before."},
        ],
        "tags": ["habits", "review"],
        "action_items": [
            ("Write tomorrow's question each evening", False),
            ("Protect the first 90 minutes", True),
        ],
        "status": "done",
        "days_ago": 6,
    },
    {
        "key": "annie-dillard",
        "type": "text",
        "title": "Annie Dillard on schedules",
        "body": (
            "“How we spend our days is, of course, how we spend our lives. What we do "
            "with this hour, and that one, is what we are doing.” A schedule defends "
            "from chaos and whim. It is a net for catching days."
        ),
        "summary": "Dillard: a schedule is a net for catching days — how we spend our days is how we spend our lives.",
        "key_ideas": ["A schedule is a net for catching days"],
        "tags": ["writing", "quotes"],
        "action_items": [],
        "status": "done",
        "days_ago": 12,
    },
    {
        "key": "graph-view-idea",
        "type": "voice",
        "title": "Idea: graph view for filament links",
        "body": "",
        "summary": "",
        "key_ideas": [],
        "tags": [],
        "action_items": [],
        "status": "processing",
        "days_ago": 0,
    },
    {
        "key": "paywalled-article",
        "type": "document",
        "title": "Article: The case for slower note-taking",
        "body": "",
        "summary": "",
        "key_ideas": [],
        "tags": [],
        "action_items": [],
        "status": "failed",
        "days_ago": 2,
    },
]

# (a, b, score) — created through create_link, so order doesn't matter.
LINKS = [
    ("deep-work", "digital-minimalism", 0.92),
    ("deep-work", "revenge-of-analog", 0.81),
    ("digital-minimalism", "revenge-of-analog", 0.74),
    ("morning-reading-queue", "revenge-of-analog", 0.69),
    ("weekly-review", "deep-work", 0.66),
]


class Command(BaseCommand):
    help = "Replace all filaments with realistic demo data (DEBUG only)."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo wipes all filaments; refusing outside DEBUG.")

        Filament.objects.all().delete()
        now = timezone.now()
        created = {}

        for spec in SPECS:
            filament = Filament.objects.create(
                type=spec["type"],
                title=spec["title"],
                body=spec["body"],
                summary=spec["summary"],
                key_ideas=spec["key_ideas"],
                transcript=spec.get("transcript"),
                status=spec["status"],
            )
            # auto_now_add ignores passed values; backdate via queryset update
            stamp = now - timedelta(days=spec["days_ago"], minutes=spec["days_ago"] * 37)
            Filament.objects.filter(pk=filament.pk).update(
                created_at=stamp, updated_at=stamp
            )
            for name in spec["tags"]:
                tag, _ = Tag.objects.get_or_create(name=name)
                filament.tags.add(tag)
            for text, done in spec["action_items"]:
                ActionItem.objects.create(filament=filament, text=text, done=done)
            created[spec["key"]] = filament

        for a, b, score in LINKS:
            FilamentLink.create_link(created[a], created[b], score)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {Filament.objects.count()} filaments, "
                f"{Tag.objects.count()} tags, {FilamentLink.objects.count()} links."
            )
        )
