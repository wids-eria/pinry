from django import forms

from django_images.models import Image


FIELD_NAME_MAPPING = {
    'image': 'qqfile',
}

class ImageForm(forms.ModelForm):
    def add_prefix(self, field_name):
        field_name = FIELD_NAME_MAPPING.get(field_name, field_name)
        return super(ImageForm, self).add_prefix(field_name)

    def clean(self):
        from django.core.exceptions import ValidationError
        raise ValidationError("account already exists")

    class Meta:
        model = Image
        fields = ('image',)