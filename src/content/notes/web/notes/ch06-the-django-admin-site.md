# Chapter 6: The Django admin site

*Week 6 · 2+1 hrs · Quiz 3*

Reading: [MDN: Admin site](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Admin_site)

Django gives you a working admin dashboard for free, just by registering your models. No extra code needed to browse, add, edit, or delete rows.

```bash terminal
python manage.py createsuperuser   # make an admin login
```

```python recruitment/admin.py
from django.contrib import admin
from .models import Applicant, Role, Mission

admin.site.register(Role)
admin.site.register(Mission)

@admin.register(Applicant)
class ApplicantAdmin(admin.ModelAdmin):
    list_display = ["full_name", "email", "role", "status"]
    search_fields = ["full_name", "email"]
    list_filter = ["status"]
```

Visit `/admin/`, log in, and you get a full table view of applicants: sortable, searchable, filterable. This is where staff will review real applications, without ever touching the database directly.

| Option | Does |
| --- | --- |
| `list_display` | Which columns show in the list view |
| `search_fields` | Adds a search box over these fields |
| `list_filter` | Adds a sidebar filter |
