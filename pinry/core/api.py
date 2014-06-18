from tastypie import fields
from tastypie.authorization import DjangoAuthorization
from tastypie.constants import ALL, ALL_WITH_RELATIONS
from tastypie.exceptions import Unauthorized
from tastypie.resources import ModelResource
from tastypie.validation import Validation
from django_images.models import Thumbnail
from django.http import HttpResponseRedirect, HttpResponse
import json
from .models import Pin, Image, WhiteListDomain
from ..users.models import User
import sys,re,urllib2
from bs4 import BeautifulSoup


class PinryAuthorization(DjangoAuthorization):
    """
    Pinry-specific Authorization backend with object-level permission checking.
    """
    def update_detail(self, object_list, bundle):
        klass = self.base_checks(bundle.request, bundle.obj.__class__)

        if klass is False:
            raise Unauthorized("You are not allowed to access that resource.")

        permission = '%s.change_%s' % (klass._meta.app_label, klass._meta.module_name)

        if not bundle.request.user.has_perm(permission, bundle.obj):
            raise Unauthorized("You are not allowed to access that resource.")

        return True

    def delete_detail(self, object_list, bundle):
        klass = self.base_checks(bundle.request, bundle.obj.__class__)

        if klass is False:
            raise Unauthorized("You are not allowed to access that resource.")

        permission = '%s.delete_%s' % (klass._meta.app_label, klass._meta.module_name)

        if not bundle.request.user.has_perm(permission, bundle.obj):
            raise Unauthorized("You are not allowed to access that resource.")

        return True


class UserResource(ModelResource):
    gravatar = fields.CharField(readonly=True)

    def dehydrate_gravatar(self, bundle):
        return bundle.obj.gravatar

    class Meta:
        list_allowed_methods = ['get']
        filtering = {
            'username': ALL
        }
        queryset = User.objects.all()
        resource_name = 'user'
        fields = ['username']
        include_resource_uri = False


def filter_generator_for(size):
    def wrapped_func(bundle, **kwargs):
        return bundle.obj.get_by_size(size)
    return wrapped_func


class ThumbnailResource(ModelResource):
    class Meta:
        list_allowed_methods = ['get']
        fields = ['image', 'width', 'height']
        queryset = Thumbnail.objects.all()
        resource_name = 'thumbnail'
        include_resource_uri = False


class ImageResource(ModelResource):
    standard = fields.ToOneField(ThumbnailResource, full=True,
                                 attribute=lambda bundle: filter_generator_for('standard')(bundle))
    thumbnail = fields.ToOneField(ThumbnailResource, full=True,
                                  attribute=lambda bundle: filter_generator_for('thumbnail')(bundle))
    square = fields.ToOneField(ThumbnailResource, full=True,
                               attribute=lambda bundle: filter_generator_for('square')(bundle))

    class Meta:
        fields = ['image', 'width', 'height']
        include_resource_uri = False
        resource_name = 'image'
        queryset = Image.objects.all()
        authorization = DjangoAuthorization()

class WhitelistValidation(Validation):
    def is_valid(self, bundle, request=None):
        errors = {}

        #Only do validation feedback when the pin is being created from a url and not uploaded
        if request.META["REQUEST_METHOD"] == "POST":
            url = bundle.data['url']
            if not url.startswith("/media"):
                if not self.check_domains(url):
                    errors = {"url","Url {0} is not allowed!".format(url)}

                site = bundle.data['site']
                if self.check_domains(site):
                   # errors = {"site","Site {0} is not allowed!".format(site)}
                   pass

        return errors

    def prep_url(self,url):
        if not url.startswith("http"):
            url = "http://" + url
        temp = re.search("((?<=http://)|(?<=https://))(?!www){1}.*",url)

        if temp == None:
            url = re.search("(?<=\.).*",url)
        else:
            url = temp

        if url == None:
            return None
        return url.group(0)

    def check_domains(self,url):
        url = self.prep_url(url)

        if url != None:
            matched = False
            for match in WhiteListDomain.objects.all():
                match = self.prep_url(match.url)

                if match != None and re.search("({0})(\/|$)".format(match), url):
                    matched = True
                    break;
            return matched
        return False

def ValidateUrl(request):
    validator = WhitelistValidation()
    url = request.POST.dict()['url']
    if not url.startswith("http"):
        url = "http://" + url

    valid = validator.check_domains(url)
    data = {}
    data['Valid'] = valid

    if not valid:
        data['Error'] = 'Url {0} is not allowed!'.format(url)
        return HttpResponse(json.dumps(data),content_type = "application/json")

    response = urllib2.urlopen(url).read()
    soup = BeautifulSoup(response)

    images = []
    for img in soup.find_all('img'):
        url = img.get('src')
        if url.startswith("http"):
            images.append(url)
    data['urls'] = images

    return HttpResponse(json.dumps(data),content_type = "application/json")

class PinResource(ModelResource):
    submitter = fields.ToOneField(UserResource, 'submitter', full=True)
    image = fields.ToOneField(ImageResource, 'image', full=True)
    tags = fields.ListField()

    def hydrate_image(self, bundle):
        url = bundle.data.get('url', None)
        if url and not url.startswith("/"):
            image = Image.objects.create_for_url(url)
            bundle.data['image'] = '/api/v1/image/{}/'.format(image.pk)
        return bundle

    def hydrate(self, bundle):
        """Run some early/generic processing

        Make sure that user is authorized to create Pins first, before
        we hydrate the Image resource, creating the Image object in process
        """
        submitter = bundle.data.get('submitter', None)
        if not submitter:
            bundle.data['submitter'] = '/api/v1/user/{}/'.format(bundle.request.user.pk)
        else:
            if not '/api/v1/user/{}/'.format(bundle.request.user.pk) == submitter:
                raise Unauthorized("You are not authorized to create Pins for other users")
        return bundle

    def dehydrate_tags(self, bundle):
        return map(str, bundle.obj.tags.all())

    def build_filters(self, filters=None):
        orm_filters = super(PinResource, self).build_filters(filters)
        if filters and 'tag' in filters:
            orm_filters['tags__name__in'] = filters['tag'].split(',')
        return orm_filters

    def save_m2m(self, bundle):
        tags = bundle.data.get('tags', None)
        if tags:
            bundle.obj.tags.set(*tags)
        return super(PinResource, self).save_m2m(bundle)

    class Meta:
        fields = ['id', 'url', 'siteurl','origin', 'description', 'learned']
        ordering = ['id']
        filtering = {
            'submitter': ALL_WITH_RELATIONS
        }
        queryset = Pin.objects.all()
        resource_name = 'pin'
        include_resource_uri = False
        always_return_data = True
        authorization = PinryAuthorization()
        validation = WhitelistValidation()
