"""URL configuration for the web application."""
from django.urls import path
from web import views

urlpatterns = [
    path('', views.summarizer_page, name='summarizer_page'),
    path('api/summarize/', views.summarize_text, name='summarize_text'),
    path('export-summary/', views.export_summary, name='export_summary'),
    path('api/extract-text/', views.extract_text_from_file, name='extract_text'),
]
