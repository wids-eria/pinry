from django.conf.urls import patterns, include, url
from django.views.generic import TemplateView
from django.contrib import admin
from tastypie.api import Api

from .api import ImageResource, ThumbnailResource, PinResource, UserResource
from .feeds import LatestPins, LatestUserPins, LatestTagPins
from .views import CreateImage

v1_api = Api(api_name='v1')
v1_api.register(ImageResource())
v1_api.register(ThumbnailResource())
v1_api.register(PinResource())
v1_api.register(UserResource())


urlpatterns = patterns('',
    url(r'^admin/', include(admin.site.urls)),
    url(r'^api/', include(v1_api.urls, namespace='api')),

    url(r'feeds/latest-pins/tag/(?P<tag>(\w|-)+)/', LatestTagPins()),
    url(r'feeds/latest-pins/user/(?P<user>(\w|-)+)/', LatestUserPins()),
    url(r'feeds/latest-pins/', LatestPins()),

    url(r'^pins/pin-form/$', TemplateView.as_view(template_name='core/pin_form.html'),
        name='pin-form'),
    url(r'^pins/create-image/$', CreateImage.as_view(), name='create-image'),

    url(r'^pins/tag/(?P<tag>(\w|-)+)/$', TemplateView.as_view(template_name='core/pins.html'),
        name='tag-pins'),
    url(r'^pins/user/(?P<user>(\w|-)+)/$', TemplateView.as_view(template_name='core/pins.html'),
        name='user-pins'),
    url(r'^(?P<pin>\d+)/$', TemplateView.as_view(template_name='core/pins.html'),
        name='recent-pins'),
    url(r'^$', TemplateView.as_view(template_name='core/pins.html'),
        name='recent-pins'),
    url(r'^ajax$', 'pinry.core.api.ValidateUrl'),
)
