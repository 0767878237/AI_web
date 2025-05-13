from django.urls import path
from . import views

urlpatterns = [
    path('', views.summarizer_page, name='summarizer_page'),
    path('api/summarize/', views.summarize_text, name='summarize_text'),  
]
