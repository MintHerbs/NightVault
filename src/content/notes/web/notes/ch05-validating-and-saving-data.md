# Chapter 5: Validating and saving data (server side)

*Week 5 · 2+1 hrs · Quiz 2*

Client-side JS validation (Chapter 4) is for UX, it's not security. Anyone can open dev tools and bypass it. The server must validate again. Django does this with **forms**.

```python recruitment/forms.py
from django import forms
from .models import Applicant

class ApplicantForm(forms.ModelForm):
    class Meta:
        model  = Applicant
        fields = ["full_name", "email", "role", "mission"]

    # custom rule: reject names under 2 characters
    def clean_full_name(self):
        name = self.cleaned_data["full_name"]
        if len(name) < 2:
            raise forms.ValidationError("Name too short")
        return name
```

```python recruitment/views.py
def apply_view(request):
    if request.method == "POST":
        form = ApplicantForm(request.POST)
        if form.is_valid():
            form.save()                     # writes the row to the DB
            return redirect("success")
    else:
        form = ApplicantForm()
    return render(request, "apply.html", {"form": form})
```

`is_valid()` runs every field's checks (required, email format, your custom `clean_` methods). Only if everything passes does `.save()` run.

> **Defense in depth:** JS checks for a nice experience, Django checks because it must. Never trust the client.
