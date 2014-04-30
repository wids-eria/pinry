/**
 * Pin Form for Pinry
 * Descrip: This is for creation new pins on everything, the bookmarklet, on the
 *          site and even editing pins in some limited situations.
 * Authors: Pinry Contributors
 * Updated: March 3rd, 2013
 * Require: jQuery, Pinry JavaScript Helpers
 */


$(window).load(function() {
    var uploadedImage = false;
    var editedPin = null;

    // Start Helper Functions
    function getFormData() {
        return {
            submitter: currentUser,
            url: $('#pin-form-image-url').val(),
            description: $('#pin-form-description').val(),
            learned: $('#pin-form-learned').val(),
            tags: cleanTags($('#pin-form-tags').val())
        }
    }

    function createPinPreviewFromForm() {
        var context = {pins: [{
            submitter: currentUser,
            image: {thumbnail: {image: $('#pin-form-image-url').val()}},
            description: $('#pin-form-description').val(),
            learned: $('#pin-form-learned').val(),
            tags: cleanTags($('#pin-form-tags').val())
        }]},
        html = renderTemplate('#pins-template', context),
        preview = $('#pin-form-image-preview');
        preview.html(html);
        preview.find('.pin').width(240);
        preview.find('.pin').fadeIn(300);
        if (getFormData().url == "")
            preview.find('.image-wrapper').height(255);
        preview.find('.image-wrapper img').fadeIn(300);
        setTimeout(function() {
            if (preview.find('.pin').height() > 305) {
                $('#pin-form .modal-body').animate({
                    'height': preview.find('.pin').height()+25
                }, 300);
            }
        }, 300);
    }

    function dismissModal(modal) {
        modal.modal('hide');
        setTimeout(function() {
            modal.remove();
        }, 200);
    }
    // End Helper Functions


    // Start View Functions
    function createPinForm(editPinId) {
        $('body').append(renderTemplate('#pin-form-template', ''));
        var modal = $('#pin-form'),
            formFields = [$('#pin-form-image-url'), $('#pin-form-description'),
            $('#pin-form-learned'), $('#pin-form-tags')],
            pinFromUrl = getUrlParameter('pin-image-url');
        // If editable grab existing data
        if (editPinId) {
            var promise = getPinData(editPinId);
            promise.success(function(data) {
                editedPin = data;
                $('#pin-form-image-url').val(editedPin.image.thumbnail.image);
                $('#pin-form-image-url').parent().hide();
                $('#pin-form-image-upload').parent().hide();
                $('#pin-form-description').val(editedPin.description);
                $('#pin-form-learned').val(editedPin.learned);
                $('#pin-form-tags').val(editedPin.tags);

                $('#pin-title').text("Editing Pin");
                createPinPreviewFromForm();
            });
        }else{
            $('#pin-title').text("New Pin");
            $('#pin-form-description').val("");
            $('#pin-form-learned').val("");
            $('#pin-form-tags').val("");
        }
        modal.modal('show');
        // Auto update preview on field changes
        var timer;
        for (var i in formFields) {
            formFields[i].bind('propertychange keyup input paste', function() {
                clearTimeout(timer);
                timer = setTimeout(function() {
                    createPinPreviewFromForm()
                }, 700);
                if (!uploadedImage)
                    $('#pin-form-image-upload').parent().fadeOut(300);
            });
        }
        // Drag and Drop Upload
        $('#pin-form-image-upload').fineUploader({
            request: {
                endpoint: '/pins/create-image/',
                paramsInBody: true,
                multiple: false,
                validation: {
                    allowedExtensions: ['jpeg', 'jpg', 'png', 'gif']
                },
                text: {
                    uploadButton: 'Click or Drop'
                }
            }
        }).on('complete', function(e, id, name, data) {
            $('#pin-form-image-url').parent().fadeOut(300);
            $('.qq-upload-button').css('display', 'none');
            var promise = getImageData(data.success.id);
            uploadedImage = data.success.id;
            promise.success(function(image) {
                $('#pin-form-image-url').val(image.thumbnail.image);
                createPinPreviewFromForm();
            });
            promise.error(function() {
                message('Problem uploading image.', 'alert alert-error');
            });
        });
        // Submit pin on post click
        $('#pin-form-submit').click(function(e) {
            var siteurl = $('#pin-website-image-url').val();
            $('#pin-form-site-url').val(siteurl);

            e.preventDefault();
            $(this).off('click');
            $(this).addClass('disabled');

            var siteurl = $('#pin-website-image-url').val();
            var imageurl = $('#pin-form-image-url').val();

            if (editedPin) {
                var apiUrl = '/api/v1/pin/'+editedPin.id+'/?format=json';

                var data = {
                    description: $('#pin-form-description').val(),
                    learned: $('#pin-form-learned').val(),
                    tags: cleanTags($('#pin-form-tags').val()),
                    site: $('#pin-website-image-url').val(),
                    url: $('#pin-form-image-url').val()
                }
                var promise = $.ajax({
                    type: "put",
                    url: apiUrl,
                    contentType: 'application/json',
                    data: JSON.stringify(data)
                });
                promise.success(function(pin) {
                    pin.editable = true;
                    var renderedPin = renderTemplate('#pins-template', {
                        pins: [
                            pin
                        ]
                    });
                    $('#pins').find('.pin[data-id="'+pin.id+'"]').replaceWith(renderedPin);
                    tileLayout();
                    lightbox();
                    dismissModal(modal);
                    editedPin = null;

                    $('#pin-board-images').modal('hide');
                    $('.loader-wrapper').modal('hide');
                });
                promise.error(function() {
                    message('Problem updating image.', 'alert alert-error');
                    $('#pin-board-images').modal('hide');
                });

                promise.always(function(){
                    $('#pin-board-images').modal('hide');
                    $('#pin-form').modal('hide');
                });
            } else {
                var data = {
                    submitter: '/api/v1/user/'+currentUser.id+'/',
                    description: $('#pin-form-description').val(),
                    learned: $('#pin-form-learned').val(),
                    tags: cleanTags($('#pin-form-tags').val()),
                    url: $('#pin-form-website-url').val(),
                    site: $('#pin-form-image-url').val()
                };
                if (uploadedImage){
                    data.image = '/api/v1/image/'+uploadedImage+'/';
                    data.url = $('#pin-form-image-url').val();
                }else{
                    data.url = $('#pin-form-image-url').val();
                }
                var promise = postPinData(data);
                promise.success(function(pin) {
                    if (pinFromUrl) return window.close();
                    pin.editable = true;
                    pin = renderTemplate('#pins-template', {pins: [pin]});
                    $('#pins').prepend(pin);
                    tileLayout();
                    lightbox();
                  //  dismissModal(modal);
                    uploadedImage = false;
                    $('#pin-board-images').modal('hide');
                    $('#pin-form').modal('hide');
                });
                promise.error(function() {
                    message('Problem saving image.', 'alert alert-error');
                });

                promise.always(function(){
                    $('#pin-board-images').modal('hide');
                    $('#pin-form').modal('hide');
                });
            }

            $(this).removeClass('disabled');
        });
        $('#pin-form-close').click(function() {
            if (pinFromUrl) return window.close();
            dismissModal(modal);
        });
    }

    //Add callback to popover Object
    var tmp = $.fn.popover.Constructor.prototype.show;
    $.fn.popover.Constructor.prototype.show = function () {
      tmp.call(this);
      if (this.options.callback) {
        this.options.callback();
      }
    }

    // Start Init
    window.pinForm = function(editPinId) {
        editPinId = typeof editPinId !== 'undefined' ? editPinId : null;
        if(editPinId !== null) {
            createPinForm(editPinId);
        }

        $('#newpin').popover({
            placement : 'bottom',
            'html':true,
            'content': '<div id="pin-site">Pin from Website</div><div id="pin-upload">Upload image</div>',
            callback: function() {
                $('#pin-site').click(function() {
                    $('#pin-website').modal('show');
                    $('#newpin').popover('hide');
                });
                $('#pin-upload').click(function() {
                    $('#newpin').popover('hide');
                    $('#pin-form-image-url').val('');
                    createPinForm();
                    createPinPreviewFromForm();
                });
            }
        });

        $('#pin-website-submit').click(function(){
            var pinurl = $('#pin-website-image-url').val();
            $('.loader-wrapper').css('display', 'block');
            $.post('/validateurl',{ url: pinurl}).done(function(data) {
                $('#pin-images').html("");
                if(data['Valid']){
                    $('#form-error').hide();
                    $('#pin-website').modal('hide');

                    data['urls'].forEach(function(imageUrl) {
                        var image = document.createElement('img');
                        $(image).attr("src",imageUrl);
                        $('#pin-images').append(image);
                    });

                    $('#pin-board-images').modal('show');
                    $('#pin-images img').click(function(){
                        if($("#pin-form").length <= 0){
                            createPinForm(editPinId);
                        }else{
                            createPinForm();
                        }

                        var siteurl = $('#pin-website-image-url').val();
                        $('#pin-form-site-url').val(siteurl);
                        $('#pin-form-image-url').val($(this).attr("src"));

                        createPinPreviewFromForm();
                        $('#pin-form').modal('show');
                    });
                }else{
                    $('#form-error').text(data['Error']).show();
                }
            }).always(function(){
                $('.loader-wrapper').css('display', 'none');
            });
        });
    }

    if (getUrlParameter('pin-image-url')) {
        createPinForm();
    }
    // End Ini

});
