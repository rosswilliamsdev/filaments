from django.contrib import admin

from .models import ActionItem, Filament, FilamentLink, Tag


class ActionItemInline(admin.TabularInline):
    model = ActionItem
    extra = 0


@admin.register(Filament)
class FilamentAdmin(admin.ModelAdmin):
    list_display = ("title", "type", "status", "pinned", "archived", "created_at")
    list_filter = ("type", "status", "pinned", "archived")
    search_fields = ("title", "body", "summary")
    readonly_fields = ("id", "created_at", "updated_at", "pipeline_attempts")
    exclude = ("embedding",)  # 1536 floats — useless to render in a form
    inlines = [ActionItemInline]


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(FilamentLink)
class FilamentLinkAdmin(admin.ModelAdmin):
    list_display = ("source", "target", "score", "created_at")
