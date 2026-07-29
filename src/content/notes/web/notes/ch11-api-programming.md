# Chapter 11: API programming

*Week 11 · 2+1 hrs*

An **API** is a set of URLs a server exposes so other programs, our frontend, can read and write its data. We use **Django REST Framework** (DRF) to build ours.

## REST, in plain terms

REST just means: use URLs to name *things* (`/api/applicants/`), and use the HTTP method to say what you want to *do* to them.

| HTTP method | Means |
| --- | --- |
| GET | Read data |
| POST | Create new data |
| PUT / PATCH | Update existing data |
| DELETE | Remove data |

| Status code | Means |
| --- | --- |
| 200 | OK |
| 201 | Created |
| 400 | Bad request, your data was invalid |
| 404 | Not found |
| 500 | Server error |

## Building it: three files, same pattern every time

```python 1. serializers.py: Python objects to and from JSON
class ApplicantSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Applicant
        fields = ["id", "full_name", "email", "role", "status"]
```

```python 2. views.py: what runs per request
@api_view(["GET"])
def seats_left(request):
    mission = Mission.objects.get(name="Ares-1")
    left = mission.total_seats - mission.applicant_set.count()
    return Response({"seats_left": left})

@api_view(["POST"])
def apply(request):
    serializer = ApplicantSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)
```

```python 3. urls.py: the addresses
urlpatterns = [
    path("seats/", views.seats_left),   # GET  /api/seats/
    path("apply/", views.apply),        # POST /api/apply/
]
```

That's a working, testable API. Chapter 12 is where our frontend actually calls it.
